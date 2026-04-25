import { getDictionary } from '@/app/dictionaries'
import { AccountingDashboard } from '@/components/accounting/accounting-dashboard'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AccountingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const currentLang = lang as 'ar' | 'en'
  const dict = await getDictionary(currentLang)

  let transactions: any[] = []
  let debugError: string | null = null

  try {
    const supabase = createAdminClient()

    // Fetch everything with select('*') - no column assumptions
    const { data, error } = await supabase
      .from('transactions')
      .select('*')

    if (error) {
      debugError = `DB Error: ${error.message}`
    } else if (data) {
      transactions = data.map((t: any) => ({
        id: t.id,
        type: t.type || 'expense',
        category: t.category || '',
        amount: (t.amount || 0).toString(),
        date: t.transaction_date 
          ? t.transaction_date 
          : (t.created_at ? new Date(t.created_at).toLocaleDateString('en-CA') : ''),
        notes: t.notes || ''
      }))
    }
  } catch (err: any) {
    debugError = `Exception: ${err?.message}`
    console.error('Accounting page error:', err)
  }

  let dynamicCategories = []
  try {
    const supabase = createAdminClient()
    const { data: catData } = await supabase.from('system_settings').select('value').eq('key', 'accounting_categories').maybeSingle()
    if (catData?.value) {
      dynamicCategories = typeof catData.value === 'string' ? JSON.parse(catData.value) : catData.value
    } else {
      dynamicCategories = [
        { id: "salary", label_ar: "رواتب", label_en: "Salaries", type: "expense" },
        { id: "marketing", label_ar: "تسويق", label_en: "Marketing", type: "expense" },
        { id: "shipping", label_ar: "شحن ومراسلات", label_en: "Shipping", type: "expense" },
        { id: "rent", label_ar: "إيجار", label_en: "Rent", type: "expense" },
        { id: "supplies", label_ar: "مستلزمات", label_en: "Supplies", type: "expense" },
        { id: "other", label_ar: "أخرى", label_en: "Other", type: "expense" }
      ]
    }
  } catch (err) {
    console.error('Error fetching categories:', err)
  }

  return (
    <div className="space-y-4">
      {debugError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-mono">
          ⚠️ {debugError}
        </div>
      )}
      <AccountingDashboard dict={dict} lang={currentLang} initialTransactions={transactions} categories={dynamicCategories} />
    </div>
  )
}
