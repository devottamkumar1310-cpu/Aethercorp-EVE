"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { fetchDashboardSummary, fetchActivityLogs, fetchClients, fetchProjects } from "@/services/businessService";
import { DashboardSummary, ActivityLog, Client, Project } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import { devLog } from "@/lib/logger";

import { ExecutiveTimeline } from "@/components/dashboard/ExecutiveTimeline";

import { AlertCircle, Plus, Users, Briefcase, CheckSquare, DollarSign, Activity, Sparkles, Package } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

// Import Modals
import { ClientModal } from "@/components/business/ClientModal";
import { ProjectModal } from "@/components/business/ProjectModal";
import { TaskModal } from "@/components/business/TaskModal";
import { RevenueModal } from "@/components/business/RevenueModal";
import { ExpenseModal } from "@/components/business/ExpenseModal";
import { fetchTrends, fetchRisks, fetchOpportunities } from "@/services/intelligenceService";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [trends, setTrends] = useState<any>(null);
  const [risks, setRisks] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [loadingRisks, setLoadingRisks] = useState(true);
  const [loadingOpportunities, setLoadingOpportunities] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");

  // Lists for dropdowns in modals
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);

  // Performance audit variables
  const [startTime] = useState(() => performance.now());

  // Modal States
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  const fetchAllData = (token: string) => {
    setLoadingSummary(true);
    setLoadingLogs(true);
    setLoadingTrends(true);
    setLoadingRisks(true);
    setLoadingOpportunities(true);

    // Fetch Dashboard Summary
    fetchDashboardSummary(token)
      .then((data) => {
        setSummary(data);
      })
      .catch((err) => {
        logger.error("Error loading summary:", err);
      })
      .finally(() => {
        setLoadingSummary(false);
      });

    // Fetch Activity Logs
    fetchActivityLogs(token)
      .then((data) => {
        setActivityLogs(Array.isArray(data) ? data.slice(0, 10) : []);
      })
      .catch((err) => {
        logger.error("Error loading logs:", err);
      })
      .finally(() => {
        setLoadingLogs(false);
      });

    // Fetch Trends
    fetchTrends(token)
      .then((data) => {
        setTrends(data);
      })
      .catch((err) => {
        logger.error("Error loading trends:", err);
      })
      .finally(() => {
        setLoadingTrends(false);
      });

    // Fetch Risks
    fetchRisks(token)
      .then((data) => {
        setRisks(data?.risks || []);
      })
      .catch((err) => {
        logger.error("Error loading risks:", err);
      })
      .finally(() => {
        setLoadingRisks(false);
      });

    // Fetch Opportunities
    fetchOpportunities(token)
      .then((data) => {
        setOpportunities(data?.opportunities || []);
      })
      .catch((err) => {
        logger.error("Error loading opportunities:", err);
      })
      .finally(() => {
        setLoadingOpportunities(false);
      });
  };

  const fetchModalDropdowns = async (token: string) => {
    try {
      const [clients, projects] = await Promise.all([
        fetchClients(token),
        fetchProjects(token)
      ]);
      setClientsList(clients);
      setProjectsList(projects);
    } catch (err) {
      logger.error("Error loading dropdown data:", err);
    }
  };

  const reloadAllData = (token: string) => {
    fetchAllData(token);
    fetchModalDropdowns(token);
  };

  useEffect(() => {
    async function initializeDashboard() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          window.location.href = "/login";
          return;
        }

        setSessionToken(session.access_token);
        setCheckingAuth(false);

        const activeWorkspace = localStorage.getItem("active_workspace_id");
        if (activeWorkspace) {
          fetchAllData(session.access_token);
          // Defer non-critical modal lists (load in background)
          setTimeout(() => {
            fetchModalDropdowns(session.access_token);
          }, 50);
        }
        setError(null);
      } catch {
        setError("Dashboard metrics are currently refreshing. Please try again in a moment.");
        setCheckingAuth(false);
      }
    }
    initializeDashboard();
  }, []);

  useEffect(() => {
    if (!checkingAuth && !loadingSummary && !loadingLogs && !loadingTrends) {
      const duration = performance.now() - startTime;
      devLog(`[EVE LATENCY AUDIT] Dashboard fully interactive in: ${duration.toFixed(2)}ms`);
    }
  }, [checkingAuth, loadingSummary, loadingLogs, loadingTrends]);

  const handleModalSuccess = () => {
    if (sessionToken) {
      reloadAllData(sessionToken);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-secondary p-6 max-w-[1600px] mx-auto w-full space-y-6 animate-pulse">
        {/* CTAs Toolbar Skeleton */}
        <div className="h-14 bg-secondary rounded-xl border border-border" />
        
        {/* Navigation Toolbar Skeleton */}
        <div className="h-14 bg-secondary rounded-xl border border-border" />

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-secondary rounded-xl border border-border p-5 space-y-3">
              <div className="h-4 bg-slate-300 rounded w-1/2" />
              <div className="h-8 bg-slate-300 rounded w-3/4" />
            </div>
          ))}
        </div>

        {/* Tables Grid Skeleton */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="h-64 bg-secondary rounded-xl border border-border" />
          <div className="h-64 bg-secondary rounded-xl border border-border" />
        </div>

        {/* Timeline Skeleton */}
        <div className="h-80 bg-secondary rounded-xl border border-border" />
      </div>
    );
  }

  const activeWorkspace = typeof window !== "undefined" ? localStorage.getItem("active_workspace_id") : null;

  if (!activeWorkspace) {
    return null;
  }

  devLog("EVE Dashboard Render State:", {
    loadingSummary,
    summary,
    loadingTrends,
    trends,
    loadingRisks,
    risks,
    loadingOpportunities,
    opportunities,
    loadingLogs,
    activityLogs
  });

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans transition-colors duration-200">
      <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full space-y-8">
        
        {/* Executive Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Executive Workspace</span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-xs font-medium text-muted-foreground">Operational Command Center v2.4</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Executive Operational Command Center</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Real-time visibility into today's operational priorities, active project pipelines, task delivery velocity, and client account health.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Data Freshness: Live (Synced Just Now)</span>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 text-rose-500" />
            <AlertTitle className="font-semibold">Connection Alert</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Global Quick Actions Bar */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Operational Actions:</span>
            <button onClick={() => setIsClientModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs cursor-pointer">
              <Plus size={14} /> New Client
            </button>
            <button onClick={() => setIsProjectModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-all shadow-xs cursor-pointer">
              <Plus size={14} /> New Project
            </button>
            <button onClick={() => setIsTaskModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-all shadow-xs cursor-pointer">
              <Plus size={14} /> New Task
            </button>
            <button onClick={() => setIsRevenueModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all shadow-xs cursor-pointer">
              <Plus size={14} /> Add Revenue
            </button>
            <button onClick={() => setIsExpenseModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all shadow-xs cursor-pointer">
              <Plus size={14} /> Add Expense
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Modules:</span>
            <Link href="/dashboard/clients" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap">
              <Users size={14} /> Clients
            </Link>
            <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap">
              <Briefcase size={14} /> Projects
            </Link>
            <Link href="/dashboard/tasks" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap">
              <CheckSquare size={14} /> Tasks
            </Link>
            <Link href="/dashboard/finance" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap">
              <DollarSign size={14} /> Finances
            </Link>
            <Link href="/dashboard/inventory" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap">
              <Package size={14} /> Inventory
            </Link>
            <Link href="/dashboard/activity" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap">
              <Activity size={14} /> Activity Feed
            </Link>
          </div>
        </div>

        {/* Hero Executive Operational KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
          {loadingSummary ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-card p-5 rounded-xl border border-border flex flex-col justify-between h-32 animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-8 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            ))
          ) : (
            <>
              {/* Total Clients Portfolio */}
              <div className="bg-card p-5 rounded-xl border border-border shadow-xs hover:border-primary/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Clients</span>
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Users size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-bold tracking-tight text-foreground">{summary?.kpis?.clients || 0}</span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {summary?.kpis?.active_clients || 0} Active
                    </span>
                    <span className="text-[11px] text-muted-foreground">Account Base</span>
                  </div>
                </div>
              </div>

              {/* Active Projects Pipeline */}
              <div className="bg-card p-5 rounded-xl border border-border shadow-xs hover:border-primary/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Projects Pipeline</span>
                  <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Briefcase size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-bold tracking-tight text-foreground">{summary?.kpis?.projects || 0}</span>
                    {!loadingTrends && (
                      <span className="text-xs font-semibold text-emerald-500 flex items-center gap-0.5">
                        {trends?.task_trend === 'up' ? '↑ High Pace' : '→ Steady'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                      {summary?.kpis?.active_projects || 0} In Flight
                    </span>
                    <span className="text-[11px] text-muted-foreground">Milestones On Schedule</span>
                  </div>
                </div>
              </div>

              {/* Task Delivery Velocity */}
              <div className="bg-card p-5 rounded-xl border border-border shadow-xs hover:border-primary/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery Velocity</span>
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <CheckSquare size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {summary?.kpis?.completed_tasks || 0} <span className="text-lg text-muted-foreground font-normal">/ {summary?.kpis?.tasks || 0}</span>
                  </span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      {summary?.kpis?.tasks ? Math.round(((summary.kpis.completed_tasks || 0) / summary.kpis.tasks) * 100) : 0}% Delivered
                    </span>
                    <span className="text-[11px] text-muted-foreground">Sprint Completion Rate</span>
                  </div>
                </div>
              </div>

              {/* Net Profit & Margin */}
              <div className="bg-card p-5 rounded-xl border border-border shadow-xs hover:border-primary/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Operating Profit</span>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <DollarSign size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    ${(summary?.kpis?.profit || 0).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      Gross Revenue: <strong className="text-foreground">${(summary?.kpis?.revenue || 0).toLocaleString()}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Founder Attention Grid: Today's Operational Priorities */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Sparkles size={16} className="text-primary" /> Today's Founder Operational Priorities
            </h3>
            <span className="text-xs text-muted-foreground">Requiring Founder Decision & Execution</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Project Deliverables</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  {summary?.kpis?.active_projects || 0} Active Initiatives
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Review milestone completion velocity and assign deliverable leads for active projects nearing release.
              </p>
              <Link href="/dashboard/tasks" className="text-xs font-semibold text-primary hover:underline inline-block pt-1">
                Open Task Command →
              </Link>
            </div>

            <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Milestone Target Deadlines</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {summary?.upcoming_deadlines?.length || 0} Scheduled
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Check upcoming project milestone deadlines to prevent delays and maintain client SLA commitments.
              </p>
              <Link href="/dashboard/projects" className="text-xs font-semibold text-primary hover:underline inline-block pt-1">
                View Project Pipeline →
              </Link>
            </div>

            <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Client Account Health</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {summary?.kpis?.active_clients || 0} Healthy
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ensure newly onboarded accounts are active and contract deliverables are fully on track.
              </p>
              <Link href="/dashboard/clients" className="text-xs font-semibold text-primary hover:underline inline-block pt-1">
                Manage Accounts →
              </Link>
            </div>
          </div>
        </div>

        {/* Operational Overview: Recent Clients & Deadlines */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Clients */}
          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-sm text-foreground">Recent Client Accounts</h3>
                <p className="text-xs text-muted-foreground">Account onboarding status and portfolio health</p>
              </div>
              <button onClick={() => setIsClientModalOpen(true)} className="text-xs font-medium text-primary hover:underline cursor-pointer">
                + Add Client
              </button>
            </div>
            <div className="p-0 overflow-x-auto flex-1 scrollbar-thin">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="border-b border-border bg-muted/20 text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Client Name</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Account Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingSummary ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-3.5"><div className="h-4 bg-muted rounded w-2/3" /></td>
                        <td className="px-5 py-3.5"><div className="h-4 bg-muted rounded-full w-14" /></td>
                        <td className="px-5 py-3.5"><div className="h-4 bg-muted rounded w-12 ml-auto" /></td>
                      </tr>
                    ))
                  ) : summary?.recent_clients?.length ? (
                    summary.recent_clients.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-foreground">{c.company_name}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            c.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                              : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Optimal
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-muted-foreground text-xs">
                        No clients registered yet. Click <strong className="text-foreground">Add Client</strong> to begin onboarding.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming Project Deadlines */}
          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-sm text-foreground">Upcoming Project Deadlines</h3>
                <p className="text-xs text-muted-foreground">Milestones scheduled across active initiatives</p>
              </div>
              <button onClick={() => setIsProjectModalOpen(true)} className="text-xs font-medium text-primary hover:underline cursor-pointer">
                + New Project
              </button>
            </div>
            <div className="p-0 overflow-x-auto flex-1 scrollbar-thin">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="border-b border-border bg-muted/20 text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Project Name</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Target Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingSummary ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-3.5"><div className="h-4 bg-muted rounded w-2/3" /></td>
                        <td className="px-5 py-3.5"><div className="h-4 bg-muted rounded w-1/3 ml-auto" /></td>
                      </tr>
                    ))
                  ) : summary?.upcoming_deadlines?.length ? (
                    summary.upcoming_deadlines.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-foreground">{p.name}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-amber-600 dark:text-amber-400">
                          {(() => {
                            try {
                              if (!p.deadline) return "N/A";
                              const d = new Date(p.deadline);
                              if (isNaN(d.getTime())) return "N/A";
                              return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                            } catch {
                              return "N/A";
                            }
                          })()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-5 py-8 text-center text-muted-foreground text-xs">
                        No upcoming deadlines scheduled.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* EVE Executive Alert Stream */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* EVE Active Operational Risks */}
          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden flex flex-col">
            <div className="bg-rose-500/10 px-5 py-4 border-b border-rose-500/20 font-semibold text-sm text-rose-600 dark:text-rose-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-500" />
                <span>Operational Risk Stream</span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300">
                {risks.length} Detected
              </span>
            </div>
            <div className="p-5 flex-grow">
              {loadingRisks ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-12 bg-muted rounded-xl" />
                  <div className="h-12 bg-muted rounded-xl" />
                </div>
              ) : risks.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Zero Critical Operational Risks</p>
                  <p className="text-xs text-muted-foreground">All operational pipelines and team delivery SLAs are nominal.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {risks.map((risk, idx) => (
                    <Link 
                      key={idx}
                      href={`/dashboard/eve?question=${encodeURIComponent(`Address and mitigate this operational risk: ${risk.description}`)}`}
                      className="block p-4 rounded-xl border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/[0.04] dark:bg-rose-500/10 transition-all group cursor-pointer"
                    >
                      <div className="flex justify-between items-center gap-2 mb-1.5">
                        <span className="font-semibold text-rose-600 dark:text-rose-300 text-xs md:text-sm group-hover:underline">
                          {risk.title || "Operational Risk"}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-300 font-bold border border-rose-500/30 uppercase tracking-wide">
                          Mitigate →
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed font-normal">{risk.description}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* EVE Active Growth Opportunities */}
          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden flex flex-col">
            <div className="bg-emerald-500/10 px-5 py-4 border-b border-emerald-500/20 font-semibold text-sm text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-500" />
                <span>Executive Growth Opportunities</span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                {opportunities.length} Identified
              </span>
            </div>
            <div className="p-5 flex-grow">
              {loadingOpportunities ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-12 bg-muted rounded-xl" />
                  <div className="h-12 bg-muted rounded-xl" />
                </div>
              ) : opportunities.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">Analyzing growth channels...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {opportunities.map((opp, idx) => (
                    <Link 
                      key={idx}
                      href={`/dashboard/eve?question=${encodeURIComponent(`Analyze and execute opportunity: ${opp.description}`)}`}
                      className="block p-4 rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/[0.04] dark:bg-emerald-500/10 transition-all group cursor-pointer"
                    >
                      <div className="flex justify-between items-center gap-2 mb-1.5">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-300 text-xs md:text-sm group-hover:underline">
                          {opp.title || "Growth Opportunity"}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold border border-emerald-500/30 uppercase tracking-wide">
                          Execute →
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed font-normal">{opp.description}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Executive Audit Timeline */}
        <ExecutiveTimeline logs={activityLogs} loading={loadingLogs} />
      </main>

      {/* Render Modals */}
      <ClientModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} token={sessionToken} onSuccess={handleModalSuccess} />
      <ProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} token={sessionToken} clients={clientsList} onSuccess={handleModalSuccess} />
      <TaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} token={sessionToken} projects={projectsList} onSuccess={handleModalSuccess} />
      <RevenueModal isOpen={isRevenueModalOpen} onClose={() => setIsRevenueModalOpen(false)} token={sessionToken} projects={projectsList} onSuccess={handleModalSuccess} />
      <ExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} token={sessionToken} onSuccess={handleModalSuccess} />
    </div>
  );
}
