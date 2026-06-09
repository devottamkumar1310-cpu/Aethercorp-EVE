"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createTaskAPI, updateTaskAPI } from "@/services/businessService";
import { Task, Project } from "@/types/business";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  task?: Task | null;
  projects: Project[];
  onSuccess: () => void;
}

export function TaskModal({ isOpen, onClose, token, task, projects, onSuccess }: TaskModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    project_id: "",
    priority: "medium",
    status: "todo",
    due_date: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        project_id: task.project_id,
        priority: task.priority,
        status: task.status,
        due_date: task.due_date ? task.due_date.split('T')[0] : ""
      });
    } else {
      setFormData({ title: "", project_id: projects.length > 0 ? projects[0].id : "", priority: "medium", status: "todo", due_date: "" });
    }
  }, [task, isOpen, projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return toast.error("Task title is required");
    if (!formData.project_id) return toast.error("Please select a project");

    setIsSubmitting(true);
    try {
      const payload = { ...formData, due_date: formData.due_date || null };
      
      if (task) {
        await updateTaskAPI(token, task.id, payload);
        toast.success("Task updated successfully");
      } else {
        await createTaskAPI(token, payload);
        toast.success("Task created successfully");
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
          <DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Title *</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project *</label>
            <select 
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={formData.project_id}
              onChange={(e) => setFormData({...formData, project_id: e.target.value})}
              required
            >
              <option value="" disabled>Select a project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {projects.length === 0 && <p className="text-xs text-red-500 mt-1">You must create a project first.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select 
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select 
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input 
              type="date" 
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.due_date}
              onChange={(e) => setFormData({...formData, due_date: e.target.value})}
            />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors" disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2" disabled={isSubmitting || projects.length === 0}>
              {isSubmitting ? "Saving..." : "Save Task"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
