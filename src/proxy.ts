import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['ar', 'en']
const defaultLocale = 'ar'

// For Next.js 16 proxy convention
import { updateSession } from './lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 1. Force Auth / Session checks FIRST
  const authResponse = await updateSession(request)
  
  // If updateSession redirected, respect it
  if (authResponse.status === 307 || authResponse.status === 308) {
    return authResponse
  }

  // 2. Locale Routing
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLocale}/orders`, request.url))
  }

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return authResponse

  // Redirect if there is no locale
  return NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, request.url))
}

// Support both exports gracefully in case Next.js fallback reads it
export { proxy as middleware }

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
