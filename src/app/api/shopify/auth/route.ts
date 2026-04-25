import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const shop = 'elite-eg-2.myshopify.com';
  const clientId = 'aa890fa56ce551581f9bd9f54c7b92da';
  const redirectUri = `${new URL(request.url).origin}/api/shopify/callback`;
  const scopes = 'read_orders,write_orders,read_customers,write_customers,read_fulfillments,write_fulfillments,write_inventory,read_inventory,write_inventory_shipments,read_inventory_shipments,read_merchant_managed_fulfillment_orders,write_merchant_managed_fulfillment_orders,write_order_edits,read_order_edits,read_returns,write_returns,read_third_party_fulfillment_orders,write_third_party_fulfillment_orders';

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}`;
  return NextResponse.redirect(installUrl);
}
