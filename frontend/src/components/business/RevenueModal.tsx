"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createRevenueAPI } from "@/services/businessService";
import { Project } from "@/types/business";

interface RevenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  projects: Project[];
  onSuccess: () => void;
}

export function RevenueModal({ isOpen, onClose, token, projects, onSuccess }: RevenueModalProps) {
  const [formData, setFormData] = useState({
    amount: 0,
    project_id: projects.length > 0 ? projects[0].id : "",
    description: "",
    date: new Date().toISOString().split('T')[0]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0) return toast.error("Amount must be greater than zero");
    if (!formData.project_id) return toast.error("Please select a project");

    setIsSubmitting(true);
    try {
      await createRevenueAPI(token, formData);
      toast.success("Revenue recorded successfully");
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
          <DialogTitle>Add Revenue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Amount ($) *</label>
            <input 
              type="number" 
              step="0.01"
              min="0.01"
              className="w-full px-3 py-2 border border-border dark:border-border bg-card dark:bg-card text-foreground dark:text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.amount || ''}
              onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Project *</label>
            <select 
              className="w-full px-3 py-2 border border-border dark:border-border bg-card dark:bg-card text-foreground dark:text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Description</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-border dark:border-border bg-card dark:bg-card text-foreground dark:text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="e.g. Initial Deposit"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Date</label>
            <input 
              type="date" 
              className="w-full px-3 py-2 border border-border dark:border-border bg-card dark:bg-card text-foreground dark:text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-muted-foreground dark:text-muted-foreground bg-secondary dark:bg-secondary hover:bg-secondary dark:hover:bg-secondary rounded-md transition-colors" disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="px-4 py-2 text-foreground bg-green-600 hover:bg-green-700 rounded-md transition-colors flex items-center gap-2" disabled={isSubmitting || projects.length === 0}>
              {isSubmitting ? "Save Revenue" : "Save Revenue"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
