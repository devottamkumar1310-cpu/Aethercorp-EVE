"use client";

import React from "react";
import { InternalEvent } from "@/services/ownerAnalyticsService";
import { Terminal, Shield, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface EventLogTableProps {
  events: InternalEvent[];
  loading: boolean;
}

export const EventLogTable: React.FC<EventLogTableProps> = ({ events, loading }) => {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl animate-pulse h-64">
        <div className="h-5 w-48 bg-slate-800 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-full bg-slate-800/40 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Live Internal Telemetry Stream</h3>
            <p className="text-xs text-slate-400">Real-time audit log feed of backend telemetry and platform events</p>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/50">
          Showing last {events.length} events
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-xs font-mono">
          No telemetry events recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="pb-3 px-3">Timestamp</th>
                <th className="pb-3 px-3">Event Type</th>
                <th className="pb-3 px-3">Endpoint</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {events.map((evt) => {
                const isError = (evt.status_code || 200) >= 400;
                return (
                  <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : "-"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-amber-300 border border-slate-700">
                        {evt.event_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 truncate max-w-xs">
                      {evt.endpoint || "/api/internal"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isError
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {isError ? <AlertCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                        {evt.status_code || 200}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {evt.latency_ms ? `${evt.latency_ms.toFixed(1)} ms` : "0 ms"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
