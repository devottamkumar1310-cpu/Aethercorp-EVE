"use client";

import { useEffect, useState } from "react";
import { fetchTasks, fetchProjects, deleteTaskAPI } from "@/services/businessService";
import { Task, Project } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { CheckSquare, Plus, ArrowLeft, Edit2, Trash2 } from "lucide-react";
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
      console.error(err);
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
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteTaskAPI(sessionToken, id);
      toast.success("Task deleted successfully");
      loadData(sessionToken);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete task");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 transition-colors duration-200">
      <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 mb-4">
        <Link href="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"><ArrowLeft size={16}/> Back to Dashboard</Link>
      </div>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2"><CheckSquare className="text-blue-600 dark:text-blue-400"/> Tasks</h1>
        <button onClick={handleCreate} className="flex items-center gap-2 bg-blue-600 dark:bg-indigo-650 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-indigo-750 transition-colors">
          <Plus size={18}/> New Task
        </button>
      </div>
      
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-pulse">
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-400 dark:text-slate-500">Task Title</th>
                  <th className="px-6 py-3 font-medium text-slate-400 dark:text-slate-500">Priority</th>
                  <th className="px-6 py-3 font-medium text-slate-400 dark:text-slate-500">Status</th>
                  <th className="px-6 py-3 font-medium text-slate-400 dark:text-slate-500">Due Date</th>
                  <th className="px-6 py-3 font-medium text-slate-400 dark:text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" /></td>
                    <td className="px-6 py-4"><div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-full w-12" /></td>
                    <td className="px-6 py-4"><div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-full w-16" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-8 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-600 dark:text-slate-400">Task Title</th>
                  <th className="px-6 py-3 font-medium text-slate-600 dark:text-slate-400">Priority</th>
                  <th className="px-6 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                  <th className="px-6 py-3 font-medium text-slate-600 dark:text-slate-400">Due Date</th>
                  <th className="px-6 py-3 font-medium text-slate-600 dark:text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 group">
                    <td className="px-6 py-4 font-medium text-slate-850 dark:text-slate-200">{t.title}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.priority === 'high' ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>{t.priority}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.status === 'completed' ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-750 dark:text-yellow-400'}`}>{t.status.replace('_', ' ')}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{t.due_date ? new Date(t.due_date).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(t)} className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-slate-400 hover:text-red-650 dark:hover:text-red-400 transition-colors ml-2 cursor-pointer" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-500 dark:text-slate-400">No tasks found. Click "New Task" to get started.</td></tr>
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
