/**
 * Waitlist / early-access lead capture.
 *
 * Talks to POST /api/waitlist, which accepts optional auth — so this uses a
 * plain fetch rather than apiFetch (apiFetch force-signs-out on 401, which
 * would be wrong for a public marketing form).
 */
import { API_BASE_URL } from "@/lib/api";
import { logger } from "@/lib/logger";

export interface WaitlistPayload {
  name?: string;
  email: string;
  company_name?: string;
  company_website?: string;
  revenue_range?: string;
  biggest_inventory_challenge?: string;
}

export interface WaitlistResult {
  status: "success" | "already_registered";
  message: string;
}

export async function joinWaitlist(
  payload: WaitlistPayload
): Promise<WaitlistResult> {
  const res = await fetch(`${API_BASE_URL}/api/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = "We couldn't add you to the list. Please try again.";
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // Non-JSON error body (gateway timeout, HTML error page) — keep the
      // friendly default rather than surfacing a parse failure to a founder.
    }
    if (res.status === 429) {
      detail = "Too many attempts. Give it a minute and try again.";
    }
    logger.error(`[EVE Waitlist] submit failed (${res.status}): ${detail}`);
    throw new Error(detail);
  }

  return res.json();
}
