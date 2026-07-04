import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard/inventory'
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Detailed logging for debugging in production
  console.log(`[AUTH CALLBACK] [START] Incoming request URL: ${request.url}`)
  console.log(`[AUTH CALLBACK] [START] Origin: ${origin}, Code present: ${!!code}, Next destination: ${next}`)
  console.log(`[AUTH CALLBACK] [START] Extracted Query Parameters:`, Object.fromEntries(searchParams.entries()))

  // 1. If Supabase redirected with an explicit error in query parameters
  if (errorParam || errorDescription) {
    const message = errorDescription || errorParam || "Redirect error from auth provider"
    console.error(`[AUTH CALLBACK] [ERROR] Error redirect from Supabase: ${errorParam} - ${errorDescription}`)
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
              console.warn("[AUTH CALLBACK] Cookie set error in server environment:", e)
            }
          },
        },
      }
    )
    
    console.log(`[AUTH CALLBACK] [EXCHANGE] Exchanging code for session...`)
    const t0 = performance.now();
    
    // We can extract session directly from the exchange result instead of calling getSession() again.
    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.error(`[AUTH CALLBACK] [ERROR] exchangeCodeForSession failed:`, exchangeError)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`)
    }

    const session = exchangeData?.session;
    console.log(`[AUTH CALLBACK] [SUCCESS] Session created: ${!!session}, User: ${session?.user?.email || "unknown"}`)

    // Sync with backend immediately after OAuth code exchange
    try {
      if (session) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        console.log(`[AUTH CALLBACK] [SYNC] Syncing with backend: ${apiUrl}/api/auth/sync`)
        const syncResponse = await fetch(`${apiUrl}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        console.log(`[AUTH CALLBACK] [SYNC] Backend sync response status: ${syncResponse.status}`)
        const t1 = performance.now();
        console.log(`[TELEMETRY][PERF] OAuth Callback & Backend Sync Duration: ${(t1 - t0).toFixed(2)}ms`);
      }
    } catch (syncError) {
      console.error(`[AUTH CALLBACK] [ERROR] Backend sync failed:`, syncError);
    }

    console.log(`[AUTH CALLBACK] [REDIRECT] Exchange successful. Redirecting to: ${origin}${next}`)
    return NextResponse.redirect(`${origin}${next}`)
  }

  // 3. Fallback if no code or error parameters are found in query parameters
  console.warn(`[AUTH CALLBACK] [WARNING] Request received without 'code' or 'error' parameters. Checking for hash fragments...`)
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Missing authorization code in link parameters")}`)
}
