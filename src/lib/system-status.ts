import { createAdminClient } from '@/lib/supabase/server'

export type SystemControl = {
  enabled: boolean
  message_ar?: string
  message_en?: string
  disabled_at?: string | null
}

const DEFAULT_CONTROL: SystemControl = { enabled: true }

export function isMaintenanceEnvForced(): boolean {
  return (
    process.env.MAINTENANCE_MODE === 'true' ||
    process.env.SYSTEM_DISABLED === 'true'
  )
}

export async function getSystemControl(): Promise<SystemControl> {
  if (isMaintenanceEnvForced()) {
    return {
      enabled: false,
      message_ar:
        process.env.MAINTENANCE_MESSAGE_AR ||
        'النظام متوقف مؤقتاً. تواصل مع الإدارة.',
      message_en:
        process.env.MAINTENANCE_MESSAGE_EN ||
        'System is temporarily offline.',
    }
  }

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'system_control')
      .maybeSingle()

    if (data?.value) {
      const raw =
        typeof data.value === 'string' ? JSON.parse(data.value) : data.value
      return {
        enabled: raw.enabled !== false,
        message_ar: raw.message_ar,
        message_en: raw.message_en,
        disabled_at: raw.disabled_at ?? null,
      }
    }
  } catch (err) {
    console.error('getSystemControl error:', err)
  }

  return DEFAULT_CONTROL
}

export function isSystemEnabled(control: SystemControl): boolean {
  return control.enabled !== false
}
