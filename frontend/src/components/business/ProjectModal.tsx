"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createProjectAPI, updateProjectAPI } from "@/services/businessService";
import { Project, Client } from "@/types/business";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  project?: Project | null;
  clients: Client[];
  onSuccess: () => void;
}

export function ProjectModal({ isOpen, onClose, token, project, clients, onSuccess }: ProjectModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    client_id: "",
    budget: 0,
    deadline: "",
    status: "active"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        client_id: project.client_id,
        budget: project.budget,
        deadline: project.deadline ? project.deadline.split('T')[0] : "",
        status: project.status
      });
    } else {
      setFormData({ name: "", client_id: clients.length > 0 ? clients[0].id : "", budget: 0, deadline: "", status: "active" });
    }
  }, [project, isOpen, clients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Project name is required");
    if (!formData.client_id) return toast.error("Please select a client");
    if (formData.budget < 0) return toast.error("Budget cannot be negative");

    setIsSubmitting(true);
    try {
      // Ensure date is formatted properly if empty
      const payload = { ...formData, deadline: formData.deadline || null };
      
      if (project) {
        await updateProjectAPI(token, project.id, payload);
        toast.success("Project updated successfully");
      } else {
        await createProjectAPI(token, payload);
        toast.success("Project created successfully");
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Project Name *</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-border dark:border-border bg-card dark:bg-card text-foreground dark:text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Client *</label>
            <select 
              className="w-full px-3 py-2 border border-border dark:border-border bg-card dark:bg-card text-foreground dark:text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.client_id}
              onChange={(e) => setFormData({...formData, client_id: e.target.value})}
              required
            >
              <option value="" disabled>Select a client</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
            {clients.length === 0 && <p className="text-xs text-red-500 mt-1">You must create a client first.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Budget ($)</label>
              <input 
                type="number" 
                min="0"
                className="w-full px-3 py-2 border border-border dark:border-border bg-card dark:bg-card text-foreground dark:text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.budget}
                onChange={(e) => setFormData({...formData, budget: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Deadline</label>
              <input 
                type="date" 
                className="w-full px-3 py-2 border border-border dark:border-border bg-card dark:bg-card text-foreground dark:text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.deadline}
                onChange={(e) => setFormData({...formData, deadline: e.target.value})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Status</label>
            <select 
              className="w-full px-3 py-2 border border-border dark:border-border bg-card dark:bg-card text-foreground dark:text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-muted-foreground dark:text-muted-foreground bg-secondary dark:bg-secondary hover:bg-secondary dark:hover:bg-secondary rounded-md transition-colors" disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="px-4 py-2 text-foreground bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2" disabled={isSubmitting || clients.length === 0}>
              {isSubmitting ? "Saving..." : "Save Project"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
