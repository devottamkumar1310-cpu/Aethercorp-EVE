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
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-center justify-between text-xs font-mono text-emerald-800 shadow-2xs">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>System Operational — Zero active platform alert flags. All backend services healthy.</span>
        </div>
        <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800">
          HEALTHY
        </span>
      </div>
    );
  }

  const severityStyles = {
    high: "bg-rose-50 border-rose-200 text-rose-900",
    medium: "bg-amber-50 border-amber-200 text-amber-900",
    low: "bg-sky-50 border-sky-200 text-sky-900",
  };

  const severityIcons = {
    high: AlertOctagon,
    medium: AlertTriangle,
    low: Info,
  };

  return (
    <div className="space-y-3 font-sans">
      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" /> Active Platform System Alerts ({alerts.length})
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {alerts.map((alert) => {
          const Icon = severityIcons[alert.severity] || AlertTriangle;
          return (
            <div
              key={alert.id}
              className={`rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-3 ${severityStyles[alert.severity]}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white border border-current">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold font-mono tracking-tight">{alert.title}</h4>
                </div>
                <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded border border-current">
                  {alert.severity}
                </span>
              </div>

              <p className="text-xs font-sans text-slate-700">{alert.message}</p>

              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono text-slate-600">
                <span>Action required:</span>
                <span className="font-semibold text-slate-900">{alert.action}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
