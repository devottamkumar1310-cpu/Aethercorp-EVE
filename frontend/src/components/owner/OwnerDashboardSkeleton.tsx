"use client";

import React from "react";

export const OwnerDashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse font-sans">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-slate-200 rounded-xl" />
          <div className="h-4 w-96 bg-slate-200/80 rounded-lg" />
        </div>
        <div className="h-9 w-36 bg-slate-200 rounded-xl" />
      </div>

      {/* Alert Cards Skeleton */}
      <div className="h-16 w-full bg-white border border-slate-200 rounded-2xl shadow-xs" />

      {/* Metric Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <div className="h-4 w-28 bg-slate-200 rounded" />
              <div className="h-8 w-8 bg-slate-100 rounded-xl" />
            </div>
            <div className="h-8 w-20 bg-slate-300 rounded-xl" />
            <div className="h-3 w-32 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* AI Telemetry Skeleton */}
      <div className="h-72 rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-xs">
        <div className="h-6 w-56 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-50 border border-slate-200 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Health & User Table Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
        <div className="h-80 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
      </div>
    </div>
  );
};
