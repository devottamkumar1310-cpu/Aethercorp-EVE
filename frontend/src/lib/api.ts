import { logger } from "@/lib/logger";
import { devLog } from "@/lib/logger";

function sanitizeApiUrl(raw: string | undefined): string {
  if (!raw) return "";
  let url = raw
    .replace(/^\uFEFF/, "")                  // Strip UTF-8 Byte Order Mark (BOM)
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Strip zero-width spaces
    .trim()
    .replace(/^["']|["']$/g, "")           // Strip surrounding quotes
    .trim()
    .replace(/\/+$/, "")                   // Strip trailing slashes
    .replace(/\/api$/, "");                // Strip trailing /api
  return url;
}

function resolveApiBaseUrl(): string {
  const envUrl = sanitizeApiUrl(process.env.NEXT_PUBLIC_API_URL);

  // Must start with http:// or https:// to be a valid absolute API base URL
  if (envUrl && (envUrl.startsWith("http://") || envUrl.startsWith("https://"))) {
    return envUrl;
  }

  if (envUrl) {
    logger.warn(`[EVE Config] NEXT_PUBLIC_API_URL (${JSON.stringify(envUrl)}) is invalid or non-absolute. Using production fallback.`);
  } else if (typeof window !== "undefined") {
    logger.warn("[EVE Config] NEXT_PUBLIC_API_URL is missing. Falling back to default production backend.");
  }

  const defaultFallback = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? "https://eve-backend-68416570138.us-central1.run.app"
    : "http://127.0.0.1:8000";

  return defaultFallback;
}

export const API_BASE_URL = resolveApiBaseUrl();

if (typeof window !== "undefined") {
  devLog(`[EVE Config] API Base URL resolved to: ${API_BASE_URL}`);
}
/**
 * Centralized fetch wrapper for authenticated API calls.
 *
 * Intercepts HTTP 401 responses globally:
 * - Signs the user out via Supabase to invalidate the local session.
 * - Redirects to /login with a human-readable "session expired" message.
 * - Throws immediately so the calling service never receives a partial response.
 *
 * All other responses are passed through unchanged — error handling
 * (404, 422, 500, etc.) remains the responsibility of the individual service.
 *
 * Usage: replace `fetch(url, options)` with `apiFetch(url, options)` in any
 * authenticated service. Do NOT use this for unauthenticated calls (e.g. /login).
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 401) {
    logger.warn("[EVE] 401 Unauthorized — session expired. Signing out.");
    try {
      // Dynamically import to avoid circular dependency with supabase client.
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().auth.signOut();
    } catch (e) {
      logger.error("[EVE] signOut failed during 401 redirect:", e);
    }
    // Redirect to login. Using window.location.href to guarantee a full page
    // reload which clears all in-memory React state.
    if (typeof window !== "undefined") {
      window.location.href = "/login?message=Session+expired.+Please+sign+in+again.";
    }
    throw new Error("Session expired. Please sign in again.");
  }
  return res;
}
