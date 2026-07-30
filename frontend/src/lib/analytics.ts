/**
 * EVE behavioural analytics — PostHog.
 *
 * SCOPE: behaviour only. Funnels, session replay, user journeys. The Owner
 * Analytics dashboard remains the source of truth for business metrics; no
 * revenue, inventory or recommendation data is duplicated here.
 *
 * PRIVACY: enforced structurally, not by convention. Event properties pass
 * through an ALLOWLIST — a key that is not explicitly permitted is dropped
 * before it can leave the browser. This makes it impossible to leak a SKU
 * name or a financial value by adding a property at a call site.
 *
 * No-ops safely when NEXT_PUBLIC_POSTHOG_KEY is unset, so local dev and
 * preview deploys never pollute production funnels.
 */
import posthog from "posthog-js";
import { logger } from "@/lib/logger";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/**
 * Ingestion host. NOTE: `us.posthog.com` is the PostHog *app UI*; events must
 * be sent to `us.i.posthog.com`. Using the UI host relies on a redirect and
 * can silently drop events, so we normalise it here.
 */
function resolveHost(): string {
  const raw = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "").trim().replace(/\/+$/, "");
  if (!raw) return "https://us.i.posthog.com";
  if (raw === "https://us.posthog.com") return "https://us.i.posthog.com";
  if (raw === "https://eu.posthog.com") return "https://eu.i.posthog.com";
  return raw;
}

const POSTHOG_HOST = resolveHost();

// ---------------------------------------------------------------------------
// Event taxonomy
// ---------------------------------------------------------------------------

/** Append-only. Renaming an event orphans every saved PostHog insight. */
export type EveEvent =
  // Authentication
  | "signup_completed"
  | "login_completed"
  | "logout_completed"
  // Onboarding
  | "workspace_created"
  | "demo_workspace_created"
  | "onboarding_completed"
  // Inventory
  | "csv_upload_started"
  | "csv_upload_completed"
  | "csv_upload_failed"
  // AI
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed"
  | "recommendation_generated"
  | "recommendation_clicked"
  | "ai_chat_message_sent"
  // Product usage
  | "dashboard_viewed"
  | "inventory_page_viewed"
  | "recommendations_viewed"
  // Trial
  | "free_trial_started"
  // Acquisition funnel — kept because visitor->signup is the funnel the
  // current outreach experiment measures, and UTM arm attribution depends on
  // these firing on marketing pages.
  | "landing_view"
  | "pricing_viewed"
  | "signup_started"
  | "waitlist_submitted"
  | "demo_booking_clicked";

// ---------------------------------------------------------------------------
// Privacy allowlist
// ---------------------------------------------------------------------------

/**
 * The ONLY property keys permitted to leave the browser. Anything else is
 * dropped silently and logged in development.
 *
 * Deliberately excluded: sku, sku_name, product_name, customer_name, revenue,
 * cost, value, price, margin, prompt, response, message, recommendation,
 * content, rows — i.e. everything that could carry business data.
 */
const ALLOWED_PROPERTY_KEYS = new Set<string>([
  // Identity / scope
  "organization_id",
  "workspace_id",
  "user_id",
  // Volume metadata (counts, never contents)
  "sku_count",
  "row_count",
  "valid_row_count",
  "invalid_row_count",
  "recommendation_count",
  "dead_stock_count",
  "low_stock_count",
  "message_length",
  "file_size_kb",
  // Timing
  "upload_duration_ms",
  "analysis_duration_ms",
  "duration_ms",
  // Outcome
  "success",
  "status",
  "error_type",
  // CSV *header* names, not row data. Needed to diagnose the single biggest
  // activation drop-off (an import that fails on column mismatch). Revisit if
  // merchants ever put business data in headers.
  "missing_columns",
  // Context
  "method",
  "source",
  "location",
  "page",
  "demo_company",
  "plan",
  "mode",
  "requires_verification",
  "revenue_range",
  "has_website",
  // Attribution
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ref",
  "referrer",
  "landing_path",
]);

const MAX_STRING_LENGTH = 120;

/**
 * Drops disallowed keys and bounds string values. Returns only safe metadata.
 */
export function sanitizeProperties(
  props: Record<string, unknown>
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) {
      if (process.env.NODE_ENV !== "production") {
        logger.warn(`[EVE Analytics] dropped disallowed property "${key}"`);
      }
      continue;
    }
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      safe[key] = value.slice(0, MAX_STRING_LENGTH);
    } else if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    } else if (Array.isArray(value)) {
      // Arrays are permitted only for allowlisted keys, and stringified
      // element-wise with the same length bound.
      safe[key] = value.slice(0, 25).map((v) => String(v).slice(0, MAX_STRING_LENGTH));
    }
    // Objects are never forwarded — nested shapes are how data leaks.
  }
  return safe;
}

