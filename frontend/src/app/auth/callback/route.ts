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
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (e) {
              logger.warn("[AUTH CALLBACK] Cookie set error in server environment:", e)
            }
          },
        },
      }
    )
    
    devLog(`[AUTH CALLBACK] [EXCHANGE] Exchanging code for session...`)
    const t0 = performance.now();
    
    // We can extract session directly from the exchange result instead of calling getSession() again.
    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      logger.error(`[AUTH CALLBACK] [ERROR] exchangeCodeForSession failed:`, exchangeError)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`)
    }

    const session = exchangeData?.session;
    devLog(`[AUTH CALLBACK] [SUCCESS] Session created: ${!!session}`)

    // Sync with backend immediately after OAuth code exchange
    try {
      if (session) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        devLog(`[AUTH CALLBACK] [SYNC] Syncing with backend auth endpoint`)
        const syncResponse = await fetch(`${apiUrl}/api/auth/sync`, {
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

    devLog(`[AUTH CALLBACK] [REDIRECT] Exchange successful.`)
    return NextResponse.redirect(`${origin}${next}`)
  }

  // 3. Fallback if no code or error parameters are found in query parameters
  logger.warn(`[AUTH CALLBACK] [WARNING] Request received without 'code' or 'error' parameters. Checking for hash fragments...`)
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Missing authorization code in link parameters")}`)
}
