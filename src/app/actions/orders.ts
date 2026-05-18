'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidateOrdersPages } from '@/lib/revalidate'
import { syncOrderUpdateToShopify } from './shopify-sync'

const OPTIONAL_ORDER_COLUMNS = ['subtotal', 'shipping_fee', 'waybill_number', 'whatsapp_history'] as const

async function persistOrderUpdate(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
  payload: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (Object.keys(payload).length === 0) {
    return { ok: true }
  }

  let { error } = await supabase.from('orders').update(payload).eq('id', orderId)

  if (error && /column .* does not exist/i.test(error.message || '')) {
    const dropped: string[] = []
    const legacyPayload = { ...payload }
    for (const col of OPTIONAL_ORDER_COLUMNS) {
      if (col in legacyPayload) {
        delete legacyPayload[col]
        dropped.push(col)
      }
    }

    if (Object.keys(legacyPayload).length > 0) {
      const retry = await supabase.from('orders').update(legacyPayload).eq('id', orderId)
      error = retry.error
    } else {
      return {
        ok: false,
        error: `لم يُحفظ التحديث: أعمدة غير موجودة في قاعدة البيانات (${dropped.join(', ')}). طبّق migrations على Supabase.`,
      }
    }

    if (!error && dropped.length > 0) {
      return {
        ok: false,
        error: `لم يُحفظ جزء من التحديث (${dropped.join(', ')}). طبّق migrations على Supabase.`,
      }
    }
  }

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function createOrderAction(data: any, lang?: string) {
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
        if (data.governorate) {
          await supabase.from('customers').update({ governorate: data.governorate }).eq('id', customerId)
        }
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
    if (data.governorate && customerId) {
      await supabase.from('customers').update({ governorate: data.governorate }).eq('id', customerId)
    }

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
    if (orderError && /column .* does not exist/i.test(orderError.message || '')) {
      const { subtotal: _s, shipping_fee: _sf, ...legacyPayload } = payload
      void _s; void _sf
      const retry = await supabase.from('orders').insert(legacyPayload)
      orderError = retry.error
    }

    if (orderError) {
      return { success: false, error: `فشل حفظ الطلب: ${orderError.message}` }
    }

    revalidateOrdersPages(lang)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ غير متوقع' }
  }
}

export async function deleteOrderAction(orderId: string, lang?: string) {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('orders').delete().eq('id', orderId)
    if (error) {
      console.error('Delete order error:', error)
      return { success: false, error: `فشل الحذف: ${error.message}` }
    }
    revalidateOrdersPages(lang)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function updateOrderStatusAction(orderId: string, status: string, lang?: string) {
  try {
    const supabase = createAdminClient()
    
    const { data: order } = await supabase.from('orders').select('source, external_order_id, notes, total, subtotal, shipping_fee, status').eq('id', orderId).single()
    
    const { data: updated, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    if (!updated) return { success: false, error: 'لم يتم العثور على الطلب أو لم يُحفظ التحديث' }
    
    if (order?.source === 'shopify' && order?.external_order_id) {
      await syncOrderUpdateToShopify(order.external_order_id, { status })
    }

    const deliveredStatuses = ['delivered', 'تم التسليم', 'تم_التسليم', 'مستلم']
    const wasDelivered = deliveredStatuses.includes(order?.status || '')
    const isNowDelivered = deliveredStatuses.includes(status)
    
    if (isNowDelivered && !wasDelivered && order) {
      const orderTotal = parseFloat(order.total) || 0
      
      if (orderTotal > 0) {
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('notes', `[auto] طلب #${orderId}`)
          .limit(1)
        
        if (!existing || existing.length === 0) {
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

    if (wasDelivered && !isNowDelivered) {
      await supabase
        .from('transactions')
        .delete()
        .eq('notes', `[auto] طلب #${orderId}`)
    }

    revalidateOrdersPages(lang)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function saveWaybillAction(orderId: string, waybillNumber: string, lang?: string) {
  try {
    const supabase = createAdminClient()
    const trimmed = waybillNumber.trim()
    
    const updatePayload: Record<string, unknown> = { waybill_number: trimmed || null }
    if (trimmed) {
      updatePayload.status = 'shipped'
    }
    
    const result = await persistOrderUpdate(supabase, orderId, updatePayload)
    if (!result.ok) return { success: false, error: result.error }

    const { data: updated } = await supabase.from('orders').select('id, status, waybill_number').eq('id', orderId).single()
    if (!updated) {
      return { success: false, error: 'لم يُحفظ رقم البوليصة — تحقق من الطلب' }
    }
    
    revalidateOrdersPages(lang)
    return { success: true, status: trimmed ? 'shipped' : undefined, waybill_number: updated.waybill_number }
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
  },
  lang?: string
) {
  try {
    const supabase = createAdminClient()
    
    if (data.customerId && (data.customerName !== undefined || data.phone !== undefined || data.address !== undefined || data.governorate !== undefined)) {
      const customerPayload: Record<string, unknown> = {}
      if (data.customerName !== undefined) customerPayload.full_name = data.customerName || 'غير معروف'
      if (data.phone !== undefined) customerPayload.phone_number = data.phone
      if (data.address !== undefined) customerPayload.address = data.address
      if (data.governorate !== undefined) customerPayload.governorate = data.governorate

      if (Object.keys(customerPayload).length > 0) {
        const { error: custError } = await supabase.from('customers').update(customerPayload).eq('id', data.customerId)
        if (custError) {
          return { success: false, error: `فشل تحديث بيانات العميل: ${custError.message}` }
        }
      }
    }

    const orderPayload: Record<string, unknown> = {}
    
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

    if (Object.keys(orderPayload).length > 0) {
      const result = await persistOrderUpdate(supabase, orderId, orderPayload)
      if (!result.ok) return { success: false, error: result.error }
    }

    if (data.source === 'shopify' || data.external_order_id) {
      const { data: dbOrder } = await supabase.from('orders').select('external_order_id, source').eq('id', orderId).single()
      
      const isShopify = (data.source || dbOrder?.source) === 'shopify'
      const extId = data.external_order_id || dbOrder?.external_order_id

      if (isShopify && extId) {
         if (data.status !== undefined || data.notes !== undefined) {
            await syncOrderUpdateToShopify(extId, { status: data.status, notes: data.notes })
         }
      }
    }

    revalidateOrdersPages(lang)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function recordWhatsAppSentAction(orderId: string, status: string, lang?: string) {
  try {
    const supabase = createAdminClient()
    
    const { data: order, error: fetchErr } = await supabase.from('orders').select('whatsapp_history').eq('id', orderId).single()
    if (fetchErr) return { success: false, error: fetchErr.message }

    const history = typeof order.whatsapp_history === 'object' && order.whatsapp_history !== null 
       ? order.whatsapp_history 
       : {}
    
    const updatedHistory = { ...history, [status]: true }

    const result = await persistOrderUpdate(supabase, orderId, { whatsapp_history: updatedHistory })
    if (!result.ok) {
      if (result.error.includes('whatsapp_history')) {
        return { success: false, error: 'عمود سجل الواتساب غير موجود — طبّق migration على Supabase' }
      }
      return { success: false, error: result.error }
    }
    
    revalidateOrdersPages(lang)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}
