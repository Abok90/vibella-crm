// Test file — configure via environment variables before running
// Usage: SHOPIFY_ACCESS_TOKEN=xxx SHOPIFY_SHOP_URL=xxx node test-cancel.js

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL || '';

async function testStatus() {
  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_SHOP_URL) {
    return console.log('Set SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_URL env vars first');
  }
  const res = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders.json?status=any`, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if(!data.orders || data.orders.length === 0) return console.log('no orders');
  
  const order = data.orders[0];
  console.log('Order:', order.id, order.name, order.financial_status, order.fulfillment_status);

  const cancelRes = await fetch(`https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders/${order.id}/cancel.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  console.log('Cancel Status:', cancelRes.status, await cancelRes.text());
}
testStatus();
