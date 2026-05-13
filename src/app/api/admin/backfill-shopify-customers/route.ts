import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || ''
const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL || ''

const ADMIN_EMAIL = 'ahmedsayed328@gmail.com'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Unauthorized' }
  if (user.email?.toLowerCase() === ADMIN_EMAIL) return { ok: true as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role === 'admin') return { ok: true as const }
  return { ok: false as const, status: 403, error: 'Forbidden' }
}

function nameFrom(b: any) {
  if (!b) return ''
  const combined = `${b.first_name || ''} ${b.last_name || ''}`.trim()
  return combined || b.name || ''
}

async function fetchShopifyOrder(externalId: string) {
  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_SHOP_URL) {
    throw new Error('Shopify credentials not configured')
  }
  // external_order_id is usually the Shopify order name like "#1234"
  const queryName = encodeURIComponent(externalId.startsWith('#') ? externalId : `#${externalId}`)
  const res = await fetch(
    `https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/orders.json?name=${queryName}&status=any`,
    {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    return { order: null, status: res.status, error: await res.text() }
  }
  const data = await res.json()
  return { order: data.orders?.[0] || null, status: 200 }
}

// GET — returns the count of Shopify orders that still have no customer linked.
export async function GET() {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createAdminClient()
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, customers(phone_number, full_name)')
    .eq('source', 'shopify')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  const remaining = orders.filter(o => {
    if (!o.customers) return true
    const c: any = Array.isArray(o.customers) ? o.customers[0] : o.customers
    if (!c) return true
    if (!c.phone_number || c.phone_number === '-' || String(c.phone_number).trim() === '') return true
    if (c.full_name?.toLowerCase().includes('unknown')) return true
    if (c.full_name?.includes('غير معروف')) return true
    return false
  }).length

  return NextResponse.json({ remaining })
}

// POST — processes a small batch of orphaned Shopify orders.
// Body: { limit?: number }  (default 5, max 25)
export async function POST(req: NextRequest) {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 25)

  const supabase = createAdminClient()
  const { data: allOrders, error: fetchErr } = await supabase
    .from('orders')
    .select('id, external_order_id, customers(phone_number, full_name)')
    .eq('source', 'shopify')
    .not('external_order_id', 'is', null)
    .order('created_at', { ascending: false })

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!allOrders || allOrders.length === 0) {
    return NextResponse.json({ processed: 0, succeeded: 0, failed: 0, remaining: 0, results: [] })
  }

  const allOrphans = allOrders.filter(o => {
    if (!o.customers) return true
    const c: any = Array.isArray(o.customers) ? o.customers[0] : o.customers
    if (!c) return true
    if (!c.phone_number || c.phone_number === '-' || String(c.phone_number).trim() === '') return true
    if (c.full_name?.toLowerCase().includes('unknown')) return true
    if (c.full_name?.includes('غير معروف')) return true
    return false
  })

  const orphans = allOrphans.slice(0, limit)

  if (orphans.length === 0) {
    return NextResponse.json({ processed: 0, succeeded: 0, failed: 0, remaining: 0, results: [] })
  }

  const results: Array<{ orderId: string; externalId: string; status: 'ok' | 'skipped' | 'error'; reason?: string }> = []
  let succeeded = 0
  let failed = 0

  for (const orphan of orphans) {
    const externalId = orphan.external_order_id as string
    try {
      // Be polite to Shopify (rough 2 req/sec REST limit)
      await new Promise(r => setTimeout(r, 300))

      const { order: shopifyOrder, status, error } = await fetchShopifyOrder(externalId)
      if (!shopifyOrder) {
        failed++
        results.push({ orderId: orphan.id, externalId, status: 'error', reason: `Shopify ${status}${error ? `: ${error.slice(0, 120)}` : ''}` })
        continue
      }

      const customerBlock = shopifyOrder.customer || {}
      const shipping = shopifyOrder.shipping_address || {}
      const billing = shopifyOrder.billing_address || {}

      const name =
        nameFrom(customerBlock) ||
        nameFrom(shipping) ||
        nameFrom(billing) ||
        'Shopify Customer'

      const phone =
        customerBlock.phone ||
        shipping.phone ||
        billing.phone ||
        shopifyOrder.phone ||
        ''

      const addressLine = shipping.address1 || billing.address1 || ''
      const city = shipping.city || billing.city || ''
      const address = `${addressLine} ${city}`.trim()
      const governorate = shipping.province || billing.province || ''

      let customerId: string | null = null
      if (phone) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('phone_number', phone)
          .maybeSingle()
        if (existingCustomer) customerId = existingCustomer.id
      }

      if (!customerId) {
        const { data: newCustomer, error: cErr } = await supabase
          .from('customers')
          .insert({
            full_name: name,
            phone_number: phone || null,
            address: address || null,
            governorate: governorate || null,
          })
          .select('id')
          .single()
        if (cErr || !newCustomer) {
          failed++
          results.push({ orderId: orphan.id, externalId, status: 'error', reason: `Customer insert: ${cErr?.message || 'unknown'}` })
          continue
        }
        customerId = newCustomer.id
      }

      const { error: updateErr } = await supabase
        .from('orders')
        .update({ customer_id: customerId })
        .eq('id', orphan.id)

      if (updateErr) {
        failed++
        results.push({ orderId: orphan.id, externalId, status: 'error', reason: `Order update: ${updateErr.message}` })
        continue
      }

      succeeded++
      results.push({ orderId: orphan.id, externalId, status: 'ok' })
    } catch (err: any) {
      failed++
      results.push({ orderId: orphan.id, externalId, status: 'error', reason: err?.message || String(err) })
    }
  }

  // Recount how many orphans still remain
  const remaining = allOrphans.length - orphans.length

  await supabase.from('activity_logs').insert({
    action: `Shopify backfill batch: processed ${orphans.length}, ok ${succeeded}, failed ${failed}, remaining ${remaining}`,
    entity_type: 'Order',
  })

  return NextResponse.json({
    processed: orphans.length,
    succeeded,
    failed,
    remaining,
    results,
  })
}
