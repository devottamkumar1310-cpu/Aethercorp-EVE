"use client";

import React from "react";
import { PlatformHealth } from "@/services/ownerAnalyticsService";
import { Activity, Database, HardDrive, Cpu, AlertTriangle, CheckCircle2, Server } from "lucide-react";

interface PlatformHealthCardProps {
  health: PlatformHealth | null;
  loading: boolean;
}

export const PlatformHealthCard: React.FC<PlatformHealthCardProps> = ({ health, loading }) => {
  if (loading || !health) return null;

  const isHealthy = health.status === "operational";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl ${isHealthy ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">System Infrastructure Telemetry</h3>
            <p className="text-xs text-slate-500 font-mono">
              Cloud Run Revision: <span className="font-bold text-slate-700">{health.deployment.cloud_run_revision}</span> | Last checked: {new Date(health.checked_at).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold font-mono border ${isHealthy ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {isHealthy ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          <span className="uppercase">{health.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2 font-mono">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-amber-700" /> Database Latency
            </span>
            <span className="text-xs font-bold text-emerald-700">{health.database.status}</span>
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900">{health.database.latency_ms} <span className="text-xs font-semibold text-slate-500">ms</span></p>
        </div>

        {/* Storage */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2 font-mono">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-sky-700" /> Storage Engine
            </span>
          </div>
          <p className="text-base font-bold font-mono text-slate-800 capitalize">{health.storage.status}</p>
        </div>

        {/* System Load */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2 font-mono">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-purple-700" /> CPU / Memory
            </span>
          </div>
          <p className="text-xl font-extrabold font-mono text-slate-900">
            {health.system.cpu_percent}% <span className="text-xs font-normal text-slate-500">CPU</span> / {health.system.memory_percent}% <span className="text-xs font-normal text-slate-500">RAM</span>
          </p>
        </div>

        {/* 24h Error Rate */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between text-slate-500 mb-2 font-mono">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> 24h Errors (4xx/5xx)
            </span>
          </div>
          <p className={`text-2xl font-extrabold font-mono ${health.error_count_24h > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            {health.error_count_24h} <span className="text-xs font-normal text-slate-500">events</span>
          </p>
        </div>
      </div>
    </div>
  );
};
