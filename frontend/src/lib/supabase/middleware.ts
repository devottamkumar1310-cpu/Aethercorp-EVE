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
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup') || request.nextUrl.pathname.startsWith('/forgot-password')
  const isVerifyRoute = request.nextUrl.pathname.startsWith('/verify-email')

  if (user) {
    const isConfirmed = !!user.email_confirmed_at;
    
    // Redirect unverified users trying to access dashboard or onboarding
    if (!isConfirmed && !isVerifyRoute && (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/onboarding'))) {
      const url = request.nextUrl.clone()
      url.pathname = '/verify-email'
      url.searchParams.set('email', user.email || '')
      return NextResponse.redirect(url)
    }

    // Redirect verified users away from verify-email
    if (isConfirmed && isVerifyRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/inventory'
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from auth routes
    if (isConfirmed && isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/inventory'
      return NextResponse.redirect(url)
    }
  } else {
    // Protect /dashboard and /onboarding for unauthenticated users
    if (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/onboarding')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
