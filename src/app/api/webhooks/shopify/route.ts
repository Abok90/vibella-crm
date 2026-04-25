import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256')
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET

    if (!secret || !hmacHeader) {
      await createAdminClient().from('activity_logs').insert({ action: 'Shopify Webhook Error: Unauthorized (Missing token)', entity_type: 'Order' })
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 })
    }

    const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
    if (hash !== hmacHeader) {
      await createAdminClient().from('activity_logs').insert({ action: 'Shopify Webhook Error: Invalid HMAC (Tokens do not match)', entity_type: 'Order' })
      return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)
    const supabase = createAdminClient()

    // ─── Idempotency key: use Shopify webhook ID to prevent re-processing ───
    const webhookId = req.headers.get('x-shopify-webhook-id') || ''
    if (webhookId) {
      const { data: existingLog } = await supabase
        .from('activity_logs')
        .select('id')
        .eq('action', `webhook:${webhookId}`)
        .limit(1)
        .maybeSingle()
      if (existingLog) {
        // Already processed this exact webhook
        return NextResponse.json({ success: true, deduplicated: true })
      }
      // Mark this webhook as processed immediately
      await supabase.from('activity_logs').insert({
        action: `webhook:${webhookId}`,
        entity_type: 'Webhook'
      })
    }

    // Extract customer
    const phone = payload.customer?.phone || payload.billing_address?.phone || payload.shipping_address?.phone || ''
    const name = payload.customer?.first_name ? `${payload.customer.first_name} ${payload.customer.last_name || ''}`.trim() : 'Unknown Customer'
    const address = payload.shipping_address ? `${payload.shipping_address.address1 || ''} ${payload.shipping_address.city || ''}`.trim() : ''
    
    let customerId = null
    if (phone) {
      const { data: existingCustomer } = await supabase.from('customers').select('id').eq('phone_number', phone).single()
      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        const { data: newCustomer, error: cErr } = await supabase.from('customers').insert({ full_name: name, phone_number: phone, address }).select('id').single()
        console.log('Customer Insert:', { newCustomer, cErr })
        if (newCustomer) customerId = newCustomer.id
      }
    }

    // Prepare line items
    const lineItemStr = Array.isArray(payload.line_items) 
      ? payload.line_items.map((item: any) => `${item.name || item.title}`).join(' + ')
      : 'Order from Shopify'

    let notes = lineItemStr
    if (payload.note) {
      notes += '\n\n--- ملاحظات ---\n' + payload.note
    }

    // ─── Parse financials properly ───
    const total = parseFloat(payload.total_price || '0')
    
    // Shipping fee: from shipping_lines array (preferred) or total_shipping_price_set
    let shippingFee = 0
    if (Array.isArray(payload.shipping_lines) && payload.shipping_lines.length > 0) {
      shippingFee = payload.shipping_lines.reduce((sum: number, sl: any) => sum + parseFloat(sl.price || '0'), 0)
    } else if (payload.total_shipping_price_set?.shop_money?.amount) {
      shippingFee = parseFloat(payload.total_shipping_price_set.shop_money.amount)
    }
    
    // Subtotal: items price (without shipping)
    const subtotal = total - shippingFee

    const external_order_id = payload.name?.toString() || payload.order_number?.toString() || payload.id?.toString()
    
    // ─── Check if order already exists ───
    let { data: existingOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('external_order_id', external_order_id)
      .eq('source', 'shopify')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    // --- CONCURRENCY JITTER TO PREVENT DUPLICATES ---
    if (!existingOrder) {
      const jitter = Math.floor(Math.random() * 2200) + 300
      await new Promise(resolve => setTimeout(resolve, jitter))

      const { data: doubleCheck } = await supabase
        .from('orders')
        .select('*')
        .eq('external_order_id', external_order_id)
        .eq('source', 'shopify')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
        
      if (doubleCheck) {
        existingOrder = doubleCheck
      }
    }

    // Map status from Shopify to CRM
    let mappedStatus: string | undefined = undefined;
    if (payload.cancelled_at) {
      mappedStatus = 'cancelled'
    } else if (payload.fulfillment_status === 'restocked' || payload.fulfillment_status === 'unfulfilled' || !payload.fulfillment_status) {
      mappedStatus = 'pending'
    } else if (payload.fulfillment_status === 'fulfilled' && payload.financial_status === 'paid') {
      mappedStatus = 'delivered'
    } else if (payload.fulfillment_status === 'fulfilled') {
      mappedStatus = 'shipped'
    } else if (payload.financial_status === 'paid') {
      mappedStatus = 'collected'
    }

    if (existingOrder) {
      const updateData: any = {
        customer_id: customerId,
        total,
        subtotal,
        shipping_fee: shippingFee,
      }
      
      // Smart notes merge to avoid overwriting CRM notes
      if (payload.note && !existingOrder.notes?.includes(payload.note)) {
         updateData.notes = (existingOrder.notes ? existingOrder.notes + '\n\n--- ملاحظات ---\n' : '') + payload.note
      }

      // Smart status merge — don't let webhook override manual CRM decisions
      const protectedStatuses = ['returned', 'delivered', 'collected']
      const isProtected = protectedStatuses.includes(existingOrder.status)
      
      if (mappedStatus && existingOrder.status !== mappedStatus && !isProtected) {
         updateData.status = mappedStatus
      }

      await supabase.from('orders').update(updateData).eq('id', existingOrder.id)
      
      const logMsg = `Updated Shopify Order #${payload.order_number || external_order_id}. Total: ${total}, Shipping: ${shippingFee}, Subtotal: ${subtotal}. Status: ${mappedStatus || 'none'}, Old: ${existingOrder.status}.`
      
      await supabase.from('activity_logs').insert({
        action: logMsg,
        entity_type: 'Order'
      })
    } else {
      // Insert new order — with duplicate guard
      const { data: newOrder, error: oErr } = await supabase.from('orders').insert({
        customer_id: customerId,
        total,
        subtotal,
        shipping_fee: shippingFee,
        notes,
        status: 'pending',
        source: 'shopify',
        external_order_id
      }).select('id').single()

      // If insert failed (likely race condition duplicate), just update instead
      if (oErr) {
        const { data: raceOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('external_order_id', external_order_id)
          .eq('source', 'shopify')
          .limit(1)
          .maybeSingle()
        
        if (raceOrder) {
          await supabase.from('orders').update({ customer_id: customerId, total, subtotal, shipping_fee: shippingFee }).eq('id', raceOrder.id)
          await supabase.from('activity_logs').insert({
            action: `Shopify Webhook: duplicate prevented for #${payload.order_number || external_order_id}`,
            entity_type: 'Order'
          })
          return NextResponse.json({ success: true })
        }
      }

      // Deduct stock
      if (newOrder && payload.line_items && Array.isArray(payload.line_items)) {
        for (const item of payload.line_items) {
          const sku = item.sku
          const quantity = item.quantity
          if (sku && quantity) {
            await supabase.rpc('deduct_stock', { target_sku: sku, quantity_to_deduct: quantity })
          }
        }
      }

      await supabase.from('activity_logs').insert({
        action: `New Shopify Order #${payload.order_number || external_order_id}. Total: ${total}, Shipping: ${shippingFee}`,
        entity_type: 'Order'
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Shopify Webhook Error:', err)
    
    try {
      await createAdminClient().from('activity_logs').insert({
        action: `Shopify Webhook Exception: ${err.message || String(err)}`,
        entity_type: 'Order'
      })
    } catch(e) {}
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
