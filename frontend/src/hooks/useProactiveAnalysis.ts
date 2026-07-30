"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { trackOncePerSession } from "@/lib/analytics";

const PENDING_KEY = "eve_analysis_pending";
const ORG_KEY = "eve_analysis_org_id";
/**
 * The last terminal outcome, kept so a result survives a missed toast. Toasts
 * are the only channel this hook had, so a merchant who switched tabs during
 * their first analysis lost the result permanently and saw no reason why.
 */
const OUTCOME_KEY = "eve_analysis_outcome";
/** Per-run identity, so each run's funnel events fire exactly once. */
const RUN_KEY = "eve_analysis_run_id";
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 90; // ~3 minutes — the backend's worst-case run

export type AnalysisOutcomeKind = "completed" | "failed" | "timed_out";

export interface StoredAnalysisOutcome {
  kind: AnalysisOutcomeKind;
  organizationId: string;
  /** Merchant-readable. The backend maps exceptions before they reach here. */
  message: string;
  count?: number;
  href?: string;
  label?: string;
}

export function readStoredOutcome(): StoredAnalysisOutcome | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(OUTCOME_KEY);
    return raw ? (JSON.parse(raw) as StoredAnalysisOutcome) : null;
  } catch {
    return null;
  }
}

export function clearStoredOutcome() {
  if (typeof window !== "undefined") localStorage.removeItem(OUTCOME_KEY);
}

function storeOutcome(outcome: StoredAnalysisOutcome) {
  try {
    localStorage.setItem(OUTCOME_KEY, JSON.stringify(outcome));
    // Lets the banner pick it up without waiting for a route change.
    window.dispatchEvent(new Event("eve_analysis_outcome"));
  } catch {
    // Storage full or blocked — the toast below is still shown.
  }
}

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

/**
 * Identifies one analysis run so its events fire once each.
 *
 * A refresh mid-run re-enters start(), which would otherwise emit a second
 * analysis_started for work already in flight. The id is generated lazily on
 * first sight of a pending run and cleared with the run, so a retry — which
 * re-arms the pending flag — correctly counts as a new run rather than being
 * swallowed by the previous one's guard.
 */
function currentRunId(): string {
  let id = localStorage.getItem(RUN_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(RUN_KEY, id);
  }
  return id;
}

function clearPendingFlags() {
  localStorage.removeItem(PENDING_KEY);
  localStorage.removeItem(ORG_KEY);
  localStorage.removeItem(RUN_KEY);
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
  /**
   * Invoked from the "Try again" action on a failed or timed-out run. Without
   * it those toasts are terminal and the merchant's only route to a first
   * insight is re-importing a catalogue that imported perfectly well.
   */
  onRetry?: () => void;
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
  onRetry,
}: UseProactiveAnalysisOptions) {
  const onCompleteRef = useRef(onComplete);
  const onViewRef = useRef(onViewRecommendations);
  const onRetryRef = useRef(onRetry);
  const fallbackOrgRef = useRef(fallbackOrganizationId);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onViewRef.current = onViewRecommendations;
    onRetryRef.current = onRetry;
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
      const startedAt = Date.now();

      // The proactive run is the activation moment the whole funnel exists to
      // produce, and it emitted nothing — analysis_* fired only from the chat
      // page.
      const runId = currentRunId();
      trackOncePerSession("analysis_started", runId, {
        source: "proactive_upload",
        organization_id: organizationId,
      });

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
            const description =
              data.error ||
              "EVE couldn't finish analysing your data. Your inventory numbers are unaffected — try again.";
            const retry = onRetryRef.current;
            // Before finish(), which clears the run id these guards key on.
            trackOncePerSession("analysis_failed", runId, {
              source: "proactive_upload",
              organization_id: organizationId,
              error_type: "backend_reported",
              duration_ms: Date.now() - startedAt,
              success: false,
            });
            finish(() => {
              storeOutcome({
                kind: "failed",
                organizationId: organizationId as string,
                message: description,
              });
              toast.error("Analysis didn't finish", {
                description,
                duration: 10000,
                ...(retry ? { action: { label: "Try again", onClick: retry } } : {}),
              });
            });
            return;
          }

          if (status === "completed") {
            keepPolling = false;
            const count = data.recommendations_count ?? 0;
            const view = onViewRef.current;
            const destination = resolveAnalysisDestination(data.primary_type);
            const title =
              count > 0
                ? `${count} new recommendation${count === 1 ? "" : "s"} ready`
                : "Analysis complete";

            trackOncePerSession("analysis_completed", runId, {
              source: "proactive_upload",
              organization_id: organizationId,
              recommendation_count: count,
              duration_ms: Date.now() - startedAt,
              success: true,
            });
            // Separate from analysis_completed: a run that finishes having found
            // nothing is a very different outcome from one that produced a
            // recommendation, and only the latter can activate anyone.
            if (count > 0) {
              trackOncePerSession("recommendation_generated", runId, {
                source: "proactive_upload",
                organization_id: organizationId,
                recommendation_count: count,
              });
            }

            finish(() => {
              // Persisted before the toast: the result must outlive it.
              storeOutcome({
                kind: "completed",
                organizationId: organizationId as string,
                message: title,
                count,
                href: destination.href,
                label: destination.label,
              });
              toast.success(title, {
                description: "EVE finished analysing your business data.",
                ...(view
                  ? {
                      action: {
                        label: destination.label,
                        onClick: () => view(destination),
                      },
                    }
                  : {}),
              });
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
              // Stop watching, but never silently. Clearing the flags with no
              // message left a merchant waiting indefinitely for a first
              // insight that would never announce itself — the single worst
              // moment in the activation flow, and the one most likely to end
              // the trial. Say what happened and offer the way out.
              const message =
                "Your analysis is taking longer than usual. Your inventory numbers are ready to use — you can retry the AI analysis whenever you like.";
              const retry = onRetryRef.current;
              // A timeout is a failed activation even though the backend never
              // said so; error_type keeps it separable from a reported failure.
              trackOncePerSession("analysis_failed", runId, {
                source: "proactive_upload",
                organization_id: organizationId,
                error_type: "client_timeout",
                duration_ms: Date.now() - startedAt,
                success: false,
              });
              finish(() => {
                storeOutcome({
                  kind: "timed_out",
                  organizationId: organizationId as string,
                  message,
                });
                toast.warning("Analysis is taking longer than usual", {
                  description: message,
                  duration: 12000,
                  ...(retry ? { action: { label: "Try again", onClick: retry } } : {}),
                });
              });
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
