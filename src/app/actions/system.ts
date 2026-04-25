'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getSystemSettingAction(key: string) {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (error) {
      console.error(`Error getting setting ${key}:`, error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data?.value || null }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function updateSystemSettingAction(key: string, value: any) {
  try {
    const supabase = createAdminClient()
    
    // UPSERT the setting
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })

    if (error) {
      console.error(`Error updating setting ${key}:`, error)
      return { success: false, error: error.message }
    }

    // Revalidate relevant pages
    revalidatePath('/', 'layout')
    
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}
