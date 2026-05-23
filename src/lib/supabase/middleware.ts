import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  getSystemControl,
  isMaintenanceEnvForced,
  isSystemEnabled,
} from '@/lib/system-status'
import { isUserAdmin } from '@/lib/admin-check'

function getLocaleFromPath(pathname: string): 'ar' | 'en' {
  const parts = pathname.split('/')
  if (parts.length > 1 && parts[1] === 'en') return 'en'
  return 'ar'
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Fetch the session or use getUser() to validate auth state safely
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Do not redirect for static assets or api handlers
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('/favicon.ico')
  ) {
    return supabaseResponse
  }

  // Check if it's a login page
  const isLoginPage = pathname.endsWith('/login')
  const isMaintenancePage = pathname.includes('/maintenance')
  const isSettingsPage = pathname.includes('/settings')

  // ——— System shutdown / maintenance ———
  const control = await getSystemControl()
  const systemOff = isMaintenanceEnvForced() || !isSystemEnabled(control)

  if (systemOff && !pathname.startsWith('/api')) {
    const locale = getLocaleFromPath(pathname)
    const adminBypass =
      user && isSettingsPage && (await isUserAdmin(user))

    if (!isMaintenancePage && !adminBypass) {
      if (user && !isSettingsPage) {
        const url = request.nextUrl.clone()
        url.pathname = `/${locale}/maintenance`
        return NextResponse.redirect(url)
      }
      if (!user && !isLoginPage) {
        const url = request.nextUrl.clone()
        url.pathname = `/${locale}/maintenance`
        return NextResponse.redirect(url)
      }
    }
  }

  if (
    // If not authenticated and not on login page
    !user && 
    !isLoginPage && 
    pathname !== '/' // root redirects later
  ) {
    // Determine the locale assuming first part is locale. Fallback to /ar if none
    const parts = pathname.split('/')
    let locale = 'ar'
    if (parts.length > 1 && (parts[1] === 'ar' || parts[1] === 'en')) {
      locale = parts[1]
    }
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/login`
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const locale = getLocaleFromPath(pathname)
    const url = request.nextUrl.clone()
    const off = isMaintenanceEnvForced() || !isSystemEnabled(control)
    if (off && (await isUserAdmin(user))) {
      url.pathname = `/${locale}/settings`
    } else if (off) {
      url.pathname = `/${locale}/maintenance`
    } else {
      url.pathname = `/${locale}/orders`
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
