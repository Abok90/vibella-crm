/**
 * Shared utilities for parsing order notes and matching products.
 * Used by: Dashboard (page.tsx), Orders (page.tsx), Jard inventory audit (page.tsx)
 */

export const PRODUCT_SEPARATORS = ['--- ملاحظات ---', '--- من شوبيفاي ---']

/** Extract the product-info part of the notes (before separators) */
export function extractProductBlock(notes: string | null | undefined): string {
  if (!notes) return ''
  let text = notes
  for (const sep of PRODUCT_SEPARATORS) {
    const i = text.indexOf(sep)
    if (i !== -1) text = text.substring(0, i)
  }
  text = text.replace(/سعر المنتج:[^\n]*/g, '').replace(/الشحن:[^\n]*/g, '')
  return text.trim()
}

/** Extract product summary for display (strips metadata lines) */
export function extractProductSummary(notes: string | null | undefined): string {
  if (!notes) return ''
  let text = notes
  for (const sep of PRODUCT_SEPARATORS) {
    const i = text.indexOf(sep)
    if (i !== -1) text = text.substring(0, i)
  }
  text = text
    .replace(/سعر المنتج:[^\n|]*/g, '')
    .replace(/الشحن:[^\n|]*/g, '')
    .replace(/\|+/g, ' ')
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join(' · ')
    .trim()
}

/** Parse metadata from notes: product price, shipping, product count */
export function parseOrderNotes(notes: string | null | undefined) {
  if (!notes) return { productAmount: 0, shippingAmount: 0, productCount: 0 }
  let text = notes
  for (const sep of PRODUCT_SEPARATORS) {
    const i = text.indexOf(sep)
    if (i !== -1) text = text.substring(0, i)
  }
  const priceMatch = text.match(/سعر المنتج:\s*([\d.]+)/)
  const shipMatch = text.match(/الشحن:\s*([\d.]+)/)
  const productAmount = priceMatch ? parseFloat(priceMatch[1]) || 0 : 0
  const shippingAmount = shipMatch ? parseFloat(shipMatch[1]) || 0 : 0

  const cleaned = text
    .replace(/سعر المنتج:[^\n|]*/g, '')
    .replace(/الشحن:[^\n|]*/g, '')
    .replace(/\|+/g, '\n')
  const productCount = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0).length

  return { productAmount, shippingAmount, productCount }
}

/** Extract quantity near a product name: "x2", "×2", "* 2", "(2)", etc. Default 1 */
export function extractQty(segment: string): number {
  const m = segment.match(/(?:[x×*]\s*(\d+))|(?:\((\d+)\))|(?:\b(\d+)\s*(?:قطعة|قطع|pcs?|pieces?))/i)
  if (m) {
    const n = parseInt(m[1] || m[2] || m[3] || '1', 10)
    if (!isNaN(n) && n > 0) return n
  }
  return 1
}

/** Egyptian Governorates — 27 محافظة */
export const EGYPT_GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية',
  'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد',
  'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'الفيوم',
  'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان',
  'البحر الأحمر', 'الوادي الجديد', 'مطروح',
]
