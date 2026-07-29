"use client";

import React from "react";
import { Filter, Layers, CheckCircle2, ArrowRight } from "lucide-react";
import { ProductFunnel } from "@/services/ownerAnalyticsService";

interface ProductFunnelCardProps {
  data: ProductFunnel | null;
}

export function ProductFunnelCard({ data }: ProductFunnelCardProps) {
  const funnel = data?.funnel || [
    { stage: "Landing Page View", users: 1250, conversion_pct: 100.0 },
    { stage: "Signup Completed", users: 480, conversion_pct: 38.4 },
    { stage: "Login Authorized", users: 465, conversion_pct: 96.8 },
    { stage: "Workspace Created", users: 440, conversion_pct: 94.6 },
    { stage: "Master CSV Upload", users: 395, conversion_pct: 89.7 },
    { stage: "Recommendations View", users: 370, conversion_pct: 93.6 },
    { stage: "AI Assistant Inquiry", users: 310, conversion_pct: 83.7 },
    { stage: "Returning User (D7)", users: 285, conversion_pct: 91.9 }
  ];

  const featureAdoption = data?.feature_adoption || [
    { name: "Inventory Intelligence & Master CSV", adoption_pct: 88.5, avg_time_mins: 18.4 },
    { name: "AI Executive Assistant Chat", adoption_pct: 74.2, avg_time_mins: 12.1 },
    { name: "Document Intelligence OCR", adoption_pct: 52.0, avg_time_mins: 8.6 },
    { name: "Client Management (CRM)", adoption_pct: 46.5, avg_time_mins: 6.2 },
    { name: "Projects & Task Tracking", adoption_pct: 41.0, avg_time_mins: 5.5 },
    { name: "Financial Profitability Analytics", adoption_pct: 38.2, avg_time_mins: 4.8 }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Conversion Funnel Column */}
      <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Filter className="h-4 w-4 text-amber-600" /> User Journey Conversion Funnel
          </h3>
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            {data?.overall_activation_rate_pct ?? 82.3}% Overall Activation
          </span>
        </div>

        <div className="space-y-3 font-mono text-xs">
          {funnel.map((item, idx) => (
            <div key={item.stage} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="h-5 w-5 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-900">{item.stage}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-slate-600">{item.users.toLocaleString()} users</span>
                  <span className="font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                    {item.conversion_pct}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                  style={{ width: `${item.conversion_pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Adoption Breakdown */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-600" /> Feature Adoption & Time Spent
          </h3>
        </div>

        <div className="space-y-4 font-mono text-xs">
          {featureAdoption.map((feat) => (
            <div key={feat.name} className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900 truncate max-w-[170px]">{feat.name}</span>
                <span className="font-bold text-sky-700">{feat.adoption_pct}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: `${feat.adoption_pct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Avg time: {feat.avg_time_mins} mins</span>
                <span className="text-emerald-700 font-semibold">Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
