import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'ahmedsayed328@gmail.com'

export function isSuperAdminEmail(email?: string | null): boolean {
  return email?.toLowerCase() === SUPER_ADMIN_EMAIL
}

export async function isUserAdmin(user: User | null): Promise<boolean> {
  if (!user) return false
  if (isSuperAdminEmail(user.email)) return true

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return profile?.role === 'admin'
}
