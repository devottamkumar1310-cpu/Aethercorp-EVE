"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface OwnerMetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  changeBadge?: string;
  badgeType?: "success" | "warning" | "neutral" | "danger";
  icon: LucideIcon;
  gradient?: string;
}

export const OwnerMetricCard: React.FC<OwnerMetricCardProps> = ({
  title,
  value,
  subtext,
  changeBadge,
  badgeType = "success",
  icon: Icon,
  gradient = "from-amber-500/15 to-orange-500/5",
}) => {
  const badgeColors = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    neutral: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  };

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/10"
    >
      <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${gradient} blur-2xl group-hover:scale-125 transition-transform duration-500`} />

      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
          {title}
        </span>
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-2.5 text-amber-400 shadow-inner group-hover:border-amber-500/40 transition-colors">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between relative z-10">
        <span className="text-3xl font-bold tracking-tight text-white font-mono">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {changeBadge && (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold font-mono ${badgeColors[badgeType]}`}
          >
            {changeBadge}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-2.5 text-xs text-slate-400 font-sans relative z-10 flex items-center gap-1">
          {subtext}
        </p>
      )}
    </div>
  );
};
