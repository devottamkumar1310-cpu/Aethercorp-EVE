"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { fetchProjects, fetchClients, deleteProjectAPI } from "@/services/businessService";
import { Project, Client } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import { Plus, Edit2, Trash2 } from "lucide-react";
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
      logger.error(err);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const { data: { // get session
          session } } = await supabase.auth.getSession();
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
    } catch {
      toast.error("Project data is currently syncing. Please try again.");
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-8 transition-colors duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">Initiatives you are running across the business.</p>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer text-sm font-medium">
          <Plus size={17}/> New Project
        </button>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden animate-pulse">
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Project Name</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Budget</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Progress</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Deadline</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-2/3" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-1/4" /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2" />
                        <div className="h-3 bg-muted rounded w-6" />
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-6 bg-muted rounded-full w-16" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-1/4" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-muted rounded w-8 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Project</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Budget</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Progress</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Deadline</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map(p => (
                  <tr key={p.id} className="hover:bg-muted/40 group">
                    <td className="px-6 py-4 font-medium text-primary">{p.name}</td>
                    <td className="px-6 py-4 text-muted-foreground font-semibold">${p.budget.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-muted rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${p.completion_percentage}%` }}></div>
                        </div>
                        <span className="text-xs text-muted-foreground font-semibold">{p.completion_percentage}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.status === 'active' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-muted text-foreground'}`}>{p.status}</span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{p.deadline ? new Date(p.deadline).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(p)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-muted-foreground hover:text-rose-500 transition-colors ml-2 cursor-pointer" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No projects yet. Create one to get started.</td></tr>
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
