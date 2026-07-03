"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createExpenseAPI } from "@/services/businessService";

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSuccess: () => void;
}

export function ExpenseModal({ isOpen, onClose, token, onSuccess }: ExpenseModalProps) {
  const [formData, setFormData] = useState({
    amount: 0,
    category: "software",
    description: "",
    date: new Date().toISOString().split('T')[0]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0) return toast.error("Amount must be greater than zero");
    if (!formData.category.trim()) return toast.error("Category is required");

    setIsSubmitting(true);
    try {
      await createExpenseAPI(token, formData);
      toast.success("Expense recorded successfully");
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
          <DialogTitle>Add Expense</DialogTitle>
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
            <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Category *</label>
            <select 
              className="w-full px-3 py-2 border border-border dark:border-border bg-card dark:bg-card text-foreground dark:text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              required
            >
              <option value="software">Software & SaaS</option>
              <option value="hardware">Hardware</option>
              <option value="marketing">Marketing</option>
              <option value="contractor">Contractors</option>
              <option value="travel">Travel</option>
              <option value="office">Office Supplies</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground dark:text-muted-foreground mb-1">Description</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-border dark:border-border bg-card dark:bg-card text-foreground dark:text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="e.g. AWS Hosting"
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
            <button type="submit" className="px-4 py-2 text-foreground bg-red-600 hover:bg-red-700 rounded-md transition-colors flex items-center gap-2" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Expense"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
