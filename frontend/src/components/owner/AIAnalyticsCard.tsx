"use client";

import React from "react";
import { AIAnalytics } from "@/services/ownerAnalyticsService";
import { Bot, MessageSquare, Clock, CheckCheck, AlertCircle, Sparkles } from "lucide-react";

interface AIAnalyticsCardProps {
  aiData: AIAnalytics | null;
  loading: boolean;
}

export const AIAnalyticsCard: React.FC<AIAnalyticsCardProps> = ({ aiData, loading }) => {
  if (loading || !aiData) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl animate-pulse h-64">
        <div className="h-5 w-40 bg-slate-800 rounded mb-4" />
        <div className="h-10 w-full bg-slate-800/50 rounded mb-2" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              EVE AI Executive Performance Telemetry <Sparkles className="h-4 w-4 text-purple-400" />
            </h3>
            <p className="text-xs text-slate-400 font-mono">Gemini AI model latencies, conversation volume & recommendation acceptance</p>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <MessageSquare className="h-3.5 w-3.5 text-purple-400" /> Total AI Conversations
          </span>
          <p className="text-2xl font-bold text-white">{aiData.total_conversations.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 mt-1">{aiData.total_prompts.toLocaleString()} total prompts</p>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-amber-400" /> Avg AI Response Latency
          </span>
          <p className="text-2xl font-bold text-white">{aiData.avg_response_time_ms} <span className="text-xs font-normal text-slate-400">ms</span></p>
          <p className="text-[10px] text-slate-500 mt-1">LLM inference roundtrip</p>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> Recommendation Acceptance
          </span>
          <p className="text-2xl font-bold text-emerald-400">{aiData.acceptance_rate_pct}%</p>
          <p className="text-[10px] text-slate-500 mt-1">{aiData.accepted_traces} / {aiData.total_recommendation_traces} executed</p>
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <AlertCircle className="h-3.5 w-3.5 text-rose-400" /> 24h Gemini AI Failures
          </span>
          <p className={`text-2xl font-bold ${aiData.ai_errors_24h > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {aiData.ai_errors_24h}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Quota / model exceptions</p>
        </div>
      </div>

      {/* AI Workflow Distribution */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-semibold font-mono text-slate-300 uppercase tracking-wider">Top AI Executive Workflows</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {aiData.most_common_workflows.map((wf) => (
            <div key={wf.name} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 truncate max-w-xs">{wf.name}</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                {wf.share_pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
