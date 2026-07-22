"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIDisclaimerProps {
  className?: string;
  variant?: "card" | "banner" | "inline";
}

export function AIDisclaimer({ className, variant = "card" }: AIDisclaimerProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10 p-4 text-foreground shadow-xs transition-colors backdrop-blur-xs",
        variant === "inline" && "p-3 rounded-lg border-amber-500/20 text-xs",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 tracking-tight flex items-center gap-1.5">
            AI can make mistakes.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            EVE provides AI-powered recommendations to support decision-making, not replace it. Always review important operational, financial, inventory, and strategic recommendations before implementation.
          </p>
        </div>
      </div>
    </div>
  );
}
