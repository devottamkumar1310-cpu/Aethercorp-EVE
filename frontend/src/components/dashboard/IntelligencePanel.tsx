"use client";

import { useEffect, useState } from "react";
import { 
  fetchHealth, 
  fetchExecutiveSummary, 
  fetchRisks, 
  fetchOpportunities, 
  fetchActions,
  createSnapshot
} from "@/services/intelligenceService";
import { Activity, AlertTriangle, CheckCircle, TrendingUp, Zap, Target } from "lucide-react";
import { toast } from "sonner";

interface IntelligencePanelProps {
  token: string;
}

export function IntelligencePanel({ token }: IntelligencePanelProps) {
  const [health, setHealth] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [risks, setRisks] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIntelligence() {
      try {
        const [h, s, r, o, a] = await Promise.all([
          fetchHealth(token),
          fetchExecutiveSummary(token),
          fetchRisks(token),
          fetchOpportunities(token),
          fetchActions(token)
        ]);
        setHealth(h);
        setSummary(s);
        setRisks(r.risks);
        setOpportunities(o.opportunities);
        setActions(a.actions);
      } catch (err) {
        console.error("Failed to load intelligence", err);
      } finally {
        setLoading(false);
      }
    }
    if (token) loadIntelligence();
  }, [token]);

  const handleCaptureSnapshot = async () => {
    try {
      await createSnapshot(token);
      toast.success("Intelligence Snapshot captured successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to capture snapshot");
    }
  };

  if (loading) return <div className="bg-card p-6 rounded-xl border border-border animate-pulse h-64"></div>;

  const getHealthColor = (status: string) => {
    if (status === "excellent") return "text-green-600";
    if (status === "healthy") return "text-emerald-500";
    if (status === "warning") return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6 flex flex-col">
      <div className="bg-card px-6 py-4 flex justify-between items-center text-foreground">
        <div className="flex items-center gap-2">
          <Zap className="text-yellow-400" size={20} />
          <h2 className="font-bold text-lg">Business Intelligence Engine</h2>
        </div>
        <button onClick={handleCaptureSnapshot} className="text-xs bg-secondary hover:bg-secondary px-3 py-1.5 rounded-md transition-colors border border-border">
          Capture Snapshot
        </button>
      </div>
      
      <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Col: Health & Summary */}
        <div className="lg:col-span-1 border-r border-border pr-6 flex flex-col gap-6">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Business Health</p>
            <div className="flex items-end gap-2">
              <span className={`text-5xl font-black ${getHealthColor(health?.status)}`}>{health?.score}</span>
              <span className="text-muted-foreground mb-1">/100</span>
            </div>
            <p className="text-sm font-medium mt-1 capitalize text-foreground">Status: {health?.status}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Executive Summary</p>
            <p className="text-foreground text-sm leading-relaxed">{summary?.summary}</p>
          </div>
        </div>

        {/* Mid Col: Risks & Opportunities */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="text-amber-500" size={16} />
              <p className="text-sm font-semibold text-foreground">Top Risks</p>
            </div>
            <div className="space-y-3">
              {risks.slice(0, 3).map((r, i) => (
                <div key={i} className="bg-amber-50 border border-amber-100 p-3 rounded-lg">
                  <p className="text-xs font-bold text-amber-800 uppercase mb-1">{r.severity} Priority</p>
                  <p className="text-sm font-semibold text-amber-900">{r.title}</p>
                  <p className="text-xs text-amber-700 mt-1">{r.description}</p>
                </div>
              ))}
              {risks.length === 0 && <p className="text-sm text-muted-foreground italic">No significant risks detected.</p>}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="text-blue-500" size={16} />
              <p className="text-sm font-semibold text-foreground">Top Opportunities</p>
            </div>
            <div className="space-y-3">
              {opportunities.slice(0, 3).map((o, i) => (
                <div key={i} className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900">{o.title}</p>
                  <p className="text-xs text-blue-700 mt-1">{o.description}</p>
                </div>
              ))}
              {opportunities.length === 0 && <p className="text-sm text-muted-foreground italic">Tracking baseline metrics for opportunities.</p>}
            </div>
          </div>
        </div>

        {/* Right Col: Actions */}
        <div className="lg:col-span-1 pl-0 lg:pl-6 border-t lg:border-t-0 lg:border-l border-border pt-6 lg:pt-0">
          <div className="flex items-center gap-2 mb-3">
            <Target className="text-indigo-500" size={16} />
            <p className="text-sm font-semibold text-foreground">Recommended Actions</p>
          </div>
          <div className="space-y-3">
            {actions.slice(0, 4).map((a, i) => (
              <div key={i} className="flex gap-2 items-start">
                <CheckCircle size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-foreground">{a.action}</p>
                  <p className={`text-[10px] font-bold uppercase mt-1 ${a.priority === 'high' ? 'text-red-500' : 'text-muted-foreground'}`}>{a.priority} Priority</p>
                </div>
              </div>
            ))}
            {actions.length === 0 && <p className="text-sm text-muted-foreground italic">Operations are fully optimized.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
