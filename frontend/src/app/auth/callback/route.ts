import { logger } from "@/lib/logger";
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { devLog } from '@/lib/logger'

/**
 * How long the callback will wait on the backend profile sync before giving up
 * and redirecting anyway.
 *
 * Chosen against measured production latency: the sync sits at a ~4s median
 * (already dominated by backend cold start) with a 94s tail. A ceiling above
 * ~5s stops protecting anyone, and one much below it would discard the
 * direct-to-dashboard handoff on a normal warm sign-in. This is a floor on how
 * bad the experience can get, not a fix for the latency itself — that is the
 * backend cold start, tracked separately.
 */
const SYNC_TIMEOUT_MS = 5000;

/**
 * Resolve the public-facing origin.
 *
 * Behind Vercel's proxy `new URL(request.url).origin` is the internal
 * deployment origin (e.g. eve-abc123.vercel.app), not the custom domain the
 * user actually started OAuth from. Redirecting there drops the session
 * cookies — they were scoped to the custom domain — and the PKCE verifier
 * lookup fails with "invalid flow state". Honour x-forwarded-host so the
 * whole round trip stays on one origin.
 */
function resolvePublicOrigin(request: Request): string {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }
  return url.origin
}

/**
 * A stale or already-consumed PKCE verifier leaves the browser wedged: every
 * retry replays the same dead cookie. Clearing the Supabase auth cookies on
 * the way out makes the next attempt work instead of looping the founder
 * through the same error screen.
 */
function redirectWithAuthReset(origin: string, message: string) {
  const response = NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(message)}`
  )
  // Supabase SSR cookies are named sb-<project-ref>-auth-token[.n] and
  // sb-<project-ref>-auth-token-code-verifier. Match the family by prefix.
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /https:\/\/([^.]+)\.supabase\.co/
  )?.[1]
  if (projectRef) {
    for (const suffix of [
      'auth-token',
      'auth-token-code-verifier',
      'auth-token.0',
      'auth-token.1',
    ]) {
      response.cookies.set(`sb-${projectRef}-${suffix}`, '', { maxAge: 0, path: '/' })
    }
  }
  return response
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = resolvePublicOrigin(request)
  const code = searchParams.get('code')
  // Default to /onboarding — it is idempotent and forwards users who already
  // have a workspace, so first-time OAuth users still get workspace setup.
  const next = searchParams.get('next') ?? '/onboarding'
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  devLog(`[AUTH CALLBACK] [START] Code: ${!!code}, Next: ${next}, Origin: ${origin}`)

  // 1. Provider redirected with an explicit error
  if (errorParam || errorDescription) {
    const message = errorDescription || errorParam || "Redirect error from auth provider"
    logger.error(`[AUTH CALLBACK] [ERROR] Provider error: ${errorParam} - ${errorDescription}`)
    return redirectWithAuthReset(origin, message)
  }

  // 2. Exchange the PKCE code for a session
  if (code) {
    const cookieStore = await cookies()
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
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
                cookiesToForward.push({ name, value, options: options ?? {} })
              })
            } catch (e) {
              logger.warn("[AUTH CALLBACK] Cookie set error:", e)
            }
          },
        },
      }
    )

    devLog(`[AUTH CALLBACK] [EXCHANGE] Exchanging code for session...`)
    const t0 = performance.now();

    const { data: exchangeData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)

    const tSessionCreated = performance.now();
    devLog(`[TELEMETRY][PERF] Session creation: ${(tSessionCreated - t0).toFixed(2)}ms`);

    if (exchangeError) {
      logger.error(`[AUTH CALLBACK] [ERROR] exchangeCodeForSession failed:`, exchangeError)

      const raw = exchangeError.message ?? ""
      const isFlowStateError = /flow state|code verifier|code_verifier|expired/i.test(raw)
      const message = isFlowStateError
        ? "That sign-in link expired before we could use it. We've cleared it — please click Continue with Google again."
        : raw || "Sign-in failed. Please try again."

      return redirectWithAuthReset(origin, message)
    }

    const session = exchangeData?.session;
    devLog(`[AUTH CALLBACK] [SUCCESS] Session: ${!!session}, cookies: ${cookiesToForward.length}`)

    let targetDestination = next;
    try {
      if (session) {
        const tSyncStart = performance.now();
        const { API_BASE_URL, apiFetch } = await import("@/lib/api");

        // Bounded wait. This request blocks the redirect, so the founder sits on
        // a blank /auth/callback for exactly as long as it takes. Production
        // logs show /api/auth/sync at a 4s median and a 94s worst case, because
        // signing in is usually the first request after the backend has scaled
        // to zero and it pays the whole cold start. Ninety seconds of white
        // screen immediately after "Continue with Google" reads as "this is
        // broken", and there was no ceiling on it at all.
        //
        // On timeout we fall through to `next` — the pre-handoff destination.
        // That is safe: /onboarding is idempotent and forwards users who
        // already have a workspace, and sync itself is self-healing and will be
        // driven by the destination page. We lose the direct-to-dashboard
        // shortcut for that one sign-in, not correctness.
        const syncAbort = new AbortController();
        const syncTimeout = setTimeout(() => syncAbort.abort(), SYNC_TIMEOUT_MS);

        let syncResponse: Response;
        try {
          syncResponse = await apiFetch(`${API_BASE_URL}/api/auth/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            signal: syncAbort.signal,
          });
        } finally {
          clearTimeout(syncTimeout);
        }

        const tSyncEnd = performance.now();
        devLog(`[TELEMETRY][PERF] Profile & Workspace sync: ${(tSyncEnd - tSyncStart).toFixed(2)}ms`);

        if (syncResponse.ok) {
          const syncData = await syncResponse.json();
          if ((next === '/onboarding' || next === '/') && syncData.has_workspace) {
            targetDestination = '/dashboard/inventory';
            devLog(`[AUTH CALLBACK] Direct dashboard handoff for existing/synced workspace: ${syncData.default_workspace_id}`);
          }
          if (syncData.default_workspace_id) {
            cookiesToForward.push({
              name: 'active_workspace_id',
              value: syncData.default_workspace_id,
              options: { path: '/', maxAge: 60 * 60 * 24 * 30 }
            });
          }
        }
      }
    } catch (syncError) {
      // A timeout is an expected outcome here, not a fault — distinguish it so
      // a cold-start-induced abort is not investigated as a sync bug, and so
      // the rate of these is visible as the cold-start signal it actually is.
      const timedOut = syncError instanceof DOMException && syncError.name === "AbortError";
      if (timedOut) {
        logger.warn(
          `[AUTH CALLBACK] Profile sync exceeded ${SYNC_TIMEOUT_MS}ms (backend likely cold) — ` +
          `redirecting to ${targetDestination} without waiting.`
        );
      } else {
        logger.error(`[AUTH CALLBACK] [ERROR] Backend sync failed:`, syncError);
      }
    }

    devLog(`[TELEMETRY][PERF] Callback processing total: ${(performance.now() - t0).toFixed(2)}ms -> redirecting to ${targetDestination}`);

    const response = NextResponse.redirect(`${origin}${targetDestination}`)
    for (const { name, value, options } of cookiesToForward) {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
    }
    return response
  }

  // 3. Neither code nor error
  logger.warn(`[AUTH CALLBACK] [WARNING] No 'code' or 'error' parameter present.`)
  return redirectWithAuthReset(origin, "That sign-in link was incomplete. Please try again.")
}
