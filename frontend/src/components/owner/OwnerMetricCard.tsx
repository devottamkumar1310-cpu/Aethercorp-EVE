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
  gradient = "from-amber-500/10 to-orange-500/5",
}) => {
  const badgeColors = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    neutral: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl transition-all duration-300 hover:border-slate-700 hover:shadow-2xl hover:shadow-amber-500/5`}
    >
      <div className={`absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${gradient} blur-2xl`} />

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 text-amber-400 shadow-inner">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-3xl font-bold tracking-tight text-white font-mono">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {changeBadge && (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium font-mono ${badgeColors[badgeType]}`}
          >
            {changeBadge}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-2 text-xs text-slate-400">
          {subtext}
        </p>
      )}
    </div>
  );
};
