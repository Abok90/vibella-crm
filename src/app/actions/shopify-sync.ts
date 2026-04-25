'use server'

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || ''
const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL || ''

async function getShopifyOrderId(name: string) {
  const queryName = encodeURIComponent(name.startsWith('#') ? name : `#${name}`)
  const res = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders.json?name=${queryName}&status=any`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' }
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.orders && data.orders.length > 0 ? data.orders[0].id : null
}

export async function syncOrderUpdateToShopify(externalOrderId: string, updates: { status?: string, notes?: string }) {
  try {
    const shopifyId = await getShopifyOrderId(externalOrderId)
    if (!shopifyId) {
      console.log('Shopify sync error: order not found for', externalOrderId)
      return { success: false, error: 'Order not found in Shopify' }
    }

    let hasUpdates = false

    // 1. Update Notes
    if (updates.notes !== undefined) {
      const res = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders/${shopifyId}.json`, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order: { id: shopifyId, note: updates.notes }
        })
      })
      if (!res.ok) console.error('Failed to update notes', await res.text())
      else hasUpdates = true
    }

    // 2. Update Status
    if (updates.status) {
      const st = updates.status.toLowerCase()
      
      // Cancellation — ONLY for actual cancellation, NOT returns
      if (st === 'cancelled' || st === 'ملغي' || st.includes('cancel') || st.includes('إلغاء')) {
        const res = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders/${shopifyId}/cancel.json`, {
          method: 'POST',
          headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
        if (res.ok) hasUpdates = true
        else console.error('Cancel error:', await res.text())
      }

      // Returned — add a note on Shopify, do NOT cancel
      if (st === 'returned' || st === 'مرتجع' || st.includes('return') || st.includes('مرتجع')) {
        const res = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders/${shopifyId}.json`, {
          method: 'PUT',
          headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: { id: shopifyId, tags: 'returned,مرتجع' } })
        })
        if (res.ok) hasUpdates = true
      }
      
      // Fulfillment (Shipped / Delivered)
      if (st === 'shipped' || st === 'delivered' || st === 'collected' || st.includes('شحن') || st.includes('توصيل')) {
        const foRes = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders/${shopifyId}/fulfillment_orders.json`, {
          method: 'GET',
          headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' }
        })
        
        if (foRes.ok) {
          const foData = await foRes.json()
          if (foData.fulfillment_orders) {
            let fulfilled = false
            for (const fo of foData.fulfillment_orders) {
              if (fo.status === 'open' || fo.status === 'in_progress') {
                const fRes = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/fulfillments.json`, {
                  method: 'POST',
                  headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fulfillment: {
                      line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }]
                    }
                  })
                })
                if (fRes.ok) fulfilled = true
                else console.error('Fulfillment error:', await fRes.text())
              }
            }
            if (fulfilled) hasUpdates = true
          }
        } else {
          console.error('Fulfillment orders error:', await foRes.text())
        }
      }

      // Payment Capture (Collection)
      if (st === 'delivered' || st === 'collected' || st.includes('تحصيل') || st.includes('توصيل')) {
        // Attempt to create a standard monetary transaction to mark as paid
        const orderRes = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders/${shopifyId}.json`, {
           headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' }
        })
        
        if (orderRes.ok) {
           const oData = await orderRes.json()
           if (oData.order && oData.order.financial_status !== 'paid') {
              const capRes = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders/${shopifyId}/transactions.json`, {
                method: 'POST',
                headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  transaction: { kind: 'capture', status: 'success', amount: oData.order.total_price, currency: oData.order.currency }
                })
              })
              if (!capRes.ok) console.error('Capture error:', await capRes.text())
              else hasUpdates = true
           }
        } else {
          console.error('Fetch order for capture error:', await orderRes.text())
        }
      }

      // Revert to Pending / Unfulfilled
      if (st === 'pending' || st === 'new' || st.includes('مراجعة') || st.includes('جديد')) {
        const fullsRes = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders/${shopifyId}/fulfillments.json`, {
          method: 'GET',
          headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' }
        })
        
        if (fullsRes.ok) {
          const fData = await fullsRes.json()
          if (fData.fulfillments && fData.fulfillments.length > 0) {
            let unfulfilled = false
            for (const f of fData.fulfillments) {
              if (f.status === 'success' || f.status === 'pending') {
                const cancelRes = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/fulfillments/${f.id}/cancel.json`, {
                  method: 'POST',
                  headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' },
                  body: JSON.stringify({})
                })
                if (cancelRes.ok) unfulfilled = true
                else console.error('Unfulfill error:', await cancelRes.text())
              }
            }
            if (unfulfilled) hasUpdates = true
          }
        }
      }
    }

    return { success: hasUpdates }
  } catch (err: any) {
    console.error('Shopify Sync Exception:', err)
    return { success: false, error: err.message }
  }
}
