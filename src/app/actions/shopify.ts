'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || ''
const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL || ''

export async function syncShopifyOrderAction(orderNumber: string) {
  try {
    const supabase = createAdminClient()
    
    // Shopify allows querying the natural `name` field using #1284 format.
    const queryName = encodeURIComponent(orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`)
    
    const res = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders.json?name=${queryName}&status=any`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.statusText}`)
    }
    
    const data = await res.json()
    if (!data.orders || data.orders.length === 0) {
      return { error: 'Order not found matching that number' }
    }
    
    // Extract payload for exact match
    const payload = data.orders[0]
    
    const phone = payload.customer?.phone || payload.billing_address?.phone || payload.shipping_address?.phone || ''
    const name = payload.customer?.first_name ? `${payload.customer.first_name} ${payload.customer.last_name || ''}`.trim() : 'Unknown Customer'
    const address = payload.shipping_address ? `${payload.shipping_address.address1 || ''} ${payload.shipping_address.city || ''}`.trim() : ''
    
    let customerId = null
    if (phone) {
      const { data: existingCustomer } = await supabase.from('customers').select('id').eq('phone_number', phone).maybeSingle()
      if (existingCustomer) {
        customerId = existingCustomer.id
        await supabase.from('customers').update({ address, full_name: name }).eq('id', customerId)
      } else {
        const { data: newCustomer } = await supabase.from('customers').insert({ full_name: name, phone_number: phone, address }).select('id').single()
        if (newCustomer) customerId = newCustomer.id
      }
    }
    
    const lineItemsStr = Array.isArray(payload.line_items) 
      ? payload.line_items.map((item: any) => `${item.quantity}x ${item.name || item.title}`).join(' + ')
      : 'Order from Shopify'

    let notes = lineItemsStr
    if (payload.note) {
      notes += '\n\n--- ملاحظات ---\n' + payload.note
    }

    const total = parseFloat(payload.total_price || '0')
    const external_order_id = payload.name?.toString() || payload.order_number?.toString() || payload.id?.toString()
    
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('external_order_id', external_order_id)
      .eq('source', 'shopify')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    if (existingOrder) {
      await supabase.from('orders').update({
        customer_id: customerId,
        total,
        notes,
        source: 'shopify'
      }).eq('id', existingOrder.id)
      
      await supabase.from('activity_logs').insert({ action: `Updated Shopify Order ${external_order_id}`, entity_type: 'Order' })
    } else {
      await supabase.from('orders').insert({
        customer_id: customerId,
        total,
        notes,
        status: 'pending',
        source: 'shopify',
        external_order_id
      })
      
      // Deduct stock only for newly fetched orders
      if (payload.line_items && Array.isArray(payload.line_items)) {
        for (const item of payload.line_items) {
          if (item.sku && item.quantity) {
            await supabase.rpc('deduct_stock', { target_sku: item.sku, quantity_to_deduct: item.quantity })
          }
        }
      }
      await supabase.from('activity_logs').insert({ action: `Pulled New Shopify Order ${external_order_id}`, entity_type: 'Order' })
    }
    
    revalidatePath('/[lang]/orders', 'page')
    return { success: true, message: `Successfully fetched and synced order ${external_order_id}` }
  } catch (err: any) {
    console.error('Manual Sync Error:', err)
    return { error: err.message || 'Failed to sync with Shopify' }
  }
}
