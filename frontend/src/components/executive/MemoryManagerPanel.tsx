"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, Loader2, Target, Activity, Edit2, Check, Ban, Eye, EyeOff, Calendar } from "lucide-react";
import { listGoals, addGoal, deleteGoal, updateGoal } from "@/services/executiveService";
import { BusinessGoalResponse } from "@/types/executive";

interface MemoryManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export function MemoryManagerPanel({ isOpen, onClose, token }: MemoryManagerPanelProps) {
  const [goals, setGoals] = useState<BusinessGoalResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New goal form state
  const [goalType, setGoalType] = useState("profitability");
  const [description, setDescription] = useState("");
  const [targetValue, setTargetValue] = useState("");

  // Edit goal form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGoalType, setEditGoalType] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTargetValue, setEditTargetValue] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchGoals = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listGoals(token);
      setGoals(data);
    } catch (err) {
      console.error("Failed to load goals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGoals();
    }
  }, [isOpen, token]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setAddingGoal(true);
    try {
      await addGoal(
        {
          goal_type: goalType,
          description: description,
          target_value: targetValue ? parseFloat(targetValue) : undefined
        },
        token
      );
      setDescription("");
      setTargetValue("");
      await fetchGoals();
    } catch (err) {
      console.error("Failed to add goal:", err);
    } finally {
      setAddingGoal(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteGoal(id, token);
      await fetchGoals();
    } catch (err) {
      console.error("Failed to delete goal:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (id: string, currentActive: boolean) => {
    setUpdatingId(id);
    try {
      await updateGoal(id, { is_active: !currentActive }, token);
      await fetchGoals();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const startEditing = (g: BusinessGoalResponse) => {
    setEditingId(g.id);
    setEditGoalType(g.goal_type);
    setEditDescription(g.description);
    setEditTargetValue(g.target_value !== undefined && g.target_value !== null ? String(g.target_value) : "");
  };

  const handleEditSave = async (id: string) => {
    if (!editDescription.trim()) return;
    setUpdatingId(id);
    try {
      await updateGoal(
        id,
        {
          goal_type: editGoalType,
          description: editDescription,
          target_value: editTargetValue ? parseFloat(editTargetValue) : undefined
        },
        token
      );
      setEditingId(null);
      await fetchGoals();
    } catch (err) {
      console.error("Failed to save edited goal:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-background backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-card border-l border-border flex flex-col shadow-2xl">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border bg-card backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                <Target size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground font-sans">Strategic Goals Manager</h2>
                <p className="text-xs text-muted-foreground">Set active business goals and strategic context for EVE</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form to Add Goal */}
          <div className="p-6 border-b border-border bg-background">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-1">
              <Plus size={14} /> Define Strategic Goal
            </h3>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Goal Type</label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option value="profitability">Profitability</option>
                  <option value="growth">Growth</option>
                  <option value="cost_reduction">Cost Reduction</option>
                  <option value="retention">Retention</option>
                  <option value="custom">Custom Goal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Goal Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="e.g. Increase margin on seasonal deadstock to 45% using pricing engine tools..."
                  rows={3}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-muted-foreground resize-none font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Target Numeric Value (Optional)</label>
                <input
                  type="number"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g. 45 or 150000"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-muted-foreground"
                />
              </div>

              <button
                type="submit"
                disabled={addingGoal || !description.trim()}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-muted-foreground text-foreground rounded-lg text-sm font-semibold transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {addingGoal ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Adding Goal...
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Save Goal Context
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Current Goals List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Activity size={14} /> Active Goals List
            </h3>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 size={24} className="text-indigo-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map((g) => {
                  const isEditing = editingId === g.id;
                  const isUpdating = updatingId === g.id;
                  const createdDate = new Date(g.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <div 
                      key={g.id} 
                      className={`p-4 bg-background border rounded-xl relative group transition-all ${
                        g.is_active 
                          ? "border-border hover:border-border" 
                          : "border-slate-850/40 opacity-70 hover:opacity-100 hover:border-border"
                      }`}
                    >
                      {/* Top Action Buttons (Edit / Toggle Active / Delete) */}
                      {!isEditing && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditing(g)}
                            disabled={isUpdating}
                            title="Edit goal"
                            className="p-1 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-all cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(g.id, g.is_active)}
                            disabled={isUpdating}
                            title={g.is_active ? "Disable goal" : "Enable goal"}
                            className={`p-1 rounded transition-all cursor-pointer ${
                              g.is_active 
                                ? "text-muted-foreground hover:text-amber-450 hover:bg-amber-500/10" 
                                : "text-muted-foreground hover:text-emerald-450 hover:bg-emerald-500/10"
                            }`}
                          >
                            {isUpdating ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : g.is_active ? (
                              <EyeOff size={13} />
                            ) : (
                              <Eye size={13} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(g.id)}
                            disabled={deletingId === g.id}
                            title="Delete goal"
                            className="p-1 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                          >
                            {deletingId === g.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </div>
                      )}

                      {isEditing ? (
                        /* Inline Edit Form */
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                              Editing Goal
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleEditSave(g.id)}
                                disabled={isUpdating || !editDescription.trim()}
                                className="p-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded transition-all flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 cursor-pointer"
                              >
                                {isUpdating ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                disabled={isUpdating}
                                className="p-1 bg-secondary text-muted-foreground hover:bg-secondary rounded transition-all text-[10px] font-semibold px-2 py-0.5 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] text-muted-foreground mb-0.5 font-medium">Goal Type</label>
                            <select
                              value={editGoalType}
                              onChange={(e) => setEditGoalType(e.target.value)}
                              className="w-full bg-card border border-border rounded px-2 py-1 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="profitability">Profitability</option>
                              <option value="growth">Growth</option>
                              <option value="cost_reduction">Cost Reduction</option>
                              <option value="retention">Retention</option>
                              <option value="custom">Custom Goal</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-muted-foreground mb-0.5 font-medium">Goal Description</label>
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              required
                              rows={3}
                              className="w-full bg-card border border-border rounded px-2 py-1 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-muted-foreground mb-0.5 font-medium">Target Value (Optional)</label>
                            <input
                              type="number"
                              step="any"
                              value={editTargetValue}
                              onChange={(e) => setEditTargetValue(e.target.value)}
                              className="w-full bg-card border border-border rounded px-2 py-1 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      ) : (
                        /* Normal Goal Display */
                        <>
                          <div className="flex flex-wrap items-center gap-2 pr-12">
                            {/* Type Badge */}
                            <div className={`p-1.5 py-0.5 rounded border text-[9px] uppercase font-bold tracking-wider ${
                              g.goal_type === 'profitability' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              g.goal_type === 'growth' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                              g.goal_type === 'cost_reduction' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              'bg-slate-500/10 text-muted-foreground border-slate-500/20'
                            }`}>
                              {g.goal_type.replace('_', ' ')}
                            </div>

                            {/* Status Badge */}
                            <div className={`p-1.5 py-0.5 rounded border text-[9px] uppercase font-bold tracking-wider ${
                              g.is_active 
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {g.is_active ? 'Active' : 'Disabled'}
                            </div>
                          </div>

                          <p className="text-muted-foreground text-sm mt-3 pr-6 leading-relaxed font-normal font-sans">{g.description}</p>
                          
                          {g.target_value !== undefined && g.target_value !== null && (
                            <div className="mt-2 text-xs text-indigo-400 font-medium">
                              Target Value: <span className="text-foreground">{g.target_value}</span>
                            </div>
                          )}

                          {/* Created Date Info */}
                          <div className="mt-3.5 pt-2.5 border-t border-border flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Calendar size={11} className="text-muted-foreground" />
                            <span>Created: {createdDate}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {goals.length === 0 && (
                  <div className="text-center py-12 px-4 border border-dashed border-border rounded-xl">
                    <Target className="w-8 h-8 text-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm font-medium">No strategic goals active</p>
                    <p className="text-muted-foreground text-xs mt-1">Define active business goals above to align EVE's analytical recommendations.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
