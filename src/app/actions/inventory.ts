'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteProductAction(productId: string) {
  try {
    const supabase = createAdminClient()
    // Delete variants first (foreign key)
    await supabase.from('product_variants').delete().eq('product_id', productId)
    const { error } = await supabase.from('products').delete().eq('id', productId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/[lang]/inventory', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function createProductAction(data: {
  name_ar: string
  name_en: string
  base_price: number
  cost_price: number
  description_ar?: string
  description_en?: string
  variants: Array<{
    size: string
    color: string
    weight: number
    stock_level: number
    image_url?: string
  }>
}) {
  try {
    const supabase = createAdminClient()

    const uniqueSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    const generatedSku = `ELT-${uniqueSuffix}`

    const productPayload: Record<string, any> = {
      name_ar: data.name_ar,
      name_en: data.name_en,
      sku: generatedSku,
      base_price: data.base_price,
      cost_price: data.cost_price,
      description_ar: data.description_ar || null,
      description_en: data.description_en || null,
      status: 'inStock'
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert(productPayload)
      .select('id')
      .single()

    if (productError || !product) {
      return { success: false, error: `فشل إضافة المنتج: ${productError?.message}` }
    }

    if (data.variants && data.variants.length > 0) {
      const variantsToInsert = data.variants.map(v => ({
        product_id: product.id,
        size: v.size || '',
        color: v.color || '',
        weight: v.weight || 0,
        stock_level: v.stock_level || 0,
        image_url: v.image_url || null
      }))

      await supabase.from('product_variants').insert(variantsToInsert)
    }

    try {
      await supabase.from('activity_logs').insert({
        action: `تم إضافة منتج جديد: ${data.name_ar || data.name_en}`,
        entity_type: 'Product'
      })
    } catch (e) {
      console.error('activity_logs insert failed:', e)
    }

    revalidatePath('/[lang]/inventory', 'page')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'حدث خطأ غير متوقع' }
  }
}

export async function updateCostPriceAction(productId: string, costPrice: number) {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('products')
      .update({ cost_price: costPrice })
      .eq('id', productId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/[lang]/inventory', 'page')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'حدث خطأ' }
  }
}
