import { getDictionary } from '@/app/dictionaries'
import { InventoryTable } from '@/components/inventory/inventory-table'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InventoryPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const currentLang = lang as 'ar' | 'en'
  const dict = await getDictionary(currentLang)

  let formattedProducts: any[] = []
  let debugError: string | null = null

  try {
    const supabase = createAdminClient()
    
    // Fetch products and their variants to calculate total stock
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        sku,
        name_ar,
        name_en,
        base_price,
        cost_price,
        status,
        product_variants (
          stock_level
        )
      `)

    if (error) {
      debugError = `DB Error: ${error.message}`
      console.error('Inventory fetch error:', error.message)
    } else if (products) {
      // Aggregate stock dynamically
      formattedProducts = products.map(p => {
        const totalStock = p.product_variants.reduce((acc: number, v: any) => acc + (v.stock_level || 0), 0)
        let status = p.status
        if (totalStock === 0) status = 'outOfStock'
        else if (totalStock < 3) status = 'lowStock'
        else status = 'inStock'

        return {
          id: p.id,
          sku: p.sku,
          name: currentLang === 'ar' ? p.name_ar : p.name_en,
          price: `EGP ${p.base_price}`,
          cost: `EGP ${p.cost_price || 0}`,
          costPrice: Number(p.cost_price || 0),
          stock: totalStock,
          status: status,
          img: ''
        }
      })
    }
  } catch (err: any) {
    debugError = `Exception: ${err?.message}`
    console.error('Inventory page error:', err)
  }

  return (
    <div className="space-y-4">
      {debugError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-mono">
          ⚠️ {debugError}
        </div>
      )}
      <InventoryTable dict={dict} lang={currentLang} initialProducts={formattedProducts} />
    </div>
  )
}
