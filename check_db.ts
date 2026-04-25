import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('orders').select('*').limit(1)
  console.log('Orders ok:', !error);
  
  // Try to create a table using rest API? No, REST API doesn't support DDL.
}

main()
