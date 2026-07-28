"use client";

import React from "react";
import { PlatformHealth } from "@/services/ownerAnalyticsService";
import { Activity, Database, HardDrive, Cpu, AlertTriangle, CheckCircle2 } from "lucide-react";

interface PlatformHealthCardProps {
  health: PlatformHealth | null;
  loading: boolean;
}

export const PlatformHealthCard: React.FC<PlatformHealthCardProps> = ({ health, loading }) => {
  if (loading || !health) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl animate-pulse h-64">
        <div className="h-5 w-40 bg-slate-800 rounded mb-4" />
        <div className="h-10 w-full bg-slate-800/50 rounded mb-2" />
        <div className="h-10 w-full bg-slate-800/50 rounded mb-2" />
      </div>
    );
  }

  const isHealthy = health.status === "operational";

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl ${isHealthy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">System Infrastructure Telemetry</h3>
            <p className="text-xs text-slate-400 font-mono">Last checked: {new Date(health.checked_at).toLocaleTimeString()}</p>
          </div>
        </div>
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold font-mono border ${isHealthy ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
          {isHealthy ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          <span className="uppercase">{health.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-amber-400" /> Database Latency
            </span>
            <span className="text-xs font-mono text-emerald-400">{health.database.status}</span>
          </div>
          <p className="text-2xl font-bold font-mono text-white">{health.database.latency_ms} <span className="text-xs font-normal text-slate-400">ms</span></p>
        </div>

        {/* Storage */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-sky-400" /> Storage Engine
            </span>
          </div>
          <p className="text-base font-semibold font-mono text-slate-200 capitalize">{health.storage.status}</p>
        </div>

        {/* System Load */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-purple-400" /> CPU / Memory
            </span>
          </div>
          <p className="text-xl font-bold font-mono text-white">
            {health.system.cpu_percent}% <span className="text-xs font-normal text-slate-400">CPU</span> / {health.system.memory_percent}% <span className="text-xs font-normal text-slate-400">RAM</span>
          </p>
        </div>

        {/* 24h Error Rate */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" /> 24h Errors (4xx/5xx)
            </span>
          </div>
          <p className={`text-2xl font-bold font-mono ${health.error_count_24h > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {health.error_count_24h} <span className="text-xs font-normal text-slate-400">events</span>
          </p>
        </div>
      </div>
    </div>
  );
};
