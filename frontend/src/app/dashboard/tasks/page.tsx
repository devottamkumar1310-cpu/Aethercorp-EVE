"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { fetchTasks, fetchProjects, deleteTaskAPI } from "@/services/businessService";
import { Task, Project } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { CheckSquare, Plus, ArrowLeft, Edit2, Trash2, Calendar, AlertCircle } from "lucide-react";
import { TaskModal } from "@/components/business/TaskModal";
import { toast } from "sonner";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
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

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionToken(session.access_token);
          await loadData(session.access_token);
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
    <div className="min-h-screen bg-background p-6 md:p-8 max-w-[1600px] mx-auto w-full space-y-8 transition-colors duration-200">
      
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
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer" 
                          title="Edit Task"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleDelete(t.id)} 
                          className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer" 
                          title="Delete Task"
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
