import { getDictionary } from '@/app/dictionaries'
import { OrdersTable } from '@/components/orders/orders-table'
import { createAdminClient } from '@/lib/supabase/server'
import { extractProductSummary } from '@/lib/order-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0


export default async function OrdersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const currentLang = lang as 'ar' | 'en'
  const dict = await getDictionary(currentLang)

  let initialOrders: any[] = []
  let debugError: string | null = null

  try {
    const supabase = createAdminClient()

    // Use select('*') so unknown/missing columns never break the query.
    const { data: rawOrders, error: rawErr } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (rawErr) {
      debugError = `DB Error: ${rawErr.message}`
    } else if (rawOrders && rawOrders.length > 0) {
      // Batch fetch all customer IDs
      const customerIds = [...new Set(rawOrders.map(o => o.customer_id).filter(Boolean))]
      let customersMap: Record<string, any> = {}

      if (customerIds.length > 0) {
        const { data: customers } = await supabase
          .from('customers')
          .select('id, full_name, phone_number, address')
          .in('id', customerIds)
        
        if (customers) {
          customers.forEach(c => { customersMap[c.id] = c })
        }
      }

      initialOrders = rawOrders.map((o: any) => {
        const cust = customersMap[o.customer_id] || {}
        const createdAt = o.created_at ? new Date(o.created_at) : null
        return {
          id: o.external_order_id || String(o.id).substring(0, 8).toUpperCase(),
          originalId: o.id,
          customer_id: o.customer_id,
          customer: cust.full_name || 'غير معروف',
          phone: cust.phone_number || '',
          address: cust.address || '',
          governorate: o.governorate || cust.governorate || '',
          source: (o.source || 'manual').toLowerCase(),
          amount: (o.total || 0),
          productAmount: o.subtotal != null ? Number(o.subtotal) : null,
          shippingAmount: o.shipping_fee != null ? Number(o.shipping_fee) : null,
          waybill_number: o.waybill_number || '',
          tracking_status: o.last_tracking_status || '',
          tracking_status_date: o.last_tracking_status_date || '',
          tracking_last_check: o.last_tracking_check || '',
          notes: o.notes || '',
          product: extractProductSummary(o.notes),
          status: (o.status || 'pending').toLowerCase(),
          whatsapp_history: o.whatsapp_history || {},
          date: createdAt ? createdAt.toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' }) : '',
          time: createdAt ? createdAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }) : '',
        }
      })
    }
  } catch (err: any) {
    debugError = `Exception: ${err?.message}`
    console.error('Orders page error:', err)
  }

  let productOptions: { id: string; sku: string; name: string; price: number }[] = []
  try {
    const supabase = createAdminClient()
    const { data: productsData } = await supabase
      .from('products')
      .select('id, sku, name_ar, name_en, base_price')
      .order('name_ar', { ascending: true })
    if (productsData) {
      productOptions = productsData.map((p: any) => ({
        id: p.id,
        sku: p.sku || '',
        name: (currentLang === 'ar' ? p.name_ar : p.name_en) || p.name_ar || p.name_en || '',
        price: Number(p.base_price || 0),
      }))
    }
  } catch (err) {
    console.error('Error fetching products for order form:', err)
  }

  let dynamicStatuses = []
  try {
    const supabase = createAdminClient()
    const { data: statusData } = await supabase.from('system_settings').select('value').eq('key', 'order_statuses').maybeSingle()
    if (statusData?.value) {
      dynamicStatuses = typeof statusData.value === 'string' ? JSON.parse(statusData.value) : statusData.value
    } else {
      dynamicStatuses = [
        { id: "pending", label_ar: "قيد المراجعة", label_en: "Pending", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
        { id: "confirmed", label_ar: "مؤكد", label_en: "Confirmed", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
        { id: "shipped", label_ar: "تم الشحن", label_en: "Shipped", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
        { id: "delivered", label_ar: "تم التوصيل", label_en: "Delivered", color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" },
        { id: "cancelled", label_ar: "ملغي", label_en: "Cancelled", color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
        { id: "returned", label_ar: "مرتجع", label_en: "Returned", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20" }
      ]
    }
  } catch (err) {
    console.error('Error fetching statuses:', err)
  }

  return (
    <div className="space-y-4">
      {debugError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-mono">
          ⚠️ {debugError}
        </div>
      )}
      <OrdersTable dict={dict} lang={currentLang} initialOrders={initialOrders} statuses={dynamicStatuses} products={productOptions} />
    </div>
  )
}
