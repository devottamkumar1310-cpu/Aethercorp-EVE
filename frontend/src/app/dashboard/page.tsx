"use client";

import { useEffect, useState } from "react";
import { fetchDashboardSummary, fetchActivityLogs, fetchClients, fetchProjects } from "@/services/businessService";
import { DashboardSummary, ActivityLog, Client, Project } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL } from "@/lib/api";

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
import { fetchTrends } from "@/services/intelligenceService";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [trends, setTrends] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);
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

  const fetchAllData = async (token: string) => {
    setLoadingSummary(true);
    setLoadingLogs(true);
    setLoadingTrends(true);

    const results = await Promise.allSettled([
      fetchDashboardSummary(token),
      fetchActivityLogs(token),
      fetchTrends(token)
    ]);

    // Handle Dashboard Summary result
    if (results[0].status === "fulfilled") {
      setSummary(results[0].value);
    } else {
      console.error("Error loading summary:", results[0].reason);
    }
    setLoadingSummary(false);

    // Handle Activity Logs result
    if (results[1].status === "fulfilled") {
      setActivityLogs(results[1].value.slice(0, 10));
    } else {
      console.error("Error loading logs:", results[1].reason);
    }
    setLoadingLogs(false);

    // Handle Trends result
    if (results[2].status === "fulfilled") {
      setTrends(results[2].value);
    } else {
      console.error("Error loading trends:", results[2].reason);
    }
    setLoadingTrends(false);
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
      } catch (err: any) {
        setError("Dashboard metrics are currently refreshing. Please try again in a moment.");
        setCheckingAuth(false);
      }
    }
    initializeDashboard();
  }, []);

  useEffect(() => {
    if (!checkingAuth && !loadingSummary && !loadingLogs && !loadingTrends) {
      const duration = performance.now() - startTime;
      console.log(`[EVE LATENCY AUDIT] Dashboard fully interactive in: ${duration.toFixed(2)}ms`);
    }
  }, [checkingAuth, loadingSummary, loadingLogs, loadingTrends]);

  const handleModalSuccess = () => {
    if (sessionToken) {
      reloadAllData(sessionToken);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 max-w-[1600px] mx-auto w-full space-y-6 animate-pulse">
        {/* CTAs Toolbar Skeleton */}
        <div className="h-14 bg-slate-200 rounded-xl border border-slate-300" />
        
        {/* Navigation Toolbar Skeleton */}
        <div className="h-14 bg-slate-200 rounded-xl border border-slate-300" />

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl border border-slate-300 p-5 space-y-3">
              <div className="h-4 bg-slate-300 rounded w-1/2" />
              <div className="h-8 bg-slate-300 rounded w-3/4" />
            </div>
          ))}
        </div>

        {/* Tables Grid Skeleton */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 rounded-xl border border-slate-300" />
          <div className="h-64 bg-slate-200 rounded-xl border border-slate-300" />
        </div>

        {/* Timeline Skeleton */}
        <div className="h-80 bg-slate-200 rounded-xl border border-slate-300" />
      </div>
    );
  }

  const activeWorkspace = typeof window !== "undefined" ? localStorage.getItem("active_workspace_id") : null;

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans transition-colors duration-200">
      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full space-y-6">
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
          <button onClick={() => setIsClientModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100:bg-blue-900/30 rounded-md text-sm font-medium transition-colors border border-blue-200"><Plus size={16}/> New Client</button>
          <button onClick={() => setIsProjectModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100:bg-indigo-900/30 rounded-md text-sm font-medium transition-colors border border-indigo-200"><Plus size={16}/> New Project</button>
          <button onClick={() => setIsTaskModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 hover:bg-cyan-100:bg-cyan-900/30 rounded-md text-sm font-medium transition-colors border border-cyan-200"><Plus size={16}/> New Task</button>
          <button onClick={() => setIsRevenueModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100:bg-green-900/30 rounded-md text-sm font-medium transition-colors border border-green-200"><Plus size={16}/> Add Revenue</button>
          <button onClick={() => setIsExpenseModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100:bg-red-900/30 rounded-md text-sm font-medium transition-colors border border-red-200"><Plus size={16}/> Add Expense</button>
        </div>

        <div className="space-y-6">
          
          {/* Quick Navigation Links */}
          <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm overflow-x-auto scrollbar-thin">
            <span className="font-medium text-foreground px-2 whitespace-nowrap">Manage Modules:</span>
            <Link href="/dashboard/clients" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-slate-200:bg-slate-700 rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><Users size={16}/> Clients</Link>
            <Link href="/dashboard/projects" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-slate-200:bg-slate-700 rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><Briefcase size={16}/> Projects</Link>
            <Link href="/dashboard/tasks" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-slate-200:bg-slate-700 rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><CheckSquare size={16}/> Tasks</Link>
            <Link href="/dashboard/finance" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-slate-200:bg-slate-700 rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><DollarSign size={16}/> Finances</Link>
            <Link href="/dashboard/inventory" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-slate-200:bg-slate-700 rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><Package size={16}/> Inventory</Link>
            <Link href="/dashboard/activity" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-slate-200:bg-slate-700 rounded-md text-sm font-medium transition-colors text-foreground whitespace-nowrap"><Activity size={16}/> Activity Feed</Link>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {loadingSummary ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between h-28 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                  <div className="h-8 bg-muted rounded w-3/4" />
                </div>
              ))
            ) : (
              <>
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Clients</span>
                  <span className="text-3xl font-bold text-foreground">{summary?.kpis?.clients || 0}</span>
                  <span className="text-xs text-green-600 font-medium mt-1">{summary?.kpis?.active_clients || 0} Active</span>
                </div>
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
                  <span className="text-sm font-medium text-muted-foreground flex justify-between">
                    Total Projects 
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
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
                  <span className="text-sm font-medium text-muted-foreground flex justify-between">
                    Tasks Completion
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
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-between">
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
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-semibold text-foreground flex justify-between items-center">
                Recent Clients
                <button onClick={() => setIsClientModalOpen(true)} className="text-xs text-blue-600 hover:underline">Add Client</button>
              </div>
              <div className="p-0 overflow-x-auto flex-1 scrollbar-thin">
                <table className="w-full text-left text-sm">
                  <thead className="bg-card border-b border-border text-muted-foreground">
                    <tr><th className="px-4 py-2 font-medium">Company</th><th className="px-4 py-2 font-medium">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingSummary ? (
                      [...Array(3)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-2/3" /></td>
                          <td className="px-4 py-3"><div className="h-4 bg-muted rounded-full w-12" /></td>
                        </tr>
                      ))
                    ) : (
                      summary?.recent_clients?.map(c => (
                        <tr key={c.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 text-slate-850 font-medium">{c.company_name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-foreground'}`}>{c.status}</span>
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
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-semibold text-foreground flex justify-between items-center">
                Upcoming Deadlines
                <button onClick={() => setIsProjectModalOpen(true)} className="text-xs text-blue-600 hover:underline">Add Project</button>
              </div>
              <div className="p-0 overflow-x-auto flex-1 scrollbar-thin">
                <table className="w-full text-left text-sm">
                  <thead className="bg-card border-b border-border text-muted-foreground">
                    <tr><th className="px-4 py-2 font-medium">Project</th><th className="px-4 py-2 font-medium">Deadline</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingSummary ? (
                      [...Array(3)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-2/3" /></td>
                          <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-1/4" /></td>
                        </tr>
                      ))
                    ) : (
                      summary?.upcoming_deadlines?.map(p => (
                        <tr key={p.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 text-slate-850 font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-red-650 font-medium">{p.deadline ? new Date(p.deadline).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))
                    )}
                    {!loadingSummary && (!summary?.upcoming_deadlines || summary.upcoming_deadlines.length === 0) && (
                      <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No upcoming deadlines</td></tr>
                    )}
                  </tbody>
                </table>
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
