'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { syncOrderUpdateToShopify } from './shopify-sync'

export async function createOrderAction(data: any) {
  try {
    const supabase = createAdminClient()

    // 1. Create or Find Customer
    let customerId = null
    if (data.phone) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone_number', data.phone)
        .maybeSingle()

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        const { data: newCustomer, error: custError } = await supabase
          .from('customers')
          .insert({
            full_name: data.customerName || 'غير معروف',
            phone_number: data.phone,
            address: data.address || '',
            ...(data.governorate ? { governorate: data.governorate } : {})
          })
          .select('id')
          .single()

        if (custError) {
          return { success: false, error: `فشل تسجيل العميل: ${custError.message}` }
        }
        customerId = newCustomer.id
      }
    }

    // 2. Insert Order
    const payload: Record<string, any> = {
      customer_id: customerId,
      source: data.source || 'manual',
      status: 'pending',
    }

    if (data.orderId) payload.external_order_id = data.orderId
    if (data.total !== undefined && data.total !== null) payload.total = parseFloat(data.total) || 0
    if (data.governorate) payload.governorate = data.governorate

    const productPriceNum = data.productPrice !== undefined && data.productPrice !== null
      ? parseFloat(data.productPrice) || 0
      : 0
    const shippingPriceNum = data.shippingPrice !== undefined && data.shippingPrice !== null
      ? parseFloat(data.shippingPrice) || 0
      : 0
    if (productPriceNum || shippingPriceNum) {
      payload.subtotal = productPriceNum
      payload.shipping_fee = shippingPriceNum
    }

    if (data.products || data.notes || data.productPrice || data.shippingPrice) {
      const parts = []
      if (data.products) parts.push(data.products)
      
      let extraVars = []
      if (data.productPrice) extraVars.push(`سعر المنتج: ${data.productPrice}`)
      if (data.shippingPrice) extraVars.push(`الشحن: ${data.shippingPrice}`)
      if (extraVars.length > 0) parts.push(extraVars.join(' | '))

      if (data.notes) parts.push('--- ملاحظات ---\n' + data.notes)

      payload.notes = parts.join('\n\n')
    }

    let { error: orderError } = await supabase.from('orders').insert(payload)
    // Retry without subtotal/shipping_fee if those columns don't exist in this DB.
    if (orderError && /column .* does not exist/i.test(orderError.message || '')) {
      const { subtotal: _s, shipping_fee: _sf, ...legacyPayload } = payload
      void _s; void _sf
      const retry = await supabase.from('orders').insert(legacyPayload)
      orderError = retry.error
    }

    if (orderError) {
      return { success: false, error: `فشل حفظ الطلب: ${orderError.message}` }
    }

    revalidatePath('/[lang]/orders', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ غير متوقع' }
  }
}

