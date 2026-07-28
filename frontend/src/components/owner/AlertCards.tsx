"use client";

import React from "react";
import { SystemAlert } from "@/services/ownerAnalyticsService";
import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

interface AlertCardsProps {
  alerts: SystemAlert[];
  loading: boolean;
}

export const AlertCards: React.FC<AlertCardsProps> = ({ alerts, loading }) => {
  if (loading) return null;

  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center justify-between text-xs font-mono text-emerald-400 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>System Healthy — Zero active platform alert flags. All systems operational.</span>
        </div>
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
          HEALTHY
        </span>
      </div>
    );
  }

  const severityStyles = {
    high: "bg-rose-500/10 border-rose-500/30 text-rose-400",
    medium: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    low: "bg-sky-500/10 border-sky-500/30 text-sky-400",
  };

  const severityIcons = {
    high: AlertOctagon,
    medium: AlertTriangle,
    low: Info,
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-400" /> Active Platform System Alerts ({alerts.length})
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {alerts.map((alert) => {
          const Icon = severityIcons[alert.severity] || AlertTriangle;
          return (
            <div
              key={alert.id}
              className={`rounded-2xl border p-5 backdrop-blur-xl flex flex-col justify-between space-y-3 ${severityStyles[alert.severity]}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-current">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold font-mono tracking-tight text-white">{alert.title}</h4>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border border-current">
                  {alert.severity}
                </span>
              </div>

              <p className="text-xs text-slate-300 font-mono">{alert.message}</p>

              <div className="pt-2 border-t border-slate-800/50 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Action required:</span>
                <span className="text-slate-200 font-medium">{alert.action}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
