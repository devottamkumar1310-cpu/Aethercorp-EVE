"use client";

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
        console.error("Error loading summary:", err);
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
        console.error("Error loading logs:", err);
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
        console.error("Error loading trends:", err);
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
        console.error("Error loading risks:", err);
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
        console.error("Error loading opportunities:", err);
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
      console.error("Error loading dropdown data:", err);
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
      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Operational Dashboard</h1>
            <p className="text-xs text-muted-foreground">Automated brand metrics, project tracking, and executive intelligence feed.</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Data Freshness: Live (Synced Just Now)</span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Global Quick CTAs */}
        <div className="flex flex-wrap gap-3 items-center bg-card p-4 rounded-xl border border-border shadow-sm">
          <span className="font-medium text-foreground mr-2">Create Actions:</span>
          <button onClick={() => setIsClientModalOpen(true)} className="eve-action-btn eve-action-btn-blue"><Plus size={16}/> New Client</button>
          <button onClick={() => setIsProjectModalOpen(true)} className="eve-action-btn eve-action-btn-violet"><Plus size={16}/> New Project</button>
          <button onClick={() => setIsTaskModalOpen(true)} className="eve-action-btn eve-action-btn-cyan"><Plus size={16}/> New Task</button>
          <button onClick={() => setIsRevenueModalOpen(true)} className="eve-action-btn eve-action-btn-emerald"><Plus size={16}/> Add Revenue</button>
          <button onClick={() => setIsExpenseModalOpen(true)} className="eve-action-btn eve-action-btn-rose"><Plus size={16}/> Add Expense</button>
        </div>

        <div className="space-y-6">
          
          {/* Quick Navigation Links */}
          <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm overflow-x-auto scrollbar-thin">
            <span className="font-medium text-foreground px-2 whitespace-nowrap">Manage Modules:</span>
            <Link href="/dashboard/clients" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-secondary:bg-secondary rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><Users size={16}/> Clients</Link>
            <Link href="/dashboard/projects" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-secondary:bg-secondary rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><Briefcase size={16}/> Projects</Link>
            <Link href="/dashboard/tasks" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-secondary:bg-secondary rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><CheckSquare size={16}/> Tasks</Link>
            <Link href="/dashboard/finance" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-secondary:bg-secondary rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><DollarSign size={16}/> Finances</Link>
            <Link href="/dashboard/inventory" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-secondary:bg-secondary rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><Package size={16}/> Inventory</Link>
            <Link href="/dashboard/activity" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-secondary:bg-secondary rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><Activity size={16}/> Activity Feed</Link>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {loadingSummary ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="eve-kpi-card p-5 rounded-xl flex flex-col justify-between h-28 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                  <div className="h-8 bg-muted rounded w-3/4" />
                </div>
              ))
            ) : (
              <>
                <div className="eve-kpi-card p-5 rounded-xl flex flex-col justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Clients</span>
                  <span className="text-3xl font-bold text-foreground">{summary?.kpis?.clients || 0}</span>
                  <span className="text-xs text-emerald-400 font-medium mt-1">{summary?.kpis?.active_clients || 0} Active</span>
                </div>
                <div className="eve-kpi-card p-5 rounded-xl flex flex-col justify-between">
                  <span className="text-sm font-medium text-muted-foreground flex justify-between">
                    Active Projects
                    {loadingTrends ? (
                      <span className="h-4 w-4 bg-muted rounded animate-pulse" />
                    ) : (
                      <>
                        {trends?.task_trend === 'up' && <span className="text-green-500">↑</span>}
                        {trends?.task_trend === 'down' && <span className="text-red-500">↓</span>}
                      </>
                    )}
                  </span>
                  <span className="text-3xl font-bold text-foreground">{summary?.kpis?.projects || 0}</span>
                  <span className="text-xs text-blue-600 font-medium mt-1">{summary?.kpis?.active_projects || 0} Active</span>
                </div>
                <div className="eve-kpi-card p-5 rounded-xl flex flex-col justify-between">
                  <span className="text-sm font-medium text-muted-foreground flex justify-between">
                    Task Progress
                    {loadingTrends ? (
                      <span className="h-4 w-4 bg-muted rounded animate-pulse" />
                    ) : (
                      <>
                        {trends?.task_trend === 'up' && <span className="text-green-500">↑</span>}
                        {trends?.task_trend === 'down' && <span className="text-red-500">↓</span>}
                      </>
                    )}
                  </span>
                  <span className="text-3xl font-bold text-foreground">{summary?.kpis?.completed_tasks || 0} / {summary?.kpis?.tasks || 0}</span>
                  <span className="text-xs text-muted-foreground font-medium mt-1">Pending vs Total</span>
                </div>
                <div className="eve-kpi-card p-5 rounded-xl flex flex-col justify-between">
                  <span className="text-sm font-medium text-muted-foreground flex justify-between">
                    Net Profit
                    {loadingTrends ? (
                      <span className="h-4 w-4 bg-muted rounded animate-pulse" />
                    ) : (
                      <>
                        {trends?.profit_trend === 'up' && <span className="text-green-500">↑</span>}
                        {trends?.profit_trend === 'down' && <span className="text-red-500">↓</span>}
                      </>
                    )}
                  </span>
                  <span className="text-3xl font-bold text-foreground">${(summary?.kpis?.profit || 0).toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground font-medium mt-1">Rev: ${(summary?.kpis?.revenue || 0).toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Clients */}
            <div className="eve-card rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border bg-secondary/40 font-semibold text-foreground flex justify-between items-center">
                Recent Clients
                <button onClick={() => setIsClientModalOpen(true)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors cursor-pointer">Add Client</button>
              </div>
              <div className="p-0 overflow-x-auto flex-1 eve-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-secondary/40 text-muted-foreground">
                    <tr><th className="px-4 py-2 font-medium">Client</th><th className="px-4 py-2 font-medium">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loadingSummary ? (
                      [...Array(3)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-2/3" /></td>
                          <td className="px-4 py-3"><div className="h-4 bg-muted rounded-full w-12" /></td>
                        </tr>
                      ))
                    ) : (
                      summary?.recent_clients?.map(c => (
                        <tr key={c.id} className="eve-table-row hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{c.company_name}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase ${c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>{c.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                    {!loadingSummary && (!summary?.recent_clients || summary.recent_clients.length === 0) && (
                      <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No clients found. Click Add Client.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="eve-card rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border bg-secondary/40 font-semibold text-foreground flex justify-between items-center">
                Upcoming Project Deadlines
                <button onClick={() => setIsProjectModalOpen(true)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors cursor-pointer">New Project</button>
              </div>
              <div className="p-0 overflow-x-auto flex-1 eve-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-secondary/40 text-muted-foreground">
                    <tr><th className="px-4 py-2 font-medium">Project</th><th className="px-4 py-2 font-medium">Deadline</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loadingSummary ? (
                      [...Array(3)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-2/3" /></td>
                          <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-1/4" /></td>
                        </tr>
                      ))
                    ) : (
                      summary?.upcoming_deadlines?.map(p => (
                        <tr key={p.id} className="eve-table-row hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                          <td className="px-4 py-3 text-rose-400 font-medium">
                            {(() => {
                              try {
                                if (!p.deadline) return "N/A";
                                const d = new Date(p.deadline);
                                if (isNaN(d.getTime())) return "N/A";
                                return d.toLocaleDateString();
                              } catch {
                                return "N/A";
                              }
                            })()}
                          </td>
                        </tr>
                      ))
                    )}
                    {!loadingSummary && (!summary?.upcoming_deadlines || summary.upcoming_deadlines.length === 0) && (
                      <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground font-medium">No upcoming deadlines</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* EVE Active Alerts Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* EVE Active Risks */}
            <div className="eve-card rounded-xl overflow-hidden flex flex-col">
              <div className="bg-rose-500/10 px-4 py-3 border-b border-rose-500/15 font-bold text-rose-400 flex items-center gap-2">
                <AlertCircle size={15} className="text-rose-500 animate-pulse" />
                <span>EVE Active Operational Risks</span>
              </div>
              <div className="p-4 flex-grow">
                {loadingRisks ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-10 bg-muted rounded-lg" />
                    <div className="h-10 bg-muted rounded-lg" />
                  </div>
                ) : risks.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">No active operational risks. Systems nominal.</p>
                ) : (
                  <div className="space-y-2.5">
                    {risks.map((risk, idx) => (
                      <Link 
                        key={idx}
                        href={`/dashboard/eve?question=${encodeURIComponent(`Address and mitigate this risk: ${risk.description}`)}`}
                        className="block p-3 rounded-xl border border-rose-500/10 hover:border-rose-500/35 bg-rose-500/5 hover:bg-rose-500/10 transition-all cursor-pointer"
                      >
                        <div className="flex justify-between items-center gap-2 mb-1">
                          <span className="font-semibold text-rose-400 text-xs">{risk.title || "Operational Risk"}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 uppercase tracking-wide">Mitigate</span>
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-relaxed font-normal">{risk.description}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* EVE Active Opportunities */}
            <div className="eve-card rounded-xl overflow-hidden flex flex-col">
              <div className="bg-emerald-500/10 px-4 py-3 border-b border-emerald-500/15 font-bold text-emerald-400 flex items-center gap-2">
                <Sparkles size={15} className="text-emerald-500" />
                <span>EVE Active Growth Opportunities</span>
              </div>
              <div className="p-4 flex-grow">
                {loadingOpportunities ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-10 bg-muted rounded-lg" />
                    <div className="h-10 bg-muted rounded-lg" />
                  </div>
                ) : opportunities.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">No active growth opportunities detected.</p>
                ) : (
                  <div className="space-y-2.5">
                    {opportunities.map((opp, idx) => (
                      <Link 
                        key={idx}
                        href={`/dashboard/eve?question=${encodeURIComponent(`Analyze and execute opportunity: ${opp.description}`)}`}
                        className="block p-3 rounded-xl border border-emerald-500/10 hover:border-emerald-500/35 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all cursor-pointer"
                      >
                        <div className="flex justify-between items-center gap-2 mb-1">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-300 text-xs">{opp.title || "Growth Opportunity"}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 uppercase tracking-wide">Execute</span>
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-relaxed font-normal">{opp.description}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Executive Audit Timeline */}
          <ExecutiveTimeline logs={activityLogs} loading={loadingLogs} />
        </div>
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
