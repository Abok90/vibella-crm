'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || ''
const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL || ''

export async function syncShopifyInventoryAction(options: { mode: 'all' | 'single', productIdOrName?: string }) {
  try {
    const supabase = createAdminClient()
    let endpoint = ''

    if (options.mode === 'single' && options.productIdOrName) {
      const queryName = encodeURIComponent(options.productIdOrName.trim())
      // Check if it's purely a numeric ID or a title
      if (/^\d+$/.test(options.productIdOrName)) {
        endpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/products/${queryName}.json`
      } else {
        endpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/products.json?title=${queryName}`
      }
    } else {
      endpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2024-01/products.json?limit=250&status=active`
    }

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.statusText}`)
    }

    const data = await res.json()
    let productsToSync = []

    if (data.product) {
      // Endpoint was /products/ID.json
      productsToSync = [data.product]
    } else if (data.products && data.products.length > 0) {
      // Endpoint was /products.json
      productsToSync = data.products
    } else {
      return { error: 'لم يتم العثور على منتجات بهذا التطابق في شوبيفاي' }
    }

    let syncedCount = 0
    let updatedCount = 0

    // Loop through retrieved Shopify products
    for (const sp of productsToSync) {
      const title = sp.title
      const body_html = sp.body_html || ''
      
      // 1. Check if product exists physically by title or by Shopify ID as SKU
      const productSku = sp.id ? `SHP-${sp.id}` : ''
      const { data: existingLocalProducts } = await supabase
        .from('products')
        .select('id')
        .or(`sku.eq.${productSku},name_ar.ilike.%${title}%,name_en.ilike.%${title}%`)
        .limit(1)
        
      let localProductId = null

      if (existingLocalProducts && existingLocalProducts.length > 0) {
        localProductId = existingLocalProducts[0].id
        updatedCount++
      } else {
        // Create new product
        // Determine a base price. If multiple variants, use the first one's price
        const base_price = sp.variants && sp.variants.length > 0 ? parseFloat(sp.variants[0].price) || 0 : 0
        const generatedSku = `SHP-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
        const { data: newLocalProduct, error: prodErr } = await supabase.from('products').insert({
          name_ar: title,
          name_en: title,
          sku: sp.id ? `SHP-${sp.id}` : generatedSku,
          base_price: base_price,
          cost_price: 0,
          status: 'inStock'
        }).select('id').single()

        if (prodErr) {
          console.error('Error inserting product:', prodErr)
          continue
        }
        if (newLocalProduct) {
          localProductId = newLocalProduct.id
          syncedCount++
        }
      }

      if (!localProductId) continue

      // 2. Sync variants
      if (sp.variants && Array.isArray(sp.variants)) {
        for (const variant of sp.variants) {
          // Because user indicated no SKU is used, we must identify variants by Size and Color combinations!
          // Shopify usually puts Size in option1 and Color in option2 (or vice versa). We will map them accordingly.
          const size = variant.option1 && variant.option1 !== 'Default Title' ? variant.option1 : 'OS'
          const color = variant.option2 ? variant.option2 : 'Default'
          const stock = variant.inventory_quantity !== undefined ? parseInt(variant.inventory_quantity) : 0
          const weight = variant.weight ? parseFloat(variant.weight) : 0
          
          let imgUrl = ''
          if (variant.image_id && sp.images) {
            const imgMatch = sp.images.find((i: any) => i.id === variant.image_id)
            if (imgMatch) imgUrl = imgMatch.src
          } else if (sp.images && sp.images.length > 0) {
            imgUrl = sp.images[0].src
          }

          // Check if variant exists
          const { data: existingVariant } = await supabase.from('product_variants').select('id, image_url').match({
             product_id: localProductId,
             size: size,
             color: color
          }).maybeSingle()

          if (existingVariant) {
            await supabase.from('product_variants').update({
              stock_level: stock,
              weight: weight,
              image_url: imgUrl || existingVariant.image_url
            }).eq('id', existingVariant.id)
            updatedCount++
          } else {
            // Only create NEW variants if they have stock > 0
            if (stock > 0) {
              const { error: varErr } = await supabase.from('product_variants').insert({
                product_id: localProductId,
                size: size,
                color: color,
                stock_level: stock,
                weight: weight,
                image_url: imgUrl
              })
              if (varErr) console.error('Variant insert error:', varErr.message, { localProductId, size, color })
            }
          }
        }
      }
    }

    revalidatePath('/[lang]/inventory', 'page')
    
    if (syncedCount === 0 && updatedCount === 0) {
      return { error: 'تم قراءة الملفات من شوبيفاي، ولكن فشل إدخالها في السيرفر بسبب نقص في بيانات المنتج أو خطأ.' }
    }

    return { 
      success: true, 
      message: options.mode === 'all' 
        ? `تم مزامنة ${productsToSync.length} منتج بنجاح! (نظام: ${syncedCount} إضافة جديدة، ${updatedCount} تحديث)` 
        : `تم جلب المنتج بنجاح وتحديث كافة تفاصيله!`
    }
  } catch (err: any) {
    console.error('Inventory Sync Error:', err)
    return { error: err.message || 'حدث خطأ أثناء الاتصال بشوبيفاي' }
  }
}
