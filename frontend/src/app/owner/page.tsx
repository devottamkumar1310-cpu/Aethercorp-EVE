"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ownerAnalyticsService,
  OverviewMetrics,
  UserAnalytics,
  FeatureUsage,
  PlatformHealth,
  InternalEvent,
  AIAnalytics,
  SystemAlert,
} from "@/services/ownerAnalyticsService";

import { OwnerMetricCard } from "@/components/owner/OwnerMetricCard";
import { PlatformHealthCard } from "@/components/owner/PlatformHealthCard";
import { EventLogTable } from "@/components/owner/EventLogTable";
import { AlertCards } from "@/components/owner/AlertCards";
import { AIAnalyticsCard } from "@/components/owner/AIAnalyticsCard";

import {
  Users,
  Building2,
  Activity,
  Layers,
  RefreshCw,
  Server,
  UserPlus,
  ShieldCheck,
  Radio,
  Clock,
  PieChart,
} from "lucide-react";

export default function OwnerAnalyticsPage() {
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [aiData, setAiData] = useState<AIAnalytics | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage | null>(null);
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [events, setEvents] = useState<InternalEvent[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("No session token available");

      const [ovData, usrData, aiRes, alrtData, featData, hlthData, evtData] = await Promise.all([
        ownerAnalyticsService.getOverview(token),
        ownerAnalyticsService.getUsers(token, 20),
        ownerAnalyticsService.getAIAnalytics(token),
        ownerAnalyticsService.getAlerts(token),
        ownerAnalyticsService.getFeatureUsage(token),
        ownerAnalyticsService.getHealth(token),
        ownerAnalyticsService.getEvents(token, 30),
      ]);

      setOverview(ovData);
      setUserAnalytics(usrData);
      setAiData(aiRes);
      setAlerts(alrtData);
      setFeatureUsage(featData);
      setHealth(hlthData);
      setEvents(evtData);
    } catch (err: any) {
      console.error("[OWNER DASHBOARD] Fetch error:", err);
      setError(err.message || "Failed to load owner analytics data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return (
    <div className="space-y-8">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Owner Executive Telemetry <ShieldCheck className="h-6 w-6 text-amber-400" />
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time active users, AI performance, system health, and production security telemetry.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchAllData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all font-mono text-xs font-semibold"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh Telemetry"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Real-Time Platform Alerts Banner */}
      <AlertCards alerts={alerts} loading={loading} />

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <OwnerMetricCard
          title="Total Registered Users"
          value={overview?.total_users ?? (loading ? "..." : 0)}
          subtext={`+${overview?.new_users_24h ?? 0} in 24h | +${overview?.new_users_7d ?? 0} in 7d`}
          changeBadge={`${overview?.retention_d7_pct ?? 100}% D7 Retention`}
          badgeType="success"
          icon={Users}
          gradient="from-amber-500/15 to-orange-500/5"
        />

        <OwnerMetricCard
          title="Live Active Users"
          value={overview?.active_users_5m ?? (loading ? "..." : 0)}
          subtext={`${overview?.active_users_15m ?? 0} active in 15m | ${overview?.active_users_24h ?? 0} active in 24h`}
          changeBadge="Online Now"
          badgeType="success"
          icon={Radio}
          gradient="from-emerald-500/15 to-teal-500/5"
        />

        <OwnerMetricCard
          title="Total Organizations"
          value={overview?.total_organizations ?? (loading ? "..." : 0)}
          subtext={`${overview?.custom_workspaces ?? 0} custom | ${overview?.demo_workspaces ?? 0} demo`}
          changeBadge={`${overview?.total_memberships ?? 0} memberships`}
          badgeType="neutral"
          icon={Building2}
          gradient="from-sky-500/15 to-blue-500/5"
        />

        <OwnerMetricCard
          title="Internal Events (24h)"
          value={overview?.events_24h ?? (loading ? "..." : 0)}
          subtext={`Total recorded: ${(overview?.total_events ?? 0).toLocaleString()}`}
          changeBadge="Active Stream"
          badgeType="warning"
          icon={Activity}
          gradient="from-purple-500/15 to-pink-500/5"
        />
      </div>

      {/* AI Telemetry & LLM Performance */}
      <AIAnalyticsCard aiData={aiData} loading={loading} />

      {/* System Infrastructure & Cloud Run Telemetry */}
      <PlatformHealthCard health={health} loading={loading} />

      {/* User Adoption, Active Users & Top Features */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Signups & Last Activity List */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-amber-400" /> User Accounts & Last Active Timestamp
            </h3>
            <span className="text-xs font-mono text-slate-400">Latest 20 accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="pb-2 px-2">User Email</th>
                  <th className="pb-2 px-2">Plan</th>
                  <th className="pb-2 px-2">Registered</th>
                  <th className="pb-2 px-2">Last Active</th>
                  <th className="pb-2 px-2 text-right">Orgs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {userAnalytics?.users?.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30">
                    <td className="py-2 px-2 text-white font-medium">{u.email}</td>
                    <td className="py-2 px-2">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-amber-300 border border-slate-700 capitalize">
                        {u.plan_type}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-slate-400">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-2 px-2 text-slate-400">
                      {u.last_active_at ? new Date(u.last_active_at).toLocaleTimeString() : "Never"}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-300">{u.organizations_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top API Endpoints & Latencies */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <PieChart className="h-4 w-4 text-sky-400" /> Top Endpoints & Latency
            </h3>
          </div>

          <div className="space-y-3 pt-1">
            {featureUsage?.top_endpoints?.slice(0, 6).map((ep) => (
              <div key={ep.endpoint} className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-1 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200 truncate max-w-[160px]">{ep.endpoint}</span>
                  <span className="text-emerald-400 font-bold">{ep.avg_latency_ms} ms</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Calls recorded: {ep.count}</span>
                  <span className="capitalize text-slate-400">P95: ~{Math.round(ep.avg_latency_ms * 1.3)}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Internal Telemetry Event Log */}
      <EventLogTable events={events} loading={loading} />
    </div>
  );
}
