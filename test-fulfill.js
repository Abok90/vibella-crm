// Test file — configure via environment variables before running
// Usage: SHOPIFY_ACCESS_TOKEN=xxx SHOPIFY_SHOP_URL=xxx node test-fulfill.js

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL || '';

async function testFulfill() {
  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_SHOP_URL) {
    return console.log('Set SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_URL env vars first');
  }
  const res = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders.json?status=any&fulfillment_status=unfulfilled`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  const order = data.orders.find(o => o.financial_status === 'pending' && !o.cancelled_at);
  if (!order) return console.log('no unfulfilled order');
  console.log('Order to fulfill:', order.id, order.name);

  const foRes = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders/${order.id}/fulfillment_orders.json`, {
    method: 'GET',
    headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' }
  });
  const foData = await foRes.json();
  console.log('FO Data:', JSON.stringify(foData, null, 2));

  if (foData.fulfillment_orders) {
    for (const fo of foData.fulfillment_orders) {
      if (fo.status === 'open' || fo.status === 'in_progress') {
        const createRes = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/fulfillments.json`, {
          method: 'POST',
          headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fulfillment: { line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }] } })
        });
        console.log('Fulfill status:', createRes.status, await createRes.text());
      }
    }
  }
}
testFulfill();
