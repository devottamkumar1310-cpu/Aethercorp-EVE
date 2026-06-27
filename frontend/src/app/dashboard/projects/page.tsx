"use client";

import { useEffect, useState } from "react";
import { fetchProjects, fetchClients, deleteProjectAPI } from "@/services/businessService";
import { Project, Client } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Briefcase, Plus, ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { ProjectModal } from "@/components/business/ProjectModal";
import { toast } from "sonner";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const loadData = async (token: string) => {
    try {
      const [projData, clientData] = await Promise.all([
        fetchProjects(token),
        fetchClients(token)
      ]);
      setProjects(projData);
      setClients(clientData);
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
    setSelectedProject(null);
    setIsModalOpen(true);
  };

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project? Tasks and finances linked to it will also be deleted.")) return;
    try {
      await deleteProjectAPI(sessionToken, id);
      toast.success("Project deleted successfully");
      loadData(sessionToken);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete project");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 transition-colors duration-200">
      <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 mb-4">
        <Link href="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"><ArrowLeft size={16}/> Back to Dashboard</Link>
      </div>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2"><Briefcase className="text-blue-600 dark:text-blue-400"/> Projects Portfolio</h1>
        <button onClick={handleCreate} className="flex items-center gap-2 bg-blue-600 dark:bg-indigo-650 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-indigo-750 transition-colors">
          <Plus size={18}/> New Project
        </button>
      </div>
      
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-pulse">
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-400 dark:text-slate-500">Project Name</th>
                  <th className="px-6 py-3 font-medium text-slate-400 dark:text-slate-500">Budget</th>
                  <th className="px-6 py-3 font-medium text-slate-400 dark:text-slate-500">Progress</th>
                  <th className="px-6 py-3 font-medium text-slate-400 dark:text-slate-500">Status</th>
                  <th className="px-6 py-3 font-medium text-slate-400 dark:text-slate-500">Deadline</th>
                  <th className="px-6 py-3 font-medium text-slate-400 dark:text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4" /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-200 dark:bg-slate-800 rounded-full h-2" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-6" />
                      </div>
                    </td>
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
                  <th className="px-6 py-3 font-medium text-slate-600 dark:text-slate-400">Project Name</th>
                  <th className="px-6 py-3 font-medium text-slate-600 dark:text-slate-400">Budget</th>
                  <th className="px-6 py-3 font-medium text-slate-600 dark:text-slate-400">Progress</th>
                  <th className="px-6 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                  <th className="px-6 py-3 font-medium text-slate-600 dark:text-slate-400">Deadline</th>
                  <th className="px-6 py-3 font-medium text-slate-600 dark:text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {projects.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 group">
                    <td className="px-6 py-4 font-medium text-slate-850 dark:text-slate-200">{p.name}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-350">${p.budget.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                          <div className="bg-blue-600 dark:bg-indigo-600 h-2 rounded-full" style={{ width: `${p.completion_percentage}%` }}></div>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{p.completion_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>{p.status}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{p.deadline ? new Date(p.deadline).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(p)} className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-650 dark:hover:text-red-400 transition-colors ml-2 cursor-pointer" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-500 dark:text-slate-400">No projects found. Click "New Project" to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        token={sessionToken} 
        project={selectedProject} 
        clients={clients} 
        onSuccess={() => loadData(sessionToken)} 
      />
    </div>
  );
}
