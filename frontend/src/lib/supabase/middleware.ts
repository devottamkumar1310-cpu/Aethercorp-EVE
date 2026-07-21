import { logger } from "@/lib/logger";
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const pathname = request.nextUrl.pathname
  logger.log(`[MIDDLEWARE] [START] Pathname: ${pathname}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          logger.log(`[MIDDLEWARE] [COOKIES] Setting cookies:`, cookiesToSet.map(c => c.name))
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

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError) {
    logger.error(`[MIDDLEWARE] [AUTH ERROR] getUser failed:`, userError.message)
  }

  logger.log(`[MIDDLEWARE] [AUTH] Path: ${pathname}, User email: ${user?.email || "anonymous (null)"}, Verified: ${!!user?.email_confirmed_at}`)

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup') || request.nextUrl.pathname.startsWith('/forgot-password')
  const isVerifyRoute = request.nextUrl.pathname.startsWith('/verify-email')

  if (user) {
    const isConfirmed = !!user.email_confirmed_at;
    
    // Redirect unverified users trying to access dashboard or onboarding
    if (!isConfirmed && !isVerifyRoute && (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/onboarding'))) {
      const url = request.nextUrl.clone()
      url.pathname = '/verify-email'
      url.searchParams.set('email', user.email || '')
      logger.log(`[MIDDLEWARE] [REDIRECT] Unconfirmed user redirected to: ${url.pathname}`)
      return NextResponse.redirect(url)
    }

    // Redirect verified users away from verify-email
    if (isConfirmed && isVerifyRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/inventory'
      logger.log(`[MIDDLEWARE] [REDIRECT] Verified user redirected away from verify-email to: ${url.pathname}`)
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from auth routes
    if (isConfirmed && isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/inventory'
      logger.log(`[MIDDLEWARE] [REDIRECT] Authenticated user redirected away from auth page to: ${url.pathname}`)
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users from home page or dashboard root to dashboard/inventory
    if (isConfirmed && (pathname === '/' || pathname === '/dashboard' || pathname === '/dashboard/')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/inventory'
      logger.log(`[MIDDLEWARE] [REDIRECT] Authenticated user on ${pathname} redirected to: ${url.pathname}`)
      return NextResponse.redirect(url)
    }
  } else {
    // Protect /dashboard and /onboarding for unauthenticated users
    if (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/onboarding')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      logger.log(`[MIDDLEWARE] [REDIRECT] Unauthenticated user redirected to login: ${url.pathname}`)
      return NextResponse.redirect(url)
    }
  }

  logger.log(`[MIDDLEWARE] [PASS] Proceeding to route: ${pathname}`)
  return supabaseResponse
}
