"use client";

import React, { useEffect, useState } from "react";
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
}: ProactiveAnalysisBannerProps) {
  const [status, setStatus] = useState<AnalysisStatus["status"]>("in_progress");
  const [step, setStep] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [recommendationCount, setRecommendationCount] = useState(0);
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;

    let isMounted = true;
    let pollCount = 0;
    const MAX_POLLS = 90; // 3 minutes max

    const checkStatus = async () => {
      if (!isMounted || pollCount > MAX_POLLS) return;
      pollCount++;

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/organization/${organizationId}/analysis-status`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        if (!res.ok || !isMounted) return;

        const data: AnalysisStatus = await res.json();

        if (isMounted) {
          setStatus(data.status ?? "in_progress");
          setStep(data.step ?? 0);

          if (data.status === "failed") {
            setError(data.error ?? "An unknown error occurred.");
          } else if (data.status === "completed") {
            setRecommendationCount(data.recommendations_count ?? 0);
            if (onComplete) onComplete();
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    };

    checkStatus();

    const interval = setInterval(() => {
      if (status === "completed" || status === "failed" || !isMounted) {
        clearInterval(interval);
        return;
      }
      checkStatus();
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [organizationId, sessionToken, dismissed, status, onComplete]);

  const handleViewRecommendations = () => {
    setDismissed(true);
    setVisible(false);
    if (onDismiss) onDismiss();
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    if (onDismiss) onDismiss();
  };

  if (!visible) return null;

  return (
    <div className="mx-6 mt-6 overflow-hidden rounded-xl border border-violet-500/25 bg-gradient-to-r from-violet-950/40 via-purple-950/30 to-indigo-950/40 backdrop-blur-sm shadow-lg relative">
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
                <p className="text-xs text-red-400 mt-0.5">{error}</p>
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
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
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
                      : "border-white/5 bg-white/2"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 text-violet-400 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-white/15 flex-shrink-0" />
                  )}
                  <span
                    className={`text-[11px] leading-tight ${
                      isCompleted
                        ? "text-emerald-300 font-medium"
                        : isCurrent
                        ? "text-violet-300 font-medium"
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
