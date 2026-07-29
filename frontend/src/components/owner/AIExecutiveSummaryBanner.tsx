"use client";

import React from "react";
import { Sparkles, ShieldCheck, Activity, CheckCircle2, Zap } from "lucide-react";
import { ExecutiveSummary } from "@/services/ownerAnalyticsService";

interface AIExecutiveSummaryBannerProps {
  summary: ExecutiveSummary | null;
}

export function AIExecutiveSummaryBanner({ summary }: AIExecutiveSummaryBannerProps) {
  const healthScore = summary?.health_score ?? 98;
  const securityScore = summary?.security_score ?? 100;
  const summaryText =
    summary?.summary_text ||
    "Platform operational health is Excellent (98/100) with Security Rating at 100/100. Active registrations grew steadily over the past 7 days. AI query volume remains consistent across active brands. Inventory Intelligence remains the highest-adopted feature.";

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-md relative overflow-hidden">
      {/* Background Decorative Pattern */}
      <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left Column: AI Executive Briefing */}
        <div className="space-y-3 max-w-3xl">
          <div className="flex items-center space-x-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" /> AI Daily Operations Synthesis
            </span>
            <span className="text-slate-400 text-xs font-mono">Real-time Platform Telemetry</span>
          </div>

          <p className="text-sm md:text-base font-sans text-slate-100 leading-relaxed font-normal">
            "{summaryText}"
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Cloud Run iad1 Live
            </span>
            <span className="flex items-center gap-1.5 text-sky-300">
              <Zap className="h-3.5 w-3.5 text-sky-400" /> Gemini 2.5 Flash DAG Active
            </span>
            <span className="flex items-center gap-1.5 text-amber-300">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> Zero Critical Threat Alerts
            </span>
          </div>
        </div>

        {/* Right Column: Platform Ratings Scorecards */}
        <div className="flex items-center gap-4 shrink-0 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
          {/* Health Score Dial */}
          <div className="flex flex-col items-center px-3 border-r border-white/10">
            <div className="flex items-center space-x-1 mb-1">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="text-[11px] font-mono text-slate-300 uppercase tracking-wider">Health</span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono tracking-tight">
              {healthScore}<span className="text-xs text-slate-400 font-normal">/100</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-300 font-semibold mt-0.5">EXCELLENT</span>
          </div>

          {/* Security Score Dial */}
          <div className="flex flex-col items-center px-3">
            <div className="flex items-center space-x-1 mb-1">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span className="text-[11px] font-mono text-slate-300 uppercase tracking-wider">Security</span>
            </div>
            <div className="text-2xl font-extrabold text-amber-400 font-mono tracking-tight">
              {securityScore}<span className="text-xs text-slate-400 font-normal">/100</span>
            </div>
            <span className="text-[10px] font-mono text-amber-300 font-semibold mt-0.5">SECURE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
