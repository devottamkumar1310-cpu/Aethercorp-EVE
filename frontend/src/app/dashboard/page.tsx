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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");

  // Lists for dropdowns in modals
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);

  // Modal States
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  const loadDashboardData = async (token: string) => {
    try {
      const [sumData, logs, clients, projects, trendData] = await Promise.all([
        fetchDashboardSummary(token),
        fetchActivityLogs(token),
        fetchClients(token),
        fetchProjects(token),
        fetchTrends(token)
      ]);
      setSummary(sumData);
      setActivityLogs(logs.slice(0, 10));
      setClientsList(clients);
      setProjectsList(projects);
      setTrends(trendData);
    } catch (err: any) {
      console.error(err);
    }
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

        const activeWorkspace = localStorage.getItem("active_workspace_id");
        if (activeWorkspace) {
          await loadDashboardData(session.access_token);
        }
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to connect to backend");
      } finally {
        setLoading(false);
      }
    }
    initializeDashboard();
  }, []);

  const handleModalSuccess = () => {
    if (sessionToken) {
      loadDashboardData(sessionToken);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">Loading Operations Engine...</div>;
  }

  const activeWorkspace = typeof window !== "undefined" ? localStorage.getItem("active_workspace_id") : null;

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Global Quick CTAs */}
        <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="font-medium text-slate-700 mr-2">Create Actions:</span>
          <button onClick={() => setIsClientModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-sm font-medium transition-colors border border-blue-200"><Plus size={16}/> New Client</button>
          <button onClick={() => setIsProjectModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-sm font-medium transition-colors border border-indigo-200"><Plus size={16}/> New Project</button>
          <button onClick={() => setIsTaskModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 rounded-md text-sm font-medium transition-colors border border-cyan-200"><Plus size={16}/> New Task</button>
          <button onClick={() => setIsRevenueModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md text-sm font-medium transition-colors border border-green-200"><Plus size={16}/> Add Revenue</button>
          <button onClick={() => setIsExpenseModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md text-sm font-medium transition-colors border border-red-200"><Plus size={16}/> Add Expense</button>
        </div>

        <div className="space-y-6">
          
          {/* Quick Navigation Links */}
          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <span className="font-medium text-slate-700 px-2 whitespace-nowrap">Manage Modules:</span>
            <Link href="/dashboard/clients" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors text-slate-700 whitespace-nowrap"><Users size={16}/> Clients</Link>
            <Link href="/dashboard/projects" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors text-slate-700 whitespace-nowrap"><Briefcase size={16}/> Projects</Link>
            <Link href="/dashboard/tasks" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors text-slate-700 whitespace-nowrap"><CheckSquare size={16}/> Tasks</Link>
            <Link href="/dashboard/finance" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors text-slate-700 whitespace-nowrap"><DollarSign size={16}/> Finances</Link>
            <Link href="/dashboard/inventory" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors text-slate-700 whitespace-nowrap"><Package size={16}/> Inventory</Link>
            <Link href="/dashboard/activity" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors text-slate-700 whitespace-nowrap"><Activity size={16}/> Activity Feed</Link>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-sm font-medium text-slate-500">Total Clients</span>
              <span className="text-3xl font-bold text-slate-800">{summary?.kpis?.clients || 0}</span>
              <span className="text-xs text-green-600 font-medium mt-1">{summary?.kpis?.active_clients || 0} Active</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-sm font-medium text-slate-500 flex justify-between">Total Projects {trends?.task_trend === 'up' && <span className="text-green-500">↑</span>}{trends?.task_trend === 'down' && <span className="text-red-500">↓</span>}</span>
              <span className="text-3xl font-bold text-slate-800">{summary?.kpis?.projects || 0}</span>
              <span className="text-xs text-blue-600 font-medium mt-1">{summary?.kpis?.active_projects || 0} Active</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-sm font-medium text-slate-500 flex justify-between">Tasks Completion {trends?.task_trend === 'up' && <span className="text-green-500">↑</span>}{trends?.task_trend === 'down' && <span className="text-red-500">↓</span>}</span>
              <span className="text-3xl font-bold text-slate-800">{summary?.kpis?.completed_tasks || 0} / {summary?.kpis?.tasks || 0}</span>
              <span className="text-xs text-slate-500 font-medium mt-1">Pending vs Total</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-sm font-medium text-slate-500 flex justify-between">Net Profit {trends?.profit_trend === 'up' && <span className="text-green-500">↑</span>}{trends?.profit_trend === 'down' && <span className="text-red-500">↓</span>}</span>
              <span className="text-3xl font-bold text-slate-800">${(summary?.kpis?.profit || 0).toLocaleString()}</span>
              <span className="text-xs text-slate-500 font-medium mt-1">Rev: ${(summary?.kpis?.revenue || 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Clients */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-semibold text-slate-700 flex justify-between items-center">
                Recent Clients
                <button onClick={() => setIsClientModalOpen(true)} className="text-xs text-blue-600 hover:underline">Add Client</button>
              </div>
              <div className="p-0 overflow-x-auto flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b border-slate-100 text-slate-500">
                    <tr><th className="px-4 py-2 font-medium">Company</th><th className="px-4 py-2 font-medium">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary?.recent_clients?.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-800 font-medium">{c.company_name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>{c.status}</span>
                        </td>
                      </tr>
                    ))}
                    {(!summary?.recent_clients || summary.recent_clients.length === 0) && (
                      <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-500">No clients found. Click Add Client.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-semibold text-slate-700 flex justify-between items-center">
                Upcoming Deadlines
                <button onClick={() => setIsProjectModalOpen(true)} className="text-xs text-blue-600 hover:underline">Add Project</button>
              </div>
              <div className="p-0 overflow-x-auto flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b border-slate-100 text-slate-500">
                    <tr><th className="px-4 py-2 font-medium">Project</th><th className="px-4 py-2 font-medium">Deadline</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary?.upcoming_deadlines?.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-800 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-red-600 font-medium">{p.deadline ? new Date(p.deadline).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))}
                    {(!summary?.upcoming_deadlines || summary.upcoming_deadlines.length === 0) && (
                      <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-500">No upcoming deadlines</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Executive Audit Timeline */}
          <ExecutiveTimeline logs={activityLogs} />
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
