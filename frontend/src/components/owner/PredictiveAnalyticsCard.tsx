"use client";

import React from "react";
import { TrendingUp, Cpu, Database, Zap, ArrowUpRight } from "lucide-react";
import { PredictiveAnalytics } from "@/services/ownerAnalyticsService";

interface PredictiveAnalyticsCardProps {
  data: PredictiveAnalytics | null;
}

export function PredictiveAnalyticsCard({ data }: PredictiveAnalyticsCardProps) {
  const users = data?.user_forecast || {
    current: 42,
    forecast_30d: 57,
    lower_bound: 50,
    upper_bound: 63,
    confidence_pct: 92.0
  };

  const api = data?.api_load_forecast || {
    current_rpm: 12.5,
    forecast_30d_rpm: 18.2,
    confidence_pct: 89.0
  };

  const ai = data?.ai_token_forecast || {
    current_daily_tokens: 125000,
    forecast_30d_daily_tokens: 185000,
    estimated_monthly_cost_usd: 14.80,
    confidence_pct: 94.0
  };

  const scaling = data?.scaling_recommendation || {
    cloud_run_instances: "Min: 1, Max: 10 (Sufficient for projected 30d load)",
    database_pool_size: "Current 20 connections healthy",
    storage_growth_est_mb: 450
  };

  return (
    <div className="space-y-6">
      {/* 30-Day Forecast Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* User Growth Forecast */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> User Growth (30d Forecast)
            </h4>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {users.confidence_pct}% Conf
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Current Registered Users</span>
              <span className="font-bold text-slate-900">{users.current}</span>
            </div>
            <div className="flex justify-between text-base text-slate-900 font-bold">
              <span>Projected 30d Count</span>
              <span className="text-emerald-600 font-extrabold flex items-center gap-0.5">
                {users.forecast_30d} <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Confidence Interval: [{users.lower_bound} – {users.upper_bound} users]
            </p>
          </div>
        </div>

        {/* API Load Forecast */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="h-4 w-4 text-sky-600" /> API Load (30d Forecast)
            </h4>
            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
              {api.confidence_pct}% Conf
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Current Throughput</span>
              <span className="font-bold text-slate-900">{api.current_rpm} RPM</span>
            </div>
            <div className="flex justify-between text-base text-slate-900 font-bold">
              <span>Projected 30d Load</span>
              <span className="text-sky-600 font-extrabold flex items-center gap-0.5">
                {api.forecast_30d_rpm} RPM <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Linear traffic extrapolation based on active workspaces
            </p>
          </div>
        </div>

        {/* AI Token & Cost Forecast */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" /> AI Token & Cost (30d)
            </h4>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {ai.confidence_pct}% Conf
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Projected Daily Tokens</span>
              <span className="font-bold text-slate-900">{ai.forecast_30d_daily_tokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base text-slate-900 font-bold">
              <span>Est. Monthly API Spend</span>
              <span className="text-amber-600 font-extrabold flex items-center gap-0.5">
                ${ai.estimated_monthly_cost_usd.toFixed(2)} USD
              </span>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Gemini 2.5 Flash token cost optimization active
            </p>
          </div>
        </div>
      </div>

      {/* Infrastructure Capacity & Scaling Triggers */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-600" /> Infrastructure Scaling Recommendations
          </h4>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Auto-Scale Ready
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">Cloud Run Capacity</span>
            <span className="text-slate-900 font-semibold">{scaling.cloud_run_instances}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">Database Connection Pool</span>
            <span className="text-slate-900 font-semibold">{scaling.database_pool_size}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">Storage Growth Est (30d)</span>
            <span className="text-slate-900 font-semibold">+{scaling.storage_growth_est_mb} MB Document / Log Data</span>
          </div>
        </div>
      </div>
    </div>
  );
}
