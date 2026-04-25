import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
    // if authenticated and on login page, redirect to orders
    const parts = pathname.split('/')
    let locale = 'ar'
    if (parts.length > 1 && (parts[1] === 'ar' || parts[1] === 'en')) {
      locale = parts[1]
    }
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/orders`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
