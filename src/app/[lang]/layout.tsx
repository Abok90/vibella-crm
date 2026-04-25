import type { Metadata } from 'next'
import { getDictionary } from '@/app/dictionaries'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { BottomNav } from '@/components/layout/bottom-nav'
import { ToastProvider } from '@/components/ui/toast'
import { RealtimeProvider } from '@/components/providers/realtime-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { PWAProvider } from '@/components/providers/pwa-provider'
import '@/app/globals.css'
import { createClient } from '@/lib/supabase/server'
import NextTopLoader from 'nextjs-toploader';

export const metadata: Metadata = {
  title: 'Vibella CRM',
  description: 'Premium management system for Vibella',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '16x16 32x32 64x64' },
    ],
    apple: [{ url: '/icon.svg' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vibella',
  },
}

export const viewport = {
  themeColor: '#D946EF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const currentLang = lang as 'ar' | 'en'
  const dictionary = await getDictionary(currentLang)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let role = 'employee'
  if (user) {
    if (user.email?.toLowerCase() === 'ahmedsayed328@gmail.com') {
      role = 'admin'
    } else {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile) role = profile.role
    }
  }

  return (
    <html lang={currentLang} dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
      <body className="bg-background antialiased">
        <NextTopLoader color="#D946EF" showSpinner={false} height={3} shadow="0 0 10px #D946EF,0 0 5px #E879F9" />
        <ThemeProvider>
        <ToastProvider>
        <RealtimeProvider />
        <PWAProvider />
        {user ? (
          <div className="flex min-h-[100dvh]">
            <Sidebar dict={dictionary} lang={currentLang} userEmail={user.email} userRole={role} />
            <div className="flex-1 flex flex-col min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
              <Header dict={dictionary} lang={currentLang} />
              <main className="flex-1 p-3 sm:p-4 lg:p-8">
                {children}
              </main>
            </div>
            <BottomNav lang={currentLang} userRole={role} />
          </div>
        ) : (
          <main className="min-h-[100dvh]">
            {children}
          </main>
        )}
        </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
