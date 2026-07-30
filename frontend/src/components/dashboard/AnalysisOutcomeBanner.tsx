"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, RefreshCw, X } from "lucide-react";
import {
  readStoredOutcome,
  clearStoredOutcome,
  type StoredAnalysisOutcome,
} from "@/hooks/useProactiveAnalysis";

/**
 * Surfaces the last analysis outcome until the merchant acts on it.
 *
 * Toasts were previously the only channel, so the result of a founder's first
 * analysis vanished after a few seconds — and vanished entirely if they were on
 * another tab while it finished. This keeps it on screen: what happened, and
 * the one thing to do next.
 */
export function AnalysisOutcomeBanner({
  onView,
  onRetry,
}: {
  onView: (href: string) => void;
  onRetry: () => void;
}) {
  const [outcome, setOutcome] = useState<StoredAnalysisOutcome | null>(null);

  useEffect(() => {
    const sync = () => setOutcome(readStoredOutcome());
    sync();
    // Same-tab writes dispatch this; `storage` covers a second tab.
    window.addEventListener("eve_analysis_outcome", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("eve_analysis_outcome", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!outcome) return null;

  const dismiss = () => {
    clearStoredOutcome();
    setOutcome(null);
  };

  const isGood = outcome.kind === "completed";
  const hasResults = isGood && (outcome.count ?? 0) > 0;

  const tone = isGood
    ? "border-emerald-500/30 bg-emerald-500/[0.06]"
    : outcome.kind === "timed_out"
      ? "border-amber-500/30 bg-amber-500/[0.06]"
      : "border-rose-500/30 bg-rose-500/[0.06]";

  const Icon = isGood ? CheckCircle2 : outcome.kind === "timed_out" ? Clock : AlertTriangle;
  const iconTone = isGood
    ? "text-emerald-600"
    : outcome.kind === "timed_out"
      ? "text-amber-600"
      : "text-rose-600";

  return (
    <div
      role="status"
      className={`mx-4 mt-4 rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${tone}`}
    >
      <Icon size={18} className={`shrink-0 ${iconTone}`} aria-hidden />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-foreground">
          {isGood ? outcome.message : outcome.kind === "timed_out" ? "Analysis is taking longer than usual" : "Analysis didn't finish"}
        </div>
        {!isGood && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{outcome.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {hasResults && outcome.href ? (
          <button
            type="button"
            onClick={() => {
              const href = outcome.href as string;
              dismiss();
              onView(href);
            }}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer"
          >
            {outcome.label || "View"}
            <ArrowRight size={13} aria-hidden />
          </button>
        ) : !isGood ? (
          <button
            type="button"
            onClick={() => {
              dismiss();
              onRetry();
            }}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer"
          >
            <RefreshCw size={13} aria-hidden />
            Try again
          </button>
        ) : null}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="min-h-[36px] w-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
