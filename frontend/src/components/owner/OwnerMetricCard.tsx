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
}) => {
  const badgeColors = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300"
    >
      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
          {title}
        </span>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-amber-700 shadow-xs group-hover:bg-amber-50 transition-colors">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between relative z-10">
        <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {changeBadge && (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold font-mono ${badgeColors[badgeType]}`}
          >
            {changeBadge}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-2.5 text-xs text-slate-500 font-sans relative z-10 flex items-center gap-1 font-medium">
          {subtext}
        </p>
      )}
    </div>
  );
};