export async function deleteOrderAction(orderId: string) {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('orders').delete().eq('id', orderId)
    if (error) {
      console.error('Delete order error:', error)
      return { success: false, error: `فشل الحذف: ${error.message}` }
    }
    revalidatePath('/[lang]/orders', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function updateOrderStatusAction(orderId: string, status: string) {
  try {
    const supabase = createAdminClient()
    
    // Fetch current order to check source + financials
    const { data: order } = await supabase.from('orders').select('source, external_order_id, notes, total, subtotal, shipping_fee, status').eq('id', orderId).single()
    
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
    if (error) return { success: false, error: error.message }
    
    // Push status to Shopify if applicable
    if (order?.source === 'shopify' && order?.external_order_id) {
      await syncOrderUpdateToShopify(order.external_order_id, { status })
    }

    // ——— Auto-Accounting: create transaction when delivered ———
    const deliveredStatuses = ['delivered', 'تم التسليم', 'تم_التسليم', 'مستلم']
    const wasDelivered = deliveredStatuses.includes(order?.status || '')
    const isNowDelivered = deliveredStatuses.includes(status)
    
    if (isNowDelivered && !wasDelivered && order) {
      const orderTotal = parseFloat(order.total) || 0
      
      if (orderTotal > 0) {
        // Check if auto-transaction already exists for this order
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('notes', `[auto] طلب #${orderId}`)
          .limit(1)
        
        if (!existing || existing.length === 0) {
          // Create income transaction
          const today = new Date().toISOString().split('T')[0]
          await supabase.from('transactions').insert({
            amount: orderTotal,
            type: 'income',
            category: 'مبيعات',
            notes: `[auto] طلب #${orderId}`,
            transaction_date: today,
          })
        }
      }
    }

    // ——— Auto-Accounting: reverse if un-delivered ———
    if (wasDelivered && !isNowDelivered) {
      // Remove auto-created transaction
      await supabase
        .from('transactions')
        .delete()
        .eq('notes', `[auto] طلب #${orderId}`)
    }

    revalidatePath('/[lang]/orders', 'page')
    revalidatePath('/[lang]/accounting', 'page')
    revalidatePath('/[lang]', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

// Quick waybill save — auto-changes status to shipped
export async function saveWaybillAction(orderId: string, waybillNumber: string) {
  try {
    const supabase = createAdminClient()
    const trimmed = waybillNumber.trim()
    
    const updatePayload: any = { waybill_number: trimmed || null }
    // Auto-set to shipped when waybill is entered
    if (trimmed) {
      updatePayload.status = 'shipped'
    }
    
    const { error } = await supabase.from('orders').update(updatePayload).eq('id', orderId)
    if (error) return { success: false, error: error.message }
    
    revalidatePath('/[lang]/orders', 'page')
    return { success: true, status: trimmed ? 'shipped' : undefined }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function updateOrderAction(
  orderId: string,
  data: {
    products?: string;
    notes?: string;
    total?: number;
    productPrice?: number;
    shippingPrice?: number;
    external_order_id?: string;
    status?: string;
    source?: string;
    customerName?: string;
    phone?: string;
    address?: string;
    governorate?: string;
    customerId?: string;
    waybill_number?: string;
  }
) {
  try {
    const supabase = createAdminClient()
    
    // Update customer if provided
    if (data.customerId && (data.customerName !== undefined || data.phone !== undefined || data.address !== undefined)) {
      const customerPayload: any = {}
      if (data.customerName !== undefined) customerPayload.full_name = data.customerName || 'غير معروف'
      if (data.phone !== undefined) customerPayload.phone_number = data.phone
      if (data.address !== undefined) customerPayload.address = data.address
      if (data.governorate !== undefined) customerPayload.governorate = data.governorate

      if (Object.keys(customerPayload).length > 0) {
        const { error: custError } = await supabase.from('customers').update(customerPayload).eq('id', data.customerId)
        if (custError) {
          console.error('Error updating customer:', custError)
        }
      }
    }

    // Update order
    const orderPayload: any = {}
    
    if (data.products !== undefined || data.notes !== undefined) {
      const parts = []
      if (data.products) parts.push(data.products)
      if (data.notes) parts.push('--- ملاحظات ---\n' + data.notes)
      orderPayload.notes = parts.join('\n\n')
    }

    if (data.total !== undefined) orderPayload.total = data.total
    if (data.productPrice !== undefined) orderPayload.subtotal = data.productPrice
    if (data.shippingPrice !== undefined) orderPayload.shipping_fee = data.shippingPrice
    if (data.external_order_id !== undefined) orderPayload.external_order_id = data.external_order_id
    if (data.status !== undefined) orderPayload.status = data.status
    if (data.source !== undefined) orderPayload.source = data.source
    if (data.waybill_number !== undefined) orderPayload.waybill_number = data.waybill_number || null
    if (data.governorate !== undefined) orderPayload.governorate = data.governorate

    if (Object.keys(orderPayload).length > 0) {
      let { error } = await supabase.from('orders').update(orderPayload).eq('id', orderId)
      // Retry without columns that may not exist yet on un-migrated DBs.
      if (error && /column .* does not exist/i.test(error.message || '')) {
        const {
          subtotal: _s,
          shipping_fee: _sf,
          waybill_number: _wb,
          ...legacyPayload
        } = orderPayload
        void _s; void _sf; void _wb
        if (Object.keys(legacyPayload).length > 0) {
          const retry = await supabase.from('orders').update(legacyPayload).eq('id', orderId)
          error = retry.error
        } else {
          error = null
        }
      }
      if (error) return { success: false, error: error.message }
    }

    // Attempt to sync to Shopify if modified fields overlap
    if (data.source === 'shopify' || data.external_order_id) {
      // Use existing external ID or the new one
      const supabaseLookup = createAdminClient()
      const { data: dbOrder } = await supabaseLookup.from('orders').select('external_order_id, source').eq('id', orderId).single()
      
      const isShopify = (data.source || dbOrder?.source) === 'shopify'
      const extId = data.external_order_id || dbOrder?.external_order_id

      if (isShopify && extId) {
         if (data.status !== undefined || data.notes !== undefined) {
            await syncOrderUpdateToShopify(extId, { status: data.status, notes: data.notes })
         }
      }
    }

    revalidatePath('/[lang]/orders', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function recordWhatsAppSentAction(orderId: string, status: string) {
  try {
    const supabase = createAdminClient()
    
    // Fetch current history
    const { data: order, error: fetchErr } = await supabase.from('orders').select('whatsapp_history').eq('id', orderId).single()
    if (fetchErr) return { success: false, error: fetchErr.message }

    const history = typeof order.whatsapp_history === 'object' && order.whatsapp_history !== null 
       ? order.whatsapp_history 
       : {}
    
    const updatedHistory = { ...history, [status]: true }

    const { error: updateErr } = await supabase.from('orders').update({ whatsapp_history: updatedHistory }).eq('id', orderId)
    if (updateErr) {
       // Graceful fallback if column doesn't exist yet
       if (/column .* does not exist/i.test(updateErr.message)) {
          return { success: true, warning: 'WhatsApp history column not yet migrated' }
       }
       return { success: false, error: updateErr.message }
    }
    
    revalidatePath('/[lang]/orders', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}
