/**
 * EVE product analytics — the instrument for the only metric that matters
 * right now: visitor → signup → activated user.
 *
 * Deliberately small. Six funnel events, one identify call, UTM attribution.
 * Resist adding more until these six are answering questions.
 *
 * No-ops safely when NEXT_PUBLIC_POSTHOG_KEY is unset, so local dev and
 * preview deploys never pollute production funnels.
 */
import posthog from "posthog-js";
import { logger } from "@/lib/logger";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/** Attribution params we persist for the lifetime of the session. */
const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ref",
] as const;

const ATTRIBUTION_STORAGE_KEY = "eve_attribution";

let initialized = false;

export function isAnalyticsEnabled(): boolean {
  return Boolean(POSTHOG_KEY) && typeof window !== "undefined";
}

export function initAnalytics(): void {
  if (initialized || !isAnalyticsEnabled()) return;
  try {
    posthog.init(POSTHOG_KEY!, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
    });
    initialized = true;
    captureAttribution();
  } catch (e) {
    logger.error("[EVE Analytics] init failed", e);
  }
}

/**
 * Capture UTM/referrer on first touch and persist it. Without this we can
 * record that someone signed up but never which outreach channel produced
 * them — which is the question the next 20 days actually needs answered.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const existing = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (existing) return; // first touch wins

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

/**
 * The six funnel events. Names are stable contracts — renaming one breaks
 * every saved PostHog insight, so treat this union as append-only.
 */
export type EveEvent =
  | "landing_view"
  | "signup_started"
  | "signup_completed"
  | "workspace_created"
  | "csv_uploaded"
  | "first_insight_viewed"
  // Supporting conversion events
  | "waitlist_submitted"
  | "demo_booking_clicked"
  | "pricing_viewed"
  | "demo_workspace_started"
  | "csv_upload_failed";

export function track(
  event: EveEvent,
  properties: Record<string, unknown> = {}
): void {
  if (!isAnalyticsEnabled()) return;
  try {
    posthog.capture(event, { ...getAttribution(), ...properties });
  } catch (e) {
    logger.error(`[EVE Analytics] track(${event}) failed`, e);
  }
}

export function identify(
  userId: string,
  traits: Record<string, unknown> = {}
): void {
  if (!isAnalyticsEnabled()) return;
  try {
    posthog.identify(userId, { ...getAttribution(), ...traits });
  } catch (e) {
    logger.error("[EVE Analytics] identify failed", e);
  }
}

export function resetAnalytics(): void {
  if (!isAnalyticsEnabled()) return;
  try {
    posthog.reset();
  } catch (e) {
    logger.error("[EVE Analytics] reset failed", e);
  }
}
