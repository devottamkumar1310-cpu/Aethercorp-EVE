"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle, AlertCircle, TrendingUp, Sparkles, Send, Loader2 } from "lucide-react";
import { getDailyBrief } from "@/services/executiveService";
import { DailyBriefResponse } from "@/types/executive";

interface DailyBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onAskFollowUp?: (question: string) => void;
}

export function DailyBriefModal({ isOpen, onClose, token, onAskFollowUp }: DailyBriefModalProps) {
  const [brief, setBrief] = useState<DailyBriefResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpText, setFollowUpText] = useState("");

  useEffect(() => {
    if (isOpen && token) {
      const fetchBrief = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await getDailyBrief(token);
          setBrief(data);
        } catch (err: any) {
          console.error("Error fetching daily brief:", err);
          setError(err.message || "Failed to load the daily brief.");
        } finally {
          setLoading(false);
        }
      };
      fetchBrief();
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleSubmitFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpText.trim()) return;
    if (onAskFollowUp) {
      onAskFollowUp(followUpText);
      onClose();
    }
    setFollowUpText("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">AI Daily Executive Brief</h2>
              <p className="text-xs text-slate-400">Synthesized business health and key priority analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-slate-400 text-sm">Compiling daily briefs, weighing risks, and analyzing growth indicators...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-slate-200 text-sm font-medium">{error}</p>
              <button 
                onClick={() => {
                  if (token) {
                    setLoading(true);
                    getDailyBrief(token)
                      .then(setBrief)
                      .catch((err) => setError(err.message))
                      .finally(() => setLoading(false));
                  }
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && brief && (
            <>
              {/* Health Score Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-slate-950/50 border border-slate-800/80 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Business Health Score</span>
                  <span className={`text-5xl font-black mt-2 tracking-tight ${
                    brief.health_score >= 80 ? 'text-emerald-400' : brief.health_score >= 60 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {brief.health_score}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-2 border ${
                    brief.health_score >= 80 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : brief.health_score >= 60 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {brief.health_status}
                  </span>
                </div>

                <div className="md:col-span-2 p-5 bg-slate-950/30 border border-slate-800/80 rounded-xl flex flex-col justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">Executive Summary</span>
                  <p className="text-slate-300 text-sm leading-relaxed">{brief.summary}</p>
                </div>
              </div>

              {/* Recommendations & Urgent Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Priorities & Recommendations */}
                <div className="p-5 bg-indigo-950/20 border border-indigo-500/10 rounded-xl">
                  <h3 className="text-sm font-semibold text-indigo-400 flex items-center gap-1.5 mb-3">
                    <Sparkles size={16} /> Top Recommendations & Priorities
                  </h3>
                  <ul className="space-y-2">
                    {brief.recommendations.map((rec, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-indigo-400 font-bold">{i + 1}.</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                    {brief.recommendations.length === 0 && (
                      <li className="text-sm text-slate-500 italic">No recommendations calculated for today.</li>
                    )}
                  </ul>
                </div>

                {/* Urgent Actions */}
                <div className="p-5 bg-amber-950/20 border border-amber-500/10 rounded-xl">
                  <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5 mb-3">
                    <AlertTriangle size={16} /> Urgent Actions Required
                  </h3>
                  <ul className="space-y-2">
                    {brief.urgent_actions && brief.urgent_actions.map((act, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-amber-400 font-bold">⚠️</span>
                        <span>{act}</span>
                      </li>
                    ))}
                    {(!brief.urgent_actions || brief.urgent_actions.length === 0) && (
                      <li className="text-sm text-slate-500 italic">No urgent actions pending.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Risks & Opportunities Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Risks */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Active Risks
                  </h3>
                  <div className="space-y-2">
                    {brief.risks.map((risk, i) => (
                      <div key={i} className="p-3.5 bg-rose-500/5 border border-rose-500/10 rounded-xl flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-rose-300 tracking-wide uppercase">{risk.category || "General Risk"}</span>
                          {risk.impact_level && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                              risk.impact_level === 'high' 
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            }`}>
                              {risk.impact_level} impact
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">{risk.description}</p>
                      </div>
                    ))}
                    {brief.risks.length === 0 && (
                      <p className="text-sm text-slate-500 italic">No business risks identified.</p>
                    )}
                  </div>
                </div>

                {/* Opportunities */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                    <TrendingUp size={16} /> Key Opportunities
                  </h3>
                  <div className="space-y-2">
                    {brief.opportunities.map((opp, i) => (
                      <div key={i} className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-emerald-300 tracking-wide uppercase">{opp.category || "Growth"}</span>
                          {opp.value_potential !== undefined && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                              +${opp.value_potential.toLocaleString()} potential
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed">{opp.description}</p>
                      </div>
                    ))}
                    {brief.opportunities.length === 0 && (
                      <p className="text-sm text-slate-500 italic">No immediate growth opportunities detected.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              {brief.recent_activity && brief.recent_activity.length > 0 && (
                <div className="p-5 bg-slate-950/30 border border-slate-800/80 rounded-xl space-y-3">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                    <TrendingUp size={16} className="text-indigo-400" /> Recent Activity Feed
                  </h3>
                  <div className="divide-y divide-slate-800/40">
                    {brief.recent_activity.map((act) => (
                      <div key={act.id} className="py-2.5 flex justify-between items-start text-xs text-slate-300">
                        <div>
                          <span className="font-semibold text-slate-200 block">{act.action}</span>
                          <span className="text-slate-400">{act.description}</span>
                        </div>
                        {act.created_at && (
                          <span className="text-slate-500 text-[10px]">
                            {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer follow-up box */}
        {!loading && !error && brief && (
          <div className="p-4 bg-slate-950 border-t border-slate-800">
            <form onSubmit={handleSubmitFollowUp} className="flex gap-2 items-center">
              <input
                type="text"
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                placeholder="Ask EVE a follow-up on this brief (e.g., 'How can we mitigate the cost-reduction risk?')..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!followUpText.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-slate-500 text-white rounded-xl transition-all shadow-lg flex items-center justify-center"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
