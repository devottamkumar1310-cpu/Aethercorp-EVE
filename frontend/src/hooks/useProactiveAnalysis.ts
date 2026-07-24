"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { API_BASE_URL, apiFetch } from "@/lib/api";

const PENDING_KEY = "eve_analysis_pending";
const ORG_KEY = "eve_analysis_org_id";
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 90; // ~3 minutes — the backend's worst-case run

type AnalysisStatus = "none" | "in_progress" | "completed" | "failed";

interface AnalysisStatusResponse {
  status?: AnalysisStatus;
  step?: number;
  error?: string | null;
  recommendations_count?: number;
  /** Dominant recommendation_type of the run; absent on older backends. */
  primary_type?: string | null;
}

export interface AnalysisOutcome {
  /** Where the result is actionable. Never the audit trail. */
  href: string;
  /** Action label on the toast, naming the destination. */
  label: string;
}

/**
 * Maps the run's dominant recommendation type to the surface where the user can
 * act on it. Decision Traceability is deliberately absent: it answers "why was
 * this recommended", which is a governance question the user asks later, not the
 * outcome they want to see the moment an analysis lands.
 */
export function resolveAnalysisDestination(primaryType?: string | null): AnalysisOutcome {
  switch ((primaryType || "").toLowerCase()) {
    // SKU-level actions — reorder, liquidate, reprice — all live in the
    // Reorder Center on Inventory Intelligence.
    case "inventory":
    case "reorder":
    case "stockout":
    case "dead_stock":
    case "pricing":
    case "margin":
      return { href: "/dashboard/inventory", label: "View inventory" };

    // Strategic/narrative output is something you interrogate conversationally.
    case "summary":
    case "executive":
    case "strategy":
      return { href: "/dashboard/eve", label: "Ask EVE" };

    // Cross-cutting operational signals surface as dashboard priorities.
    case "forecasting":
    case "operations":
    case "operational":
      return { href: "/dashboard", label: "View dashboard" };

    // Unknown or absent (older backend): Inventory Intelligence is the daily
    // driver and the safest non-audit landing spot.
    default:
      return { href: "/dashboard/inventory", label: "View inventory" };
  }
}

function clearPendingFlags() {
  localStorage.removeItem(PENDING_KEY);
  localStorage.removeItem(ORG_KEY);
}

interface UseProactiveAnalysisOptions {
  sessionToken: string;
  /** Used when the run was started without stamping an org id. */
  fallbackOrganizationId?: string | null;
  /** Fired once, after a run completes, so the caller can pull fresh data. */
  onComplete?: () => void;
  /**
   * Invoked when the user taps the completion toast's action. Receives the
   * destination resolved from the run's results, so the caller only navigates.
   */
  onViewRecommendations?: (destination: AnalysisOutcome) => void;
}

/**
 * Watches a proactive analysis run in the background.
 *
 * Deliberately headless: the analysis is a background job, so it must never
 * occupy layout space or interrupt what the user is doing. The only visible
 * output is a single toast when the run finishes or fails.
 *
 * Polling starts either on mount (flag already set — e.g. after the demo
 * onboarding reload) or when an upload dispatches `eve_analysis_started`
 * mid-session, so no page reload is needed to begin watching.
 *
 * Every terminal state clears the localStorage flags, which is what stops a
 * finished or abandoned run from resurrecting on the next page load.
 */
export function useProactiveAnalysis({
  sessionToken,
  fallbackOrganizationId,
  onComplete,
  onViewRecommendations,
}: UseProactiveAnalysisOptions) {
  const onCompleteRef = useRef(onComplete);
  const onViewRef = useRef(onViewRecommendations);
  const fallbackOrgRef = useRef(fallbackOrganizationId);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onViewRef.current = onViewRecommendations;
    fallbackOrgRef.current = fallbackOrganizationId;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let running = false;

    const stop = () => {
      running = false;
      controller?.abort();
      controller = null;
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = undefined;
      }
    };

    const start = () => {
      if (running) return; // already watching this run
      if (localStorage.getItem(PENDING_KEY) !== "1") return;
      if (!sessionToken) return; // effect re-runs once the token lands

      const organizationId = localStorage.getItem(ORG_KEY) || fallbackOrgRef.current;
      if (!organizationId) {
        clearPendingFlags();
        return;
      }

      running = true;
      controller = new AbortController();
      const signal = controller.signal;
      let polls = 0;

      // Terminal states always clear the flags before any user-facing effect.
      const finish = (announce?: () => void) => {
        clearPendingFlags();
        stop();
        announce?.();
      };

      const poll = async () => {
        if (signal.aborted || polls >= MAX_POLLS) return;
        polls++;
        let keepPolling = true;

        try {
          const res = await apiFetch(
            `${API_BASE_URL}/api/organization/${organizationId}/analysis-status`,
            { headers: { Authorization: `Bearer ${sessionToken}` }, signal }
          );
          // A transient non-OK response is not terminal: fall through to the
          // finally block, which reschedules the next poll.
          if (!res.ok || signal.aborted) return;

          const data: AnalysisStatusResponse = await res.json();
          if (signal.aborted) return;

          const status = data.status ?? "in_progress";

          // "none" means nothing is actually running — a stale flag, or a run
          // already consumed in an earlier session. Clear it silently; a toast
          // here would announce work the user never started.
          if (status === "none") {
            keepPolling = false;
            finish();
            return;
          }

          if (status === "failed") {
            keepPolling = false;
            const description = data.error || "EVE could not finish analyzing your data.";
            finish(() => toast.error("Analysis failed", { description }));
            return;
          }

          if (status === "completed") {
            keepPolling = false;
            const count = data.recommendations_count ?? 0;
            const view = onViewRef.current;
            const destination = resolveAnalysisDestination(data.primary_type);
            finish(() => {
              toast.success(
                count > 0
                  ? `${count} new recommendation${count === 1 ? "" : "s"} ready`
                  : "Analysis complete",
                {
                  description: "EVE finished analyzing your business data.",
                  ...(view
                    ? {
                        action: {
                          label: destination.label,
                          onClick: () => view(destination),
                        },
                      }
                    : {}),
                }
              );
              onCompleteRef.current?.();
            });
            return;
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        } finally {
          if (keepPolling && !signal.aborted) {
            if (polls < MAX_POLLS) {
              pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
            } else {
              // Timed out while still in progress. Clear silently so the next
              // page load does not resurrect a run we can no longer track.
              finish();
            }
          }
        }
      };

      poll();
    };

    start();
    window.addEventListener("eve_analysis_started", start);
    return () => {
      window.removeEventListener("eve_analysis_started", start);
      stop();
    };
  }, [sessionToken]);
}
