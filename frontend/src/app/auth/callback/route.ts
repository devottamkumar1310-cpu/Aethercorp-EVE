import { logger } from "@/lib/logger";
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { devLog } from '@/lib/logger'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard/inventory'
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  devLog(`[AUTH CALLBACK] [START] Code present: ${!!code}, Next destination: ${next}`)

  // 1. If Supabase redirected with an explicit error in query parameters
  if (errorParam || errorDescription) {
    const message = errorDescription || errorParam || "Redirect error from auth provider"
    logger.error(`[AUTH CALLBACK] [ERROR] Error redirect from Supabase: ${errorParam} - ${errorDescription}`)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`)
  }

  // 2. If code exists, attempt PKCE code-to-session exchange
  if (code) {
    const cookieStore = await cookies()

    // Track cookies that need to be written onto the response
    const cookiesToForward: { name: string; value: string; options: Record<string, unknown> }[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            // Write cookies into the cookie store AND capture them for the response
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
                cookiesToForward.push({ name, value, options: options ?? {} })
              })
            } catch (e) {
              // In a Route Handler context this is always allowed; log any
              // unexpected errors without crashing the callback.
              logger.warn("[AUTH CALLBACK] Cookie set error:", e)
            }
          },
        },
      }
    )

    devLog(`[AUTH CALLBACK] [EXCHANGE] Exchanging code for session...`)
    const t0 = performance.now();

    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      logger.error(`[AUTH CALLBACK] [ERROR] exchangeCodeForSession failed:`, exchangeError)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`)
    }

    const session = exchangeData?.session;
    devLog(`[AUTH CALLBACK] [SUCCESS] Session created: ${!!session}, cookies to forward: ${cookiesToForward.length}`)

    // Sync with backend immediately after OAuth code exchange
    try {
      if (session) {
        const { API_BASE_URL, apiFetch } = await import("@/lib/api");
        devLog(`[AUTH CALLBACK] [SYNC] Syncing with backend auth endpoint`)
        const syncResponse = await apiFetch(`${API_BASE_URL}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        devLog(`[AUTH CALLBACK] [SYNC] Backend sync response status: ${syncResponse.status}`)
        const t1 = performance.now();
        devLog(`[TELEMETRY][PERF] OAuth Callback & Backend Sync Duration: ${(t1 - t0).toFixed(2)}ms`);
      }
    } catch (syncError) {
      logger.error(`[AUTH CALLBACK] [ERROR] Backend sync failed:`, syncError);
    }

    // Build redirect response and forward all session cookies set during the
    // code exchange. This is critical: without explicitly copying the cookies
    // onto the NextResponse the browser never receives the auth token cookies
    // and every subsequent request appears unauthenticated.
    const redirectUrl = `${origin}${next}`
    devLog(`[AUTH CALLBACK] [REDIRECT] Redirecting to: ${redirectUrl}`)
    const response = NextResponse.redirect(redirectUrl)

    for (const { name, value, options } of cookiesToForward) {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
    }

    return response
  }

  // 3. Fallback if no code or error parameters are found
  logger.warn(`[AUTH CALLBACK] [WARNING] Request received without 'code' or 'error' parameters.`)
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Missing authorization code in callback URL")}`)
}
