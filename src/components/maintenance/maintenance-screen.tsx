import { Power } from 'lucide-react'
import Link from 'next/link'

export function MaintenanceScreen({
  lang,
  message,
  showAdminLink = false,
}: {
  lang: 'ar' | 'en'
  message: string
  showAdminLink?: boolean
}) {
  const ar = lang === 'ar'

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
        <Power className="w-8 h-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">
        {ar ? 'النظام متوقف' : 'System Offline'}
      </h1>
      <p className="text-muted-foreground max-w-md text-[15px] leading-relaxed mb-8">
        {message}
      </p>
      {showAdminLink && (
        <Link
          href={`/${lang}/login`}
          className="text-sm font-semibold text-primary hover:underline"
        >
          {ar ? 'دخول المدير' : 'Admin login'}
        </Link>
      )}
    </div>
  )
}
