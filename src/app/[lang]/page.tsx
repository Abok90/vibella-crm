import { getDictionary } from '@/app/dictionaries'
import { createAdminClient } from '@/lib/supabase/server'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { extractProductBlock, extractQty, parseOrderNotes } from '@/lib/order-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ProductRef = {
  name_ar: string
  name_en: string
  sku: string
  cost_price: number
}


// Noise words to strip for matching (colors, variants, etc.)
const NOISE = new Set([
  'free', 'default', 'os', 'x', '1x', '2x', '3x', '4x', '5x',
  'black', 'white', 'red', 'blue', 'green', 'brown', 'beige', 'burgundy',
  'pink', 'navy', 'grey', 'gray', 'cream', 'camel', 'khaki', 'olive',
  'baby', 'dark', 'light', 'size', 'color', 'colour',
  'أسود', 'أبيض', 'أحمر', 'أزرق', 'بني', 'بيج', 'زيتي', 'كحلي', 'وردي',
])

/** Extract significant words from a string (skip noise & short words) */
function coreWords(text: string): string[] {
  return text
    .replace(/[-–|/\\()×*]/g, ' ')
    .split(/\s+/)
    .map(w => w.toLowerCase().trim())
    .filter(w => w.length >= 2 && !NOISE.has(w))
}

/** Score how well a product matches a line of text (0 = no match) */
function matchScore(productName: string, lineText: string): number {
  if (!productName || productName.length < 2) return 0
  const pLower = productName.toLowerCase()
  const lineLower = lineText.toLowerCase()
  // Exact substring match = highest score
  if (lineLower.includes(pLower)) return 100

  // Word-level matching
  const pw = coreWords(productName)
  if (pw.length === 0) return 0
  const lw = coreWords(lineText)
  const hits = pw.filter(w => lw.includes(w) || lineLower.includes(w))

  // Need at least 2 matching words (or all if product has only 1 word)
  if (pw.length === 1 && hits.length === 1) return hits.length
  if (hits.length < 2) return 0

  // CRITICAL: Numbers (01, 02, 03, etc.) must match
  // If the product name has a number and it's NOT in the text, reject
  const productNumbers: string[] = pLower.match(/\b(\d{1,3})\b/g) ?? []
  const lineNumbers: string[] = lineLower.match(/\b(\d{1,3})\b/g) ?? []
  for (const num of productNumbers) {
    // Skip qty-like numbers (1, 2, 3 are too generic — only enforce 2+ digit nums)
    if (num.length >= 2 && !lineNumbers.includes(num)) {
      return 0 // Number mismatch = not the right product
    }
  }

  return hits.length
}

/**
 * Calculate COGS for an order:
 * - Split notes into lines (also split on "+")
 * - For each line, find the BEST matching product (highest score)
 * - Sum cost_price × qty per line
 * - Each product can match at most once per order
 */
function calcOrderCost(notes: string | null | undefined, productList: ProductRef[]): number {
  const block = extractProductBlock(notes)
  if (!block || productList.length === 0) return 0

  // Split by newlines AND "+" (multi-product orders like "1x Elite set 01 + 1x Elite set 02")
  const lines = block
    .split(/[\n+]/)
    .map(l => l.trim())
    .filter(l => l.length > 2)

  let totalCost = 0
  const usedProducts = new Set<number>()

  for (const line of lines) {
    let bestIdx = -1
    let bestScore = 0

    // Find the best product match for this line
    for (let pi = 0; pi < productList.length; pi++) {
      if (usedProducts.has(pi)) continue
      const p = productList[pi]
      // Check all identifiers: name_ar, name_en, sku
      for (const id of [p.name_ar, p.name_en, p.sku]) {
        const s = matchScore(id, line)
        if (s > bestScore) {
          bestScore = s
          bestIdx = pi
        }
      }
    }

    // Only accept if we have a meaningful match
    if (bestIdx >= 0 && bestScore >= 2) {
      const qty = extractQty(line)
      totalCost += productList[bestIdx].cost_price * qty
      usedProducts.add(bestIdx)
    }
  }

  return totalCost
}

export default async function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const currentLang = lang as 'ar' | 'en'
  const dict = await getDictionary(currentLang)

  let orders: any[] = []
  let lowStockCount = 0

  try {
    const supabase = createAdminClient()

    const [{ data: rawOrders }, { data: rawProducts }, { data: variants }] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name_ar, name_en, sku, base_price, cost_price'),
      supabase.from('product_variants').select('stock_level'),
    ])

    // Build product lookup
    const productList: ProductRef[] = (rawProducts || []).map((p: any) => ({
      name_ar: (p.name_ar || '').toLowerCase(),
      name_en: (p.name_en || '').toLowerCase(),
      sku: (p.sku || '').toLowerCase(),
      cost_price: Number(p.cost_price || 0),
    }))

    if (rawOrders) {
      orders = rawOrders.map((o: any) => {
        const parsed = parseOrderNotes(o.notes)
        const total = Number(o.total || 0)
        const hasSplit = Number(o.subtotal) > 0 || Number(o.shipping_fee) > 0
        const productAmount = hasSplit
          ? Number(o.subtotal || 0)
          : parsed.productAmount > 0
            ? parsed.productAmount
            : total
        const shippingAmount = hasSplit
          ? Number(o.shipping_fee || 0)
          : parsed.shippingAmount

        const costAmount = calcOrderCost(o.notes, productList)

        return {
          id: o.id,
          total,
          status: (o.status || 'pending').toLowerCase(),
          source: (o.source || 'manual').toLowerCase(),
          created_at: o.created_at,
          date: o.created_at ? o.created_at.split('T')[0] : null,
          productAmount,
          shippingAmount,
          costAmount,
          productCount: parsed.productCount || 1,
        }
      })
    }

    if (variants) lowStockCount = variants.filter((v: any) => (v.stock_level || 0) < 5).length
  } catch (err) {
    console.error('Dashboard fetch error:', err)
  }

  let statuses: { id: string; label_ar: string; label_en: string; color: string }[] = []
  try {
    const supabase = createAdminClient()
    const { data: statusData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'order_statuses')
      .maybeSingle()
    if (statusData?.value) {
      statuses =
        typeof statusData.value === 'string' ? JSON.parse(statusData.value) : statusData.value
    }
  } catch (err) {
    console.error('Dashboard statuses error:', err)
  }
  if (!statuses || statuses.length === 0) {
    statuses = [
      { id: 'pending', label_ar: 'قيد المراجعة', label_en: 'Pending', color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' },
      { id: 'confirmed', label_ar: 'مؤكد', label_en: 'Confirmed', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
      { id: 'shipped', label_ar: 'تم الشحن', label_en: 'Shipped', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
      { id: 'delivered', label_ar: 'تم التوصيل', label_en: 'Delivered', color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
      { id: 'cancelled', label_ar: 'ملغي', label_en: 'Cancelled', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
      { id: 'returned', label_ar: 'مرتجع', label_en: 'Returned', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20' },
    ]
  }

  return (
    <DashboardView
      dict={dict}
      lang={currentLang}
      orders={orders}
      statuses={statuses}
      lowStockCount={lowStockCount}
    />
  )
}
