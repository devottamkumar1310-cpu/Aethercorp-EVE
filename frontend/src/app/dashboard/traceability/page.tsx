"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Sparkles, HelpCircle, HardDrive, Cpu, Compass, ListRestart, AlertTriangle, ShieldAlert, CheckCircle, Database } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL } from "@/lib/api";

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
  evidence_snapshot: Record<string, any>;
  created_at: string;
  trigger_type?: string;
  source_agent?: string;
  llm_model?: string;
  input_metrics?: Record<string, any>;
  business_rules?: string[];
  calculations?: string[];
  trust_score?: number;
  confidence_governance_flag?: string;
  evidence_validation_status?: string;
  evidence_validation_reason?: string;
}

export default function TraceabilityDashboard() {
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchTraces = async (pageIndex: number = 0, signal?: AbortSignal) => {
    setLoading(true);
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

      const offset = pageIndex * limit;
      const resp = await fetch(`${API_BASE_URL}/api/recommendations?limit=${limit}&offset=${offset}`, {
        headers,
        signal,
      });
      if (!resp.ok) {
        throw new Error(`Failed to load recommendations (HTTP ${resp.status})`);
      }
      
      const json = await resp.json();
      setTraces(json || []);
      if (json && json.length > 0) {
        setSelectedTrace(json[0]);
      } else {
        setSelectedTrace(null);
      }
      setPage(pageIndex);
    } catch (err: any) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.warn("API load failed.", err);
      setTraces([]);
      setSelectedTrace(null);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchTraces(0, controller.signal);
    return () => controller.abort();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VALIDATED": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "REJECTED": return "text-red-400 bg-red-500/10 border-red-500/20";
      case "USER_PROMPTED": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "GENERATED": 
      default:
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "VALIDATED": return <CheckCircle className="h-3.5 w-3.5" />;
      case "REJECTED": return <ShieldAlert className="h-3.5 w-3.5" />;
      default: return <CheckCircle2 className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 text-foreground lg:p-10">
      <div className="mx-auto max-w-6xl">
        
        {/* Breadcrumb / Back */}
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        {/* Title */}
        <div className="mt-6 border-b border-border pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/80 to-muted-foreground bg-clip-text text-transparent">
              Decision Traceability Audit
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Audit the calculations, data integrity sources, and AI reasoning chain behind EVE recommendations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => fetchTraces(page > 0 ? page - 1 : 0)}
              disabled={page === 0}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
            >
              Prev
            </button>
            <span className="text-xs font-medium">Page {page + 1}</span>
            <button 
              onClick={() => fetchTraces(page + 1)}
              disabled={traces.length < limit}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
            >
              Next
            </button>
            <button 
              onClick={() => fetchTraces(page)}
              className="ml-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 bg-indigo-950/10 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <ListRestart className="h-3.5 w-3.5" /> Refresh List
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-12 text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading audit traces...</p>
          </div>
        ) : traces.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-border bg-card/20 p-16 text-center max-w-xl mx-auto">
            <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No decisions have been recorded yet.</h3>
            <p className="mt-2 text-sm text-muted-foreground">This workspace has no decision traceability logs.</p>
          </div>
        ) : selectedTrace && (
          <div className="mt-8 grid gap-8 lg:grid-cols-4">
            
            {/* Sidebar Recommendation list (Col-Span-1) */}
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Generated Decisions</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                
                {/* Dynamic items */}
                {traces.map((trace) => (
                  <button
                    type="button"
                    key={trace.id}
                    onClick={() => setSelectedTrace(trace)}
                    aria-current={selectedTrace.id === trace.id ? "true" : undefined}
                    className={`w-full text-left rounded-xl p-3.5 border transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      selectedTrace.id === trace.id 
                      ? "border-emerald-500 bg-emerald-950/10" 
                      : "border-border bg-card/30 hover:border-foreground/20"
                    }`}
                  >
                    <span className="block text-xs font-semibold text-indigo-400 uppercase tracking-wide">
                      {trace.recommendation_type}
                    </span>
                    <span className="block text-sm font-bold text-foreground mt-1 truncate">{trace.action}</span>
                    <span className="block text-[10px] text-muted-foreground mt-2">{trace.created_at}</span>
                  </button>
                ))}

              </div>
            </div>

            {/* Recommendation Trace Auditing View (Col-Span-3) */}
            <div className="lg:col-span-3 grid gap-6 md:grid-cols-3">
              
              {/* The recommendation action (Col-Span-2) */}
              <div className="md:col-span-2 space-y-6">

                {/* Warning Banner */}
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex gap-3 items-start backdrop-blur-md">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-amber-500">AI-generated recommendation.</h4>
                    <p className="text-xs text-amber-500/80 mt-1">Review evidence and calculations before taking action. Explanations may not encompass all business variables.</p>
                  </div>
                </div>
                
                <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-indigo-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                        {selectedTrace.recommendation_type.toUpperCase()} RECOMMENDATION
                      </span>
                    </div>
                    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getStatusColor(selectedTrace.validation_status)}`}>
                      {getStatusIcon(selectedTrace.validation_status)}
                      {selectedTrace.validation_status}
                    </div>
                  </div>
                  
                  <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground leading-snug">
                    {selectedTrace.action}
                  </h2>
                  <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                    {selectedTrace.reasoning_chain[0] || "Stock level evaluated below target safety limit."}
                  </p>
                  
                  {/* Metadata Bar */}
                  <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-border/50 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <div><span className="opacity-50 block mb-1">Trigger</span> <span className="text-foreground">{selectedTrace.trigger_type || "UNKNOWN"}</span></div>
                    <div><span className="opacity-50 block mb-1">Agent</span> <span className="text-foreground">{selectedTrace.source_agent || "COO"}</span></div>
                    <div><span className="opacity-50 block mb-1">Model</span> <span className="text-foreground">{selectedTrace.llm_model || "gemini"}</span></div>
                    <div><span className="opacity-50 block mb-1">Timestamp</span> <span className="text-foreground">{selectedTrace.created_at}</span></div>
                  </div>
                </div>

                {/* True Trace Structure: Rules & Calculations */}
                {((selectedTrace.business_rules && selectedTrace.business_rules.length > 0) || (selectedTrace.calculations && selectedTrace.calculations.length > 0)) && (
                  <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md">
                    <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2 mb-4">
                      <Database className="h-4 w-4 text-indigo-400" /> True Decision Trace
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      {selectedTrace.business_rules && selectedTrace.business_rules.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Applied Rules</h4>
                          <ul className="space-y-2 list-disc list-inside text-sm text-foreground">
                            {selectedTrace.business_rules.map((rule, idx) => (
                              <li key={idx} className="font-mono text-xs">{rule}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedTrace.calculations && selectedTrace.calculations.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Calculations</h4>
                          <ul className="space-y-2 list-disc list-inside text-sm text-foreground">
                            {selectedTrace.calculations.map((calc, idx) => (
                              <li key={idx} className="font-mono text-xs">{calc}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reasoning Chain Timeline */}
                <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md">
                  <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2 mb-6">
                    <Compass className="h-4 w-4 text-indigo-400" /> Explainable Reasoning Steps
                  </h3>
                  
                  <div className="relative border-l-2 border-border pl-4 ml-2 space-y-6">
                    {selectedTrace.reasoning_chain.map((step, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[25px] mt-1 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-background"></div>
                        <h4 className="text-sm font-semibold text-foreground">Step {idx + 1}</h4>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidence Snapshot (Raw) */}
                {Object.keys(selectedTrace.evidence_snapshot || {}).length > 0 && (
                  <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                      Evidence Snapshot
                    </h3>
                    <pre className="text-[10px] font-mono text-muted-foreground bg-black/40 p-4 rounded-lg overflow-x-auto">
                      {JSON.stringify(selectedTrace.evidence_snapshot, null, 2)}
                    </pre>
                  </div>
                )}

              </div>

              {/* Supporting metrics & details (Right Column) */}
              <div className="space-y-6">
                
                {/* Trust Score & Governance (Phase 2) */}
                {(selectedTrace.trust_score !== undefined || selectedTrace.confidence_governance_flag) && (
                  <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md text-center space-y-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground font-semibold block">Decision Trust Score</span>
                      <p className={`mt-2 text-5xl font-extrabold tracking-tight bg-clip-text text-transparent ${
                        (selectedTrace.trust_score ?? 0) < 50 ? 'bg-gradient-to-r from-red-400 to-rose-400' :
                        (selectedTrace.trust_score ?? 0) < 80 ? 'bg-gradient-to-r from-amber-400 to-yellow-400' :
                        'bg-gradient-to-r from-emerald-400 to-teal-400'
                      }`}>
                        {selectedTrace.trust_score !== undefined ? `${Math.round(selectedTrace.trust_score)}/100` : "N/A"}
                      </p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Based on evidence, validation, risk & rules
                      </div>
                    </div>
                    
                    {selectedTrace.confidence_governance_flag && (
                      <div className="pt-4 border-t border-border/50 text-left">
                        <span className="text-xs uppercase text-muted-foreground block mb-1">Confidence Flag</span>
                        <div className={`text-xs font-semibold px-2 py-1 rounded inline-block ${
                          selectedTrace.confidence_governance_flag === 'OK' ? 'bg-emerald-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white border border-emerald-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {selectedTrace.confidence_governance_flag.replace(/_/g, ' ')}
                        </div>
                      </div>
                    )}
                    
                    {selectedTrace.evidence_validation_status && (
                      <div className="pt-2 text-left">
                        <span className="text-xs uppercase text-muted-foreground block mb-1">Evidence Status</span>
                        <div className={`text-xs font-semibold px-2 py-1 rounded inline-block ${
                          selectedTrace.evidence_validation_status === 'SUPPORTED' ? 'bg-emerald-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white border border-emerald-500/20' :
                          selectedTrace.evidence_validation_status === 'PARTIALLY_SUPPORTED' ? 'bg-blue-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white border border-blue-500/20' :
                          'bg-red-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white border border-red-500/20'
                        }`}>
                          {selectedTrace.evidence_validation_status.replace(/_/g, ' ')}
                        </div>
                        {selectedTrace.evidence_validation_reason && (
                          <p className="text-[10px] text-muted-foreground mt-1">{selectedTrace.evidence_validation_reason}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Confidence Score Card */}
                <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md text-center">
                  <span className="text-sm font-medium text-muted-foreground font-semibold">LLM Confidence Level</span>
                  <p className={`mt-3 text-5xl font-extrabold tracking-tight bg-clip-text text-transparent ${selectedTrace.validation_status === 'REJECTED' ? 'bg-gradient-to-r from-red-400 to-rose-400' : 'bg-gradient-to-r from-indigo-400 to-blue-400'}`}>
                    {(selectedTrace.confidence_score * 100).toFixed(0)}%
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-1 text-xs text-slate-400">
                    <Cpu className="h-3.5 w-3.5 text-indigo-400" /> Audited reasoning logic
                  </div>
                </div>

                {/* Input Metrics Checklist */}
                {(selectedTrace.input_metrics || selectedTrace.supporting_metrics) && (
                  <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-indigo-400" /> Evaluated Metrics
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(selectedTrace.input_metrics || selectedTrace.supporting_metrics).map(([key, value]) => (
                        <div key={key} className="flex justify-between border-b border-border/50 pb-2 text-sm">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                          <span className="font-semibold text-foreground truncate max-w-[100px] text-right" title={String(value)}>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source Database Records */}
                <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-indigo-400" /> Verified Data Sources
                  </h3>
                  <div className="space-y-2.5">
                    {selectedTrace.source_datasets.map((source, index) => (
                      <div key={index} className="rounded-lg bg-card/60 p-2.5 border border-border/40 text-xs break-words">
                        <span className="block font-semibold text-foreground leading-relaxed">{source}</span>
                      </div>
                    ))}
                    <span className="block text-[10px] text-muted-foreground mt-2 text-center font-medium">
                      Trace ID: {selectedTrace.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
