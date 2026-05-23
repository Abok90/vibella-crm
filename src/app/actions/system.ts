'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSystemControl, type SystemControl } from '@/lib/system-status'
import { isUserAdmin } from '@/lib/admin-check'

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

export async function getSystemControlAction() {
  try {
    const control = await getSystemControl()
    return { success: true, data: control }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function setSystemEnabledAction(
  enabled: boolean,
  messages?: { message_ar?: string; message_en?: string }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !(await isUserAdmin(user))) {
      return { success: false, error: 'غير مصرح — المدير فقط' }
    }

    const admin = createAdminClient()
    const current = await getSystemControl()
    const value: SystemControl = {
      enabled,
      message_ar: messages?.message_ar ?? current.message_ar,
      message_en: messages?.message_en ?? current.message_en,
      disabled_at: enabled ? null : new Date().toISOString(),
    }

    const { error } = await admin
      .from('system_settings')
      .upsert({ key: 'system_control', value, updated_at: new Date().toISOString() })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/', 'layout')
    return { success: true, data: value }
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
