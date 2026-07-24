"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle, X, Sparkles } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

interface AnalysisStatus {
  status: "none" | "in_progress" | "completed" | "failed";
  step: number;
  error?: string | null;
  recommendations_count?: number;
}

interface ProactiveAnalysisBannerProps {
  organizationId: string;
  sessionToken: string;
  onComplete?: () => void;
  onDismiss?: () => void;
  /**
   * Called when there is no analysis to show — the backend reports status
   * "none" (a stale trigger, or a run already consumed in a previous session)
   * or polling times out without ever completing. The parent should clear its
   * pending flag and unmount the banner. Without this the banner would render
   * as an empty box that never goes away.
   */
  onExpire?: () => void;
}

const STEPS = [
  "Processing data",
  "Calculating business metrics",
  "Generating executive recommendations",
  "Creating decision traces",
];

export default function ProactiveAnalysisBanner({
  organizationId,
  sessionToken,
  onComplete,
  onDismiss,
  onExpire,
}: ProactiveAnalysisBannerProps) {
  const [status, setStatus] = useState<AnalysisStatus["status"]>("in_progress");
  const [step, setStep] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [recommendationCount, setRecommendationCount] = useState(0);
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const onDismissRef = useRef(onDismiss);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onDismissRef.current = onDismiss;
    onExpireRef.current = onExpire;
  }, [onComplete, onDismiss, onExpire]);

  useEffect(() => {
    if (dismissed) return;

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let pollCount = 0;
    let completedNotified = false;
    const MAX_POLLS = 90; // 3 minutes max

    const checkStatus = async () => {
      if (controller.signal.aborted || pollCount >= MAX_POLLS) return;
      pollCount++;
      let shouldContinue = true;

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/organization/${organizationId}/analysis-status`,
          {
            headers: { Authorization: `Bearer ${sessionToken}` },
            signal: controller.signal,
          }
        );
        if (!res.ok || controller.signal.aborted) return;

        const data: AnalysisStatus = await res.json();
        if (controller.signal.aborted) return;

        const nextStatus = data.status ?? "in_progress";

        // "none" means no analysis is actually running for this workspace —
        // a stale pending flag, or a run already consumed. Never render the
        // banner in that case: tear it down and let the parent clear its flag.
        if (nextStatus === "none") {
          shouldContinue = false;
          setVisible(false);
          setDismissed(true);
          onExpireRef.current?.();
          return;
        }

        setStatus(nextStatus);
        setStep(data.step ?? 0);

        if (nextStatus === "failed") {
          setError(data.error ?? "An unknown error occurred.");
          shouldContinue = false;
        }

        if (nextStatus === "completed") {
          setRecommendationCount(data.recommendations_count ?? 0);
          if (!completedNotified) {
            completedNotified = true;
            onCompleteRef.current?.();
          }
          shouldContinue = false;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (shouldContinue && !controller.signal.aborted) {
          if (pollCount < MAX_POLLS) {
            timeoutId = setTimeout(checkStatus, 2000);
          } else {
            // Timed out still "in_progress" — don't leave the banner spinning
            // forever. Clear it so a refresh won't resurrect a dead run.
            setVisible(false);
            setDismissed(true);
            onExpireRef.current?.();
          }
        }
      }
    };

    checkStatus();

    return () => {
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [organizationId, sessionToken, dismissed]);

  const handleViewRecommendations = () => {
    setDismissed(true);
    setVisible(false);
    onDismissRef.current?.();
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    onDismissRef.current?.();
  };

  if (!visible) return null;

  return (
    <div className="mx-6 mt-6 overflow-hidden rounded-xl border border-violet-500/25 bg-violet-500/[0.06] shadow-sm relative">
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500/60 via-purple-500/80 to-indigo-500/60" />

      <div className="p-5 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-start gap-3 justify-between">
          <div className="flex items-center gap-3">
            {status === "in_progress" && (
              <div className="h-9 w-9 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
                <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
              </div>
            )}
            {status === "completed" && (
              <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
            )}
            {status === "failed" && (
              <div className="h-9 w-9 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-foreground leading-tight">
                {status === "in_progress" && "EVE is analyzing your business..."}
                {status === "completed" && `${recommendationCount} recommendation${recommendationCount !== 1 ? "s" : ""} generated`}
                {status === "failed" && "Analysis could not be completed"}
              </h3>
              {status === "in_progress" && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  This may take up to 30 seconds. Dashboard will update automatically.
                </p>
              )}
              {status === "completed" && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your executive recommendations are ready to view.
                </p>
              )}
              {status === "failed" && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {status === "completed" && (
              <button
                onClick={handleViewRecommendations}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 px-4 py-2 text-xs font-semibold text-white transition-colors shadow-md shadow-violet-700/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                View Recommendations
              </button>
            )}
            {(status === "failed" || status === "completed") && (
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress steps */}
        {(status === "in_progress" || status === "completed") && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STEPS.map((label, idx) => {
              const stepNumber = idx + 1;
              const isCompleted = step > stepNumber || status === "completed";
              const isCurrent = step === stepNumber && status === "in_progress";

              return (
                <div
                  key={label}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300 ${
                    isCompleted
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : isCurrent
                      ? "border-violet-500/40 bg-violet-500/10"
                      : "border-border bg-muted/40"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 flex-shrink-0" />
                  )}
                  <span
                    className={`text-[11px] leading-tight ${
                      isCompleted
                        ? "text-emerald-700 dark:text-emerald-300 font-medium"
                        : isCurrent
                        ? "text-violet-700 dark:text-violet-300 font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
