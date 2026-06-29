"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Sparkles, HelpCircle, HardDrive, Cpu, Compass, ListRestart } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface TraceRecord {
  id: string;
  organization_id: string;
  recommendation_type: string;
  action: string;
  confidence_score: number;
  validation_status: string;
  source_datasets: string[];
  supporting_metrics: Record<string, any>;
  reasoning_chain: string[];
  created_at: string;
}

// Resilient Pre-seeded Fallback Dataset
const fallbackRecommendation: TraceRecord = {
  id: "rec-123456",
  organization_id: "demo-org",
  recommendation_type: "reorder",
  action: "Order 500 units",
  confidence_score: 0.94,
  validation_status: "verified",
  source_datasets: [
    "Inventory Item #123 (Cotton Crew Neck Shirt)",
    "Supplier Alpha (Alpha Clothing Corp)"
  ],
  supporting_metrics: {
    stock: 10,
    threshold: 50,
    velocity_per_day: 3.5,
    estimated_out_of_stock_days: 2.8
  },
  reasoning_chain: [
    "Stock level is checked (current = 10). Safety reorder threshold is 50. Reorder condition is met.",
    "Average sales velocity is 3.5 units/day. Estimated days to absolute stockout is 2.8 days.",
    "Base needed restock is 40 units. Adjusted to Supplier Alpha's Minimum Order Quantity (MOQ) constraint of 500 units."
  ],
  created_at: "2026-06-29"
};

export default function TraceabilityDashboard() {
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceRecord>(fallbackRecommendation);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTraces = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const token = session?.access_token;
      const workspaceId = localStorage.getItem("active_workspace_id");
      
      if (!token || !workspaceId) {
        setLoading(false);
        return;
      }

      const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`,
        "X-Workspace-Id": workspaceId
      };

      const resp = await fetch("/api/recommendations", { headers });
      if (!resp.ok) {
        throw new Error(`Failed to load recommendations (HTTP ${resp.status})`);
      }
      
      const json = await resp.json();
      if (json && json.length > 0) {
        setTraces(json);
        setSelectedTrace(json[0]);
      }
    } catch (err: any) {
      console.warn("API load bypassed. Falling back to pre-seeded dataset.", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraces();
  }, []);

  return (
    <div className="min-h-screen bg-[#090b10] p-6 text-white lg:p-10">
      <div className="mx-auto max-w-6xl">
        
        {/* Breadcrumb / Back */}
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        {/* Title */}
        <div className="mt-6 border-b border-slate-800/80 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Decision Traceability Audit
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Audit the calculations, data integrity sources, and AI reasoning chain behind EVE recommendations.
            </p>
          </div>
          {traces.length > 0 && (
            <button 
              onClick={fetchTraces}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 bg-indigo-950/10 px-3 py-1.5 rounded-lg transition"
            >
              <ListRestart className="h-3.5 w-3.5" /> Refresh List
            </button>
          )}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-4">
          
          {/* Sidebar Recommendation list (Col-Span-1) */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Generated Decisions</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              
              {/* Fallback item when empty */}
              {traces.length === 0 && (
                <div 
                  onClick={() => setSelectedTrace(fallbackRecommendation)}
                  className={`w-full text-left rounded-xl p-3.5 border transition cursor-pointer ${
 selectedTrace.id === fallbackRecommendation.id 
 ? "border-emerald-500 bg-emerald-950/10" 
 : "border-slate-800 bg-[#121620]/30 hover:border-slate-700"
 }`}
                >
                  <span className="block text-xs font-semibold text-emerald-400 uppercase tracking-wide">Pre-seeded Fallback</span>
                  <span className="block text-sm font-bold text-white mt-1">{fallbackRecommendation.action}</span>
                  <span className="block text-[10px] text-slate-500 mt-2">{fallbackRecommendation.created_at}</span>
                </div>
              )}

              {/* Dynamic items */}
              {traces.map((trace) => (
                <div 
                  key={trace.id}
                  onClick={() => setSelectedTrace(trace)}
                  className={`w-full text-left rounded-xl p-3.5 border transition cursor-pointer ${
 selectedTrace.id === trace.id 
 ? "border-emerald-500 bg-emerald-950/10" 
 : "border-slate-800 bg-[#121620]/30 hover:border-slate-700"
 }`}
                >
                  <span className="block text-xs font-semibold text-indigo-400 uppercase tracking-wide">
                    {trace.recommendation_type}
                  </span>
                  <span className="block text-sm font-bold text-white mt-1 truncate">{trace.action}</span>
                  <span className="block text-[10px] text-slate-500 mt-2">{trace.created_at}</span>
                </div>
              ))}

            </div>
          </div>

          {/* Recommendation Trace Auditing View (Col-Span-3) */}
          <div className="lg:col-span-3 grid gap-6 md:grid-cols-3">
            
            {/* The recommendation action (Col-Span-2) */}
            <div className="md:col-span-2 space-y-6">
              
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      {selectedTrace.recommendation_type.toUpperCase()} RECOMMENDATION
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {selectedTrace.validation_status}
                  </div>
                </div>
                
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                  {selectedTrace.action}
                </h2>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                  {selectedTrace.reasoning_chain[0] || "Stock level evaluated below target safety limit."}
                </p>
              </div>

              {/* Reasoning Chain Timeline */}
              <div className="rounded-2xl border border-slate-800/80 bg-[#121620]/40 p-6 backdrop-blur-md">
                <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2 mb-6">
                  <Compass className="h-4 w-4 text-indigo-400" /> Explainable Reasoning Steps
                </h3>
                
                <div className="relative border-l-2 border-slate-800 pl-4 ml-2 space-y-6">
                  {selectedTrace.reasoning_chain.map((step, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[25px] mt-1 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-slate-900"></div>
                      <h4 className="text-sm font-semibold text-slate-200">Step {idx + 1}</h4>
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Supporting metrics & details (Right Column) */}
            <div className="space-y-6">
              
              {/* Confidence Score Card */}
              <div className="rounded-2xl border border-slate-800/80 bg-[#121620]/60 p-6 backdrop-blur-md text-center">
                <span className="text-sm font-medium text-slate-400">Certainty Index</span>
                <p className="mt-3 text-5xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {(selectedTrace.confidence_score * 100).toFixed(0)}%
                </p>
                <div className="mt-4 flex items-center justify-center gap-1 text-xs text-slate-400">
                  <Cpu className="h-3.5 w-3.5" /> High Certainty Logic
                </div>
              </div>

              {/* Metrics Checklist */}
              <div className="rounded-2xl border border-slate-800/80 bg-[#121620]/60 p-6 backdrop-blur-md">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-indigo-400" /> Supporting Metrics
                </h3>
                <div className="space-y-3">
                  {Object.entries(selectedTrace.supporting_metrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between border-b border-slate-800 pb-2 text-sm">
                      <span className="text-slate-400 capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-slate-200">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Source Database Records */}
              <div className="rounded-2xl border border-slate-800/80 bg-[#121620]/60 p-6 backdrop-blur-md">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-indigo-400" /> Verified Data Sources
                </h3>
                <div className="space-y-2.5">
                  {selectedTrace.source_datasets.map((source, index) => (
                    <div key={index} className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800/40 text-xs">
                      <span className="block font-semibold text-slate-300">{source}</span>
                    </div>
                  ))}
                  <span className="block text-[10px] text-slate-500 mt-2 text-center">
                    Audited: {selectedTrace.created_at}
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
