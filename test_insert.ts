import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('products').insert({
    name_ar: 'Test Product',
    name_en: 'Test Product',
    base_price: 100,
    cost_price: 50
  }).select()

  console.log('Result:', data)
  console.log('Error:', error)
}

test()
