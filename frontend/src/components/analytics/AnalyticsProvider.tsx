"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

/**
 * Boots PostHog once on the client. Mounted from the root layout so every
 * route — marketing and app — is instrumented without per-page wiring.
 */
export function AnalyticsProvider() {
  useEffect(() => {
    initAnalytics();
  }, []);

  return null;
}
