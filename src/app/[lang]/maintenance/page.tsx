import { getSystemControl, isSystemEnabled } from '@/lib/system-status'
import { MaintenanceScreen } from '@/components/maintenance/maintenance-screen'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MaintenancePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const currentLang = (lang === 'en' ? 'en' : 'ar') as 'ar' | 'en'
  const control = await getSystemControl()

  if (isSystemEnabled(control)) {
    redirect(`/${currentLang}/orders`)
  }

  const message =
    currentLang === 'ar'
      ? control.message_ar || 'النظام متوقف مؤقتاً.'
      : control.message_en || 'System is temporarily offline.'

  return (
    <MaintenanceScreen lang={currentLang} message={message} showAdminLink />
  )
}
