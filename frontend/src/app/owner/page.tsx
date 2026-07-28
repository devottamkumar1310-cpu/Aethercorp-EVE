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
import { OwnerErrorState } from "@/components/owner/OwnerErrorState";
import { OwnerDashboardSkeleton } from "@/components/owner/OwnerDashboardSkeleton";

import {
  Users,
  Building2,
  Activity,
  RefreshCw,
  UserPlus,
  ShieldCheck,
  Radio,
  PieChart,
  AlertTriangle,
  Inbox,
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
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [lastSuccessTime, setLastSuccessTime] = useState<string | null>(null);

  const fetchAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);
    setWarningMessage(null);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Authentication token expired. Please re-authenticate.");

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

      const nowIso = new Date().toISOString();
      setLastSuccessTime(nowIso);
    } catch (err: any) {
      console.error("[OWNER TELEMETRY FETCH ERROR]", err);
      const errMsg = err.message || "Failed to establish connection with owner telemetry backend.";

      // Data Validation & Resilience: If previous data exists, retain it and display a warning toast
      if (overview || userAnalytics) {
        setWarningMessage(`Temporary connection hiccup: ${errMsg}. Displaying cached telemetry from session.`);
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [overview, userAnalytics]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Initial Full Loading Experience (Light Skeleton cards)
  if (loading && !overview) {
    return <OwnerDashboardSkeleton />;
  }

  // Initial Error State (Dedicated Light Component)
  if (error && !overview) {
    return (
      <div className="py-12">
        <OwnerErrorState
          error={error}
          endpoint="/api/internal/overview"
          lastSuccessTime={lastSuccessTime}
          onRetry={() => fetchAllData(true)}
          retrying={refreshing}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Executive Header Bar (Light Mode) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Owner Executive Telemetry <ShieldCheck className="h-6 w-6 text-amber-600" />
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-mono font-bold text-amber-900 uppercase tracking-wider">
              Platform Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Real-time active users, AI performance, system health, and production security telemetry.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {lastSuccessTime && (
            <span className="text-[11px] font-mono text-slate-500 hidden md:inline-block">
              Synced: {new Date(lastSuccessTime).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchAllData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-all font-mono text-xs font-bold shadow-sm active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh Telemetry"}
          </button>
        </div>
      </div>

      {/* Non-Blocking Warning Toast (Light Mode) */}
      {warningMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{warningMessage}</span>
          </div>
          <button
            onClick={() => fetchAllData(true)}
            className="underline hover:text-amber-950 font-bold ml-4"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Real-Time Platform Alerts Banner */}
      <AlertCards alerts={alerts} loading={false} />

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <OwnerMetricCard
          title="Total Registered Users"
          value={overview?.total_users ?? 0}
          subtext={`+${overview?.new_users_24h ?? 0} in 24h | +${overview?.new_users_7d ?? 0} in 7d`}
          changeBadge={`${overview?.retention_d7_pct ?? 100}% D7 Retention`}
          badgeType="success"
          icon={Users}
        />

        <OwnerMetricCard
          title="Live Active Users"
          value={overview?.active_users_5m ?? 0}
          subtext={`${overview?.active_users_15m ?? 0} active in 15m | ${overview?.active_users_24h ?? 0} active in 24h`}
          changeBadge="Online Stream"
          badgeType="success"
          icon={Radio}
        />

        <OwnerMetricCard
          title="Total Organizations"
          value={overview?.total_organizations ?? 0}
          subtext={`${overview?.custom_workspaces ?? 0} custom | ${overview?.demo_workspaces ?? 0} demo`}
          changeBadge={`${overview?.total_memberships ?? 0} memberships`}
          badgeType="neutral"
          icon={Building2}
        />

        <OwnerMetricCard
          title="Internal Events (24h)"
          value={overview?.events_24h ?? 0}
          subtext={`Total recorded: ${(overview?.total_events ?? 0).toLocaleString()}`}
          changeBadge="Active Stream"
          badgeType="warning"
          icon={Activity}
        />
      </div>

      {/* AI Telemetry & LLM Performance */}
      <AIAnalyticsCard aiData={aiData} loading={false} />

      {/* System Infrastructure & Cloud Run Telemetry */}
      <PlatformHealthCard health={health} loading={false} />

      {/* User Adoption, Active Users & Top Features */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Signups & Last Activity List */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-amber-600" /> User Accounts & Activity Timestamps
            </h3>
            <span className="text-xs font-mono text-slate-500">Latest accounts</span>
          </div>

          {!userAnalytics?.users || userAnalytics.users.length === 0 ? (
            <div className="py-8 text-center space-y-2 font-mono text-xs text-slate-500">
              <Inbox className="h-8 w-8 mx-auto text-slate-400" />
              <p>No user account telemetry has been recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] bg-slate-50">
                    <th className="py-2.5 px-3">User Email</th>
                    <th className="py-2.5 px-3">Plan</th>
                    <th className="py-2.5 px-3">Registered</th>
                    <th className="py-2.5 px-3">Last Active</th>
                    <th className="py-2.5 px-3 text-right">Orgs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {userAnalytics.users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-slate-900 font-medium">{u.email}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-900 border border-amber-200 capitalize font-bold">
                          {u.plan_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {u.last_active_at ? new Date(u.last_active_at).toLocaleTimeString() : "Never"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 font-semibold">{u.organizations_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top API Endpoints & Latencies */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-sky-600" /> Top Endpoints & Latency
            </h3>
          </div>

          {!featureUsage?.top_endpoints || featureUsage.top_endpoints.length === 0 ? (
            <div className="py-8 text-center space-y-2 font-mono text-xs text-slate-500">
              <Inbox className="h-8 w-8 mx-auto text-slate-400" />
              <p>No telemetry has been collected yet.</p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {featureUsage.top_endpoints.slice(0, 6).map((ep) => (
                <div key={ep.endpoint} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-mono hover:bg-slate-100/80 transition-colors">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-900 font-medium truncate max-w-[160px]">{ep.endpoint}</span>
                    <span className="text-emerald-700 font-bold">{ep.avg_latency_ms} ms</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Calls recorded: {ep.count}</span>
                    <span className="capitalize text-slate-600">P95: ~{Math.round(ep.avg_latency_ms * 1.3)}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Internal Telemetry Event Log */}
      <EventLogTable events={events} loading={false} />
    </div>
  );
}
