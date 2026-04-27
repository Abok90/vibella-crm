import { getDictionary } from '@/app/dictionaries'
import SettingsContent from '@/components/settings/settings-content'
import { createClient } from '@/lib/supabase/server'
import packageJson from '../../../../package.json'

export default async function SettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const currentLang = lang as 'ar' | 'en'
  const dict = await getDictionary(currentLang)

  // Determine if the current user is an admin (server-side)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    if (user.email?.toLowerCase() === 'ahmedsayed328@gmail.com') {
      isAdmin = true
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      isAdmin = profile?.role === 'admin'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-serif text-foreground font-semibold tracking-tight">
          {dict.navigation?.settings || 'الإعدادات'}
        </h1>
      </div>
      <SettingsContent lang={currentLang} isAdmin={isAdmin} />
      <div className="text-center py-4">
        <span className="text-xs text-muted-foreground font-mono">Vibella CRM v{packageJson.version}</span>
      </div>
    </div>
  )
}

