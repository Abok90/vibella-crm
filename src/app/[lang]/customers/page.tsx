import { getDictionary } from '@/app/dictionaries'
import { createAdminClient } from '@/lib/supabase/server'
import { CustomersClient } from '@/components/customers/customers-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CustomersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const currentLang = lang as 'ar' | 'en'
  const dict = await getDictionary(currentLang)

  let customers: any[] = []
  try {
    const supabase = createAdminClient()
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    if (data) customers = data
  } catch (err) {
    console.error('Fetch failed:', err)
  }

  return (
    <CustomersClient dict={dict} lang={currentLang} initialCustomers={customers} />
  )
}
