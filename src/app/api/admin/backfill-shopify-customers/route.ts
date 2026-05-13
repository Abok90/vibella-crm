import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || ''
const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL || ''

const ADMIN_EMAIL = 'ahmedsayed328@gmail.com'

type Mode = 'orphans' | 'all'

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

function nonEmpty(v: any) {
  return typeof v === 'string' && v.trim().length > 0
}

async function fetchShopifyOrder(externalId: string) {
  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_SHOP_URL) {
    throw new Error('Shopify credentials not configured')
  }
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

// GET — returns counts for both modes so the UI can pick.
// Query: ?mode=orphans|all (default: orphans, controls which count is "remaining")
export async function GET(req: NextRequest) {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(req.url)
  const mode: Mode = searchParams.get('mode') === 'all' ? 'all' : 'orphans'

  const credsConfigured = Boolean(SHOPIFY_ACCESS_TOKEN && SHOPIFY_SHOP_URL)

  const supabase = createAdminClient()
  const [orphansRes, totalRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'shopify')
      .is('customer_id', null),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'shopify')
      .not('external_order_id', 'is', null),
  ])

  if (orphansRes.error) return NextResponse.json({ error: orphansRes.error.message }, { status: 500 })
  if (totalRes.error) return NextResponse.json({ error: totalRes.error.message }, { status: 500 })

  const orphans = orphansRes.count || 0
  const total = totalRes.count || 0
  return NextResponse.json({
    mode,
    orphans,
    total,
    remaining: mode === 'all' ? total : orphans,
    credsConfigured,
    missingEnv: credsConfigured
      ? []
      : [
          ...(!SHOPIFY_ACCESS_TOKEN ? ['SHOPIFY_ACCESS_TOKEN'] : []),
          ...(!SHOPIFY_SHOP_URL ? ['SHOPIFY_SHOP_URL'] : []),
        ],
  })
}

// POST — processes a batch of Shopify orders.
// Body: {
//   limit?: number,     // default 5, max 25
//   mode?: Mode,        // 'orphans' (default) or 'all'
//   before?: string     // ISO timestamp cursor (resync mode only)
// }
export async function POST(req: NextRequest) {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 25)
  const mode: Mode = body.mode === 'all' ? 'all' : 'orphans'
  const before: string | null = typeof body.before === 'string' ? body.before : null

  const supabase = createAdminClient()

  let query = supabase
    .from('orders')
    .select('id, external_order_id, customer_id, created_at')
    .eq('source', 'shopify')
    .not('external_order_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (mode === 'orphans') {
    query = query.is('customer_id', null)
  } else if (before) {
    query = query.lt('created_at', before)
  }

  const { data: orders, error: fetchErr } = await query

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!orders || orders.length === 0) {
    return NextResponse.json({
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 0,
      nextCursor: null,
      results: [],
    })
  }

  const results: Array<{ orderId: string; externalId: string; status: 'ok' | 'skipped' | 'error'; reason?: string }> = []
  let succeeded = 0
  let failed = 0
  let nextCursor: string | null = null

  for (const order of orders) {
    const externalId = order.external_order_id as string
    nextCursor = order.created_at as string // last iteration wins = oldest in this batch
    try {
      await new Promise(r => setTimeout(r, 300)) // ~3 req/sec to Shopify

      const { order: shopifyOrder, status, error } = await fetchShopifyOrder(externalId)
      if (!shopifyOrder) {
        failed++
        results.push({
          orderId: order.id,
          externalId,
          status: 'error',
          reason: `Shopify ${status}${error ? `: ${error.slice(0, 120)}` : ''}`,
        })
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

      let customerId: string | null = (order.customer_id as string | null) || null
      let action: 'linked-existing' | 'created-new' | 'updated-existing' = 'created-new'

      if (customerId) {
        // Order already has a customer — refresh only EMPTY fields, don't overwrite.
        const { data: existing } = await supabase
          .from('customers')
          .select('id, full_name, phone_number, address, governorate')
          .eq('id', customerId)
          .maybeSingle()

        if (existing) {
          const patch: Record<string, any> = {}
          if (!nonEmpty(existing.full_name) || existing.full_name === 'Unknown Customer') {
            if (nonEmpty(name)) patch.full_name = name
          }
          if (!nonEmpty(existing.phone_number) && nonEmpty(phone)) patch.phone_number = phone
          if (!nonEmpty(existing.address) && nonEmpty(address)) patch.address = address
          if (!nonEmpty(existing.governorate) && nonEmpty(governorate)) patch.governorate = governorate

          if (Object.keys(patch).length > 0) {
            const { error: upErr } = await supabase.from('customers').update(patch).eq('id', customerId)
            if (upErr) {
              failed++
              results.push({ orderId: order.id, externalId, status: 'error', reason: `Customer update: ${upErr.message}` })
              continue
            }
            action = 'updated-existing'
          } else {
            // Nothing to do — customer already has good data
            results.push({ orderId: order.id, externalId, status: 'skipped', reason: 'customer already complete' })
            continue
          }
        } else {
          // Dangling customer_id (referenced row was deleted) — fall through and re-link
          customerId = null
        }
      }

      if (!customerId) {
        // Try by phone first
        if (phone) {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('phone_number', phone)
            .maybeSingle()
          if (existingCustomer) {
            customerId = existingCustomer.id
            action = 'linked-existing'
          }
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
            results.push({ orderId: order.id, externalId, status: 'error', reason: `Customer insert: ${cErr?.message || 'unknown'}` })
            continue
          }
          customerId = newCustomer.id
          action = 'created-new'
        }

        const { error: updateErr } = await supabase
          .from('orders')
          .update({ customer_id: customerId })
          .eq('id', order.id)

        if (updateErr) {
          failed++
          results.push({ orderId: order.id, externalId, status: 'error', reason: `Order update: ${updateErr.message}` })
          continue
        }
      }

      succeeded++
      results.push({ orderId: order.id, externalId, status: 'ok', reason: action })
    } catch (err: any) {
      failed++
      results.push({ orderId: order.id, externalId, status: 'error', reason: err?.message || String(err) })
    }
  }

  // Compute the appropriate "remaining" for the current mode.
  let remaining = 0
  if (mode === 'orphans') {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'shopify')
      .is('customer_id', null)
    remaining = count || 0
  } else if (nextCursor) {
    // How many orders are still older than the cursor (i.e. unvisited in this run).
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'shopify')
      .not('external_order_id', 'is', null)
      .lt('created_at', nextCursor)
    remaining = count || 0
  }

  await supabase.from('activity_logs').insert({
    action: `Shopify backfill (${mode}): processed ${orders.length}, ok ${succeeded}, failed ${failed}, remaining ${remaining}`,
    entity_type: 'Order',
  })

  return NextResponse.json({
    processed: orders.length,
    succeeded,
    failed,
    remaining,
    nextCursor,
    results,
  })
}
