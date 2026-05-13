import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, external_order_id, customer_id, customers(phone_number, full_name)')
    .eq('source', 'shopify')
  
  if (error) {
    console.error(error)
    return
  }

  const orphans = data.filter(o => {
    if (!o.customer_id) return true
    const c = Array.isArray(o.customers) ? o.customers[0] : o.customers
    if (!c) return true
    if (!c.phone_number || c.phone_number.trim() === '' || c.phone_number === '-') return true
    if (c.full_name?.toLowerCase().includes('unknown')) return true
    if (c.full_name?.includes('غير معروف')) return true
    return false
  })

  console.log(`Total Shopify orders: ${data.length}`)
  console.log(`Orphans: ${orphans.length}`)
}

run()