// ---------------------------------------------------------------------------
// Attribution (first touch wins, session-scoped)
// ---------------------------------------------------------------------------

const ATTRIBUTION_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref",
] as const;
const ATTRIBUTION_STORAGE_KEY = "eve_attribution";

export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY)) return; // first touch wins

    const params = new URLSearchParams(window.location.search);
    const attribution: Record<string, string> = {};
    for (const key of ATTRIBUTION_KEYS) {
      const value = params.get(key);
      if (value) attribution[key] = value;
    }
    if (document.referrer && !document.referrer.includes(window.location.host)) {
      attribution.referrer = document.referrer;
    }
    attribution.landing_path = window.location.pathname;
    sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  } catch (e) {
    logger.error("[EVE Analytics] attribution capture failed", e);
  }
}

export function getAttribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

let initialized = false;

export function isAnalyticsEnabled(): boolean {
  return Boolean(POSTHOG_KEY) && typeof window !== "undefined";
}

export function initAnalytics(): void {
  if (initialized || !isAnalyticsEnabled()) return;
  try {
    posthog.init(POSTHOG_KEY!, {
      api_host: POSTHOG_HOST,
      ui_host: "https://us.posthog.com",
      // Anonymous visitors do not create person profiles — keeps the marketing
      // funnel measurable without inflating billable persons.
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
      // Autocapture would record clicked element text, which inside the app
      // means SKU names and figures. Explicit events only.
      autocapture: false,
      disable_session_recording: false,
      session_recording: {
        // Every input, everywhere. Covers passwords, emails, brand names,
        // stock quantities typed into forms.
        maskAllInputs: true,
        // Any element (and its subtree) tagged data-ph-mask renders as
        // placeholder blocks in replay. Applied to the authenticated dashboard
        // shell, so all inventory, financial and recommendation text is masked
        // by default — including in components that do not exist yet.
        maskTextSelector: "[data-ph-mask], [data-ph-mask] *",
        blockSelector: "[data-ph-block]",
      },
      loaded: (ph) => {
        captureAttribution();
        // Dev-only handle. posthog-js does not attach a global when imported
        // as a module, which makes it impossible to inspect what is actually
        // being sent. Never exposed in production.
        if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
          (window as unknown as Record<string, unknown>).posthog = ph;
        }
      },
    });
    initialized = true;
  } catch (e) {
    logger.error("[EVE Analytics] init failed", e);
  }
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

export function track(
  event: EveEvent,
  properties: Record<string, unknown> = {}
): void {
  if (!isAnalyticsEnabled()) return;
  try {
    posthog.capture(event, {
      ...sanitizeProperties(getAttribution()),
      ...sanitizeProperties(properties),
    });
  } catch (e) {
    logger.error(`[EVE Analytics] track(${event}) failed`, e);
  }
}

/**
 * Fires an event at most once per browser tab session.
 *
 * The ref guard in useTrackOnce only survives re-renders, not a page refresh —
 * and the auth and analysis events are reached by pages a founder reloads. A
 * refresh must not add a second signup_completed, so the guard lives in
 * sessionStorage: it survives reload and route changes within the tab, and
 * resets on a genuinely new session, which is exactly the lifetime of a
 * "this sign-in" or "this analysis run" event.
 *
 * `key` scopes the guard — pass a user id or run id so two different users (or
 * two different analysis runs) in one tab each get their own event.
 */
export function trackOncePerSession(
  event: EveEvent,
  key: string,
  properties: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") return;
  const guard = `eve_once:${event}:${key}`;
  try {
    if (sessionStorage.getItem(guard)) return;
    sessionStorage.setItem(guard, "1");
  } catch {
    // Storage blocked (private mode, quota). Emitting a possible duplicate is
    // better than dropping the event entirely — PostHog dedupes by person.
  }
  track(event, properties);
}

/**
 * Stable identity. Uses the Supabase user id, which never changes for a user,
 * so journeys stitch correctly across sessions and devices.
 */
export function identify(
  userId: string,
  traits: Record<string, unknown> = {}
): void {
  if (!isAnalyticsEnabled() || !userId) return;
  try {
    posthog.identify(userId, sanitizeProperties(traits));
  } catch (e) {
    logger.error("[EVE Analytics] identify failed", e);
  }
}

/**
 * Associates subsequent events with an organization, enabling per-workspace
 * funnels and retention in PostHog without sending any workspace content.
 */
export function setOrganization(organizationId: string): void {
  if (!isAnalyticsEnabled() || !organizationId) return;
  try {
    posthog.group("organization", organizationId);
  } catch (e) {
    logger.error("[EVE Analytics] group failed", e);
  }
}

/** Clears identity on logout so the next user is not stitched to the last. */
export function resetAnalytics(): void {
  if (!isAnalyticsEnabled()) return;
  try {
    posthog.reset();
  } catch (e) {
    logger.error("[EVE Analytics] reset failed", e);
  }
}
