"use client";

import React from "react";
import { InternalEvent } from "@/services/ownerAnalyticsService";
import { Terminal, CheckCircle, AlertCircle } from "lucide-react";

interface EventLogTableProps {
  events: InternalEvent[];
  loading: boolean;
}

export const EventLogTable: React.FC<EventLogTableProps> = ({ events, loading }) => {
  if (loading) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Live Internal Telemetry Stream</h3>
            <p className="text-xs text-slate-500">Real-time audit log feed of backend telemetry and platform events</p>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-semibold">
          Showing last {events.length} events
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-xs font-mono">
          No telemetry events recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] bg-slate-50">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Endpoint</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {events.map((evt) => {
                const isError = (evt.status_code || 200) >= 400;
                return (
                  <tr key={evt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : "-"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        {evt.event_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 font-medium truncate max-w-xs">
                      {evt.endpoint || "/api/internal"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          isError
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {isError ? <AlertCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                        {evt.status_code || 200}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500 font-semibold">
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
