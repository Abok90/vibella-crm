import { getDictionary } from '@/app/dictionaries'
import { JardView } from '@/components/inventory/jard-view'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SEPARATORS = ['--- ملاحظات ---', '--- من شوبيفاي ---']

function extractProductsBlock(notes: string | null | undefined): string {
  if (!notes) return ''
  let text = notes
  for (const sep of SEPARATORS) {
    const i = text.indexOf(sep)
    if (i !== -1) text = text.substring(0, i)
  }
  // strip the metadata line like "سعر المنتج: 100 | الشحن: 50"
  text = text.replace(/سعر المنتج:[^\n]*/g, '')
  text = text.replace(/الشحن:[^\n]*/g, '')
  return text.trim()
}

// Extracts a qty near the name: "x2", "×2", "* 2", "(2)", "2 ×", etc. default 1.
function extractQty(segment: string): number {
  const m = segment.match(/(?:[x×*]\s*(\d+))|(?:\((\d+)\))|(?:\b(\d+)\s*(?:قطعة|قطع|pcs?|pieces?))/i)
  if (m) {
    const n = parseInt(m[1] || m[2] || m[3] || '1', 10)
    if (!isNaN(n) && n > 0) return n
  }
  return 1
}

export default async function JardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const currentLang = lang as 'ar' | 'en'
  const dict = await getDictionary(currentLang)

  let debugError: string | null = null
  let productRows: any[] = []
  let unknownRows: { label: string; reserved: number; orders: string[] }[] = []

  try {
    const supabase = createAdminClient()

    const [{ data: products, error: pErr }, { data: orders, error: oErr }] = await Promise.all([
      supabase
        .from('products')
        .select(`id, sku, name_ar, name_en, base_price, product_variants (stock_level)`),
      supabase
        .from('orders')
        .select('*')
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: false }),
    ])

    if (pErr) debugError = `Products DB Error: ${pErr.message}`
    if (oErr) debugError = (debugError || '') + ` | Orders DB Error: ${oErr.message}`

    const productList = (products || []).map((p: any) => ({
      id: p.id,
      sku: p.sku,
      name_ar: p.name_ar || '',
      name_en: p.name_en || '',
      price: Number(p.base_price || 0),
      stock: (p.product_variants || []).reduce(
        (acc: number, v: any) => acc + (v.stock_level || 0),
        0,
      ),
      reserved_pending: 0,
      reserved_confirmed: 0,
      orders: [] as { id: string; status: string; qty: number }[],
    }))

    const unknownMap = new Map<string, { reserved: number; orders: Set<string> }>()

    for (const order of orders || []) {
      const block = extractProductsBlock(order.notes)
      if (!block) continue
      const orderLabel = order.external_order_id || String(order.id).substring(0, 8).toUpperCase()

      let matchedSomething = false

      for (const p of productList) {
        const needles = [p.name_ar, p.name_en, p.sku].filter(Boolean).map((s) => s.toLowerCase())
        const hay = block.toLowerCase()
        let found = false
        for (const needle of needles) {
          if (needle.length < 2) continue
          if (hay.includes(needle)) {
            found = true
            break
          }
        }
        if (found) {
          const qty = extractQty(block)
          if (order.status === 'pending') p.reserved_pending += qty
          else p.reserved_confirmed += qty
          p.orders.push({ id: orderLabel, status: order.status, qty })
          matchedSomething = true
        }
      }

      if (!matchedSomething) {
        // Unknown product — take first meaningful line (max 80 chars)
        const firstLine = block
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.length > 0)
        if (firstLine) {
          const label = firstLine.length > 80 ? firstLine.substring(0, 80) + '…' : firstLine
          const qty = extractQty(block)
          const existing = unknownMap.get(label) || { reserved: 0, orders: new Set<string>() }
          existing.reserved += qty
          existing.orders.add(orderLabel)
          unknownMap.set(label, existing)
        }
      }
    }

    productRows = productList
      .map((p) => {
        const reserved = p.reserved_pending + p.reserved_confirmed
        const remaining = p.stock - reserved
        let status: 'ok' | 'tight' | 'short' = 'ok'
        if (remaining < 0) status = 'short'
        else if (remaining <= 2) status = 'tight'
        return {
          id: p.id,
          sku: p.sku,
          name: currentLang === 'ar' ? p.name_ar || p.name_en : p.name_en || p.name_ar,
          price: p.price,
          stock: p.stock,
          reserved_pending: p.reserved_pending,
          reserved_confirmed: p.reserved_confirmed,
          reserved,
          remaining,
          status,
          orders: p.orders,
        }
      })
      .sort((a, b) => {
        // short → tight → ok, then by reserved desc
        const rank = { short: 0, tight: 1, ok: 2 } as const
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
        return b.reserved - a.reserved
      })

    unknownRows = Array.from(unknownMap.entries())
      .map(([label, v]) => ({ label, reserved: v.reserved, orders: Array.from(v.orders) }))
      .sort((a, b) => b.reserved - a.reserved)
  } catch (err: any) {
    debugError = `Exception: ${err?.message}`
    console.error('Jard page error:', err)
  }

  return (
    <div className="space-y-4">
      {debugError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-mono">
          ⚠️ {debugError}
        </div>
      )}
      <JardView dict={dict} lang={currentLang} products={productRows} unknowns={unknownRows} />
    </div>
  )
}
