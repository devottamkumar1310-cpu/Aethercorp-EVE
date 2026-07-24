"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { fetchTasks, fetchProjects, deleteTaskAPI, getHeaders } from "@/services/businessService";
import { Task, Project } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import Link from "next/link";
import { CheckSquare, Plus, ArrowLeft, Edit2, Trash2, Calendar, Sparkles, Inbox } from "lucide-react";
import { TaskModal } from "@/components/business/TaskModal";
import { toast } from "sonner";

interface AITraceCard {
  id: string;
  action: string;
  recommendation_type: string;
  confidence_score: number;
  priority?: string | null;
  estimated_financial_impact?: number | null;
  related_skus?: string[] | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [aiTraces, setAiTraces] = useState<AITraceCard[]>([]);
  const [loadingTraces, setLoadingTraces] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const loadData = async (token: string) => {
    try {
      const [taskData, projData] = await Promise.all([
        fetchTasks(token),
        fetchProjects(token)
      ]);
      setTasks(taskData);
      setProjects(projData);
    } catch (err) {
      logger.error(err);
    }
  };

  const loadAiTraces = async (token: string) => {
    setLoadingTraces(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/recommendations?limit=6`, {
        headers: getHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setAiTraces(Array.isArray(data) ? data : []);
      } else {
        setAiTraces([]);
      }
    } catch (err) {
      logger.error("Failed to load recommendation traces", err);
      setAiTraces([]);
    } finally {
      setLoadingTraces(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionToken(session.access_token);
          await loadData(session.access_token);
          loadAiTraces(session.access_token);
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleCreate = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task record?")) return;
    try {
      await deleteTaskAPI(sessionToken, id);
      toast.success("Task record removed.");
      loadData(sessionToken);
    } catch {
      toast.error("Task update in progress. Please try again.");
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-8 transition-colors duration-200">
      
      {/* Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <CheckSquare className="text-primary h-7 w-7" /> Task Command Center
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Manage operational deliverables, milestone priorities, and execution deadlines across active projects.
          </p>
        </div>

        <button 
          onClick={handleCreate} 
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
        >
          <Plus size={16}/> New Operational Task
        </button>
      </div>

      {/* AI-Generated Operational Tasks Banner — pulled directly from this workspace's
          Decision Traceability records, so every card links to a real, sourced recommendation. */}
      <div className="eve-card border border-indigo-500/15 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">AI-Generated Executive Operational Tasks</h2>
              <p className="text-xs text-muted-foreground">Live Decision Traceability records for this workspace, ranked by confidence</p>
            </div>
          </div>
          {!loadingTraces && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-500/30">
              {aiTraces.length} Active Recommendation{aiTraces.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {loadingTraces ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted/40 border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : aiTraces.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Inbox className="w-6 h-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No AI-generated recommendations for this workspace yet.</p>
            <p className="text-xs text-muted-foreground">Upload sales and inventory data to generate decision traces.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {aiTraces.map((trace) => {
              const priority = (trace.priority || "medium").toUpperCase();
              const confidencePct = Math.round(trace.confidence_score * (trace.confidence_score <= 1 ? 100 : 1));
              const sku = (trace.related_skus || [])[0];
              return (
                <div key={trace.id} className="bg-card border border-border rounded-xl p-4 space-y-3 flex flex-col justify-between hover:border-indigo-500/40 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground">{trace.action}</span>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${
                        priority === "CRITICAL"
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                          : priority === "HIGH"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {priority}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug capitalize">{trace.recommendation_type.replace(/_/g, " ")}{sku ? ` · ${sku}` : ""}</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {trace.estimated_financial_impact ? `$${trace.estimated_financial_impact.toLocaleString()} Impact` : "Impact not quantified"}
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-[11px] flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> {confidencePct}% Conf.
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/traceability?type=${trace.recommendation_type}${sku ? `&sku=${sku}` : ""}&traceId=${trace.id}`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline transition-colors pt-1"
                    >
                      Open Decision Traceability →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden p-6 animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-xl w-full" />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="border-b border-border bg-muted/30 text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Task Deliverable</th>
                  <th className="px-6 py-3.5 font-semibold">Priority Level</th>
                  <th className="px-6 py-3.5 font-semibold">Status</th>
                  <th className="px-6 py-3.5 font-semibold">Target Due Date</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/40 transition-colors group">
                    <td className="px-6 py-4 font-semibold text-foreground">{t.title}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        t.priority === 'high' 
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' 
                          : t.priority === 'medium'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                      }`}>
                        {t.priority ? t.priority.toUpperCase() : 'NORMAL'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        t.status === 'completed' 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                          : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                      }`}>
                        {t.status ? t.status.replace('_', ' ').toUpperCase() : 'IN PROGRESS'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">
                      {t.due_date ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-muted-foreground/60" />
                          {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">Unscheduled</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(t)} 
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer" 
                          title="Edit Task"
                          aria-label={`Edit task ${t.title}`}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleDelete(t.id)} 
                          className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer" 
                          title="Delete Task"
                          aria-label={`Delete task ${t.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground text-xs">
                      No active operational tasks recorded. Click <strong className="text-foreground">New Operational Task</strong> to assign deliverables.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        token={sessionToken} 
        task={selectedTask} 
        projects={projects} 
        onSuccess={() => loadData(sessionToken)} 
      />
    </div>
  );
}
