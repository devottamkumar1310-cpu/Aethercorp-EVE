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
} from "@/services/ownerAnalyticsService";

import { OwnerMetricCard } from "@/components/owner/OwnerMetricCard";
import { PlatformHealthCard } from "@/components/owner/PlatformHealthCard";
import { EventLogTable } from "@/components/owner/EventLogTable";

import {
  Users,
  Building2,
  Activity,
  Layers,
  RefreshCw,
  TrendingUp,
  Zap,
  Server,
  UserPlus,
  ShieldCheck,
} from "lucide-react";

export default function OwnerAnalyticsPage() {
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
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

      const [ovData, usrData, featData, hlthData, evtData] = await Promise.all([
        ownerAnalyticsService.getOverview(token),
        ownerAnalyticsService.getUsers(token, 20),
        ownerAnalyticsService.getFeatureUsage(token),
        ownerAnalyticsService.getHealth(token),
        ownerAnalyticsService.getEvents(token, 30),
      ]);

      setOverview(ovData);
      setUserAnalytics(usrData);
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
            Owner Executive Analytics <ShieldCheck className="h-6 w-6 text-amber-400" />
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time platform metrics, user adoption, feature telemetry, and infrastructure status.
          </p>
        </div>

        <button
          onClick={() => fetchAllData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all font-mono text-xs font-semibold self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing Telemetry..." : "Refresh Telemetry"}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
          {error}
        </div>
      )}

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <OwnerMetricCard
          title="Total Registered Users"
          value={overview?.total_users ?? (loading ? "..." : 0)}
          subtext={`+${overview?.new_users_24h ?? 0} in last 24h | +${overview?.new_users_7d ?? 0} in 7d`}
          changeBadge={`+${overview?.new_users_30d ?? 0} (30d)`}
          badgeType="success"
          icon={Users}
          gradient="from-amber-500/15 to-orange-500/5"
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
          changeBadge="Active Feed"
          badgeType="warning"
          icon={Activity}
          gradient="from-purple-500/15 to-pink-500/5"
        />

        <OwnerMetricCard
          title="Platform Status"
          value={health?.status?.toUpperCase() ?? (loading ? "..." : "OPERATIONAL")}
          subtext={`DB Latency: ${health?.database?.latency_ms ?? 0}ms`}
          changeBadge={health?.error_count_24h ? `${health.error_count_24h} errors` : "0 Errors"}
          badgeType={health?.error_count_24h ? "danger" : "success"}
          icon={Server}
          gradient="from-emerald-500/15 to-teal-500/5"
        />
      </div>

      {/* System Infrastructure Telemetry */}
      <PlatformHealthCard health={health} loading={loading} />

      {/* User Adoption & Signup Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Signups List */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-amber-400" /> Recent User Registrations
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
                    <td className="py-2 px-2 text-right text-slate-300">{u.organizations_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subscription Plan Distribution */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-400" /> Plan Distribution
            </h3>
          </div>

          <div className="space-y-3 pt-2">
            {Object.entries(overview?.plan_distribution || { starter: 1 }).map(([plan, count]) => {
              const total = overview?.total_users || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={plan} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="capitalize text-slate-300">{plan}</span>
                    <span className="text-slate-400">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Internal Telemetry Event Log */}
      <EventLogTable events={events} loading={loading} />
    </div>
  );
}
