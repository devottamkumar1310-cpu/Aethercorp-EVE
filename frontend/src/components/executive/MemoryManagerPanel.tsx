"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, Loader2, Sparkles, Target, Activity } from "lucide-react";
import { listGoals, addGoal, deleteGoal } from "@/services/executiveService";
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                <Target size={18} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-100">Long-Term Memory Manager</h2>
                <p className="text-xs text-slate-400">Set active business goals and strategic context for EVE</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form to Add Goal */}
          <div className="p-6 border-b border-slate-800 bg-slate-950/20">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1">
              <Plus size={14} /> Define Strategic Goal
            </h3>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Goal Type</label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="profitability">Profitability</option>
                  <option value="growth">Growth</option>
                  <option value="cost_reduction">Cost Reduction</option>
                  <option value="retention">Retention</option>
                  <option value="custom">Custom Goal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Goal Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="e.g. Increase margin on seasonal deadstock to 45% using pricing engine tools..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Numeric Value (Optional)</label>
                <input
                  type="number"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g. 45 or 150000"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={addingGoal || !description.trim()}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-slate-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg flex items-center justify-center gap-1.5"
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
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Activity size={14} /> Active Goals List
            </h3>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 size={24} className="text-indigo-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map((g) => (
                  <div key={g.id} className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl relative group hover:border-slate-800 transition-all">
                    <button
                      onClick={() => handleDeleteGoal(g.id)}
                      disabled={deletingId === g.id}
                      className="absolute top-3 right-3 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      {deletingId === g.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>

                    <div className="flex items-start gap-2.5">
                      <div className={`p-1.5 rounded-lg border text-[10px] uppercase font-bold tracking-wider ${
                        g.goal_type === 'profitability' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        g.goal_type === 'growth' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        g.goal_type === 'cost_reduction' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {g.goal_type.replace('_', ' ')}
                      </div>
                    </div>

                    <p className="text-slate-300 text-sm mt-3.5 pr-6 leading-relaxed font-normal">{g.description}</p>
                    {g.target_value !== undefined && g.target_value !== null && (
                      <div className="mt-2 text-xs text-indigo-400 font-medium">
                        Target Value: <span className="text-slate-200">{g.target_value}</span>
                      </div>
                    )}
                  </div>
                ))}

                {goals.length === 0 && (
                  <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl">
                    <Target className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm font-medium">No strategic goals active</p>
                    <p className="text-slate-600 text-xs mt-1">Define active business goals above to align EVE's analytical recommendations.</p>
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
