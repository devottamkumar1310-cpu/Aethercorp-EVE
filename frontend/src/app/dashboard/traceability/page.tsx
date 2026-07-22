"use client";
import { logger } from "@/lib/logger";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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
  estimated_financial_impact?: number;
}

export default function TraceabilityDashboard() {
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;
  const searchParams = useSearchParams();
  const typeFilter = searchParams.get("type"); // e.g. "low_stock" or "dead_stock"

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
        throw new Error("Unable to retrieve decision history records at this time.");
      }
      
      const json = await resp.json();
      setTraces(json || []);
      if (json && json.length > 0) {
        const typeParam = new URLSearchParams(window.location.search).get("type");
        const filterMap: Record<string, string[]> = { low_stock: ["reorder", "low_stock"], dead_stock: ["dead_stock", "markdown"], reorder: ["reorder"], optimization: ["optimization"] };
        const allowed = typeParam ? filterMap[typeParam] : null;
        const firstMatch = allowed ? json.find((t: TraceRecord) => allowed.includes(t.recommendation_type?.toLowerCase())) : null;
        setSelectedTrace(firstMatch || json[0]);
      } else {
        setSelectedTrace(null);
      }
      setPage(pageIndex);
    } catch (err: any) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      logger.warn("API load failed.", err);
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
      case "VALIDATED": return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "REJECTED": return "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20";
      case "USER_PROMPTED": return "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "GENERATED":
      default:
        return "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "VALIDATED": return <CheckCircle className="h-3.5 w-3.5" />;
      case "REJECTED": return <ShieldAlert className="h-3.5 w-3.5" />;
      default: return <CheckCircle2 className="h-3.5 w-3.5" />;
    }
  };

  const TYPE_FILTER_MAP: Record<string, string[]> = {
    low_stock: ["reorder", "low_stock"],
    dead_stock: ["dead_stock", "markdown"],
    reorder: ["reorder"],
    optimization: ["optimization"],
  };

  const filteredTraces = useMemo(() => {
    if (!typeFilter || !TYPE_FILTER_MAP[typeFilter]) return traces;
    const allowed = TYPE_FILTER_MAP[typeFilter];
    return traces.filter((t) => allowed.includes(t.recommendation_type?.toLowerCase()));
  }, [traces, typeFilter]);

  return (
    <div className="min-h-screen bg-background p-6 text-foreground lg:p-10">
      <div className="mx-auto max-w-6xl">
        
        {/* Breadcrumb / Back */}
        <div className="space-y-1">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Operational Dashboard
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Auditability & Governance</span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-xs font-medium text-muted-foreground">Decision Traceability</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">
                Decision Traceability
              </h1>
              <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                Audit underlying evidence, financial logic, model confidence, and operational impact behind every EVE decision.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fetchTraces(page > 0 ? page - 1 : 0)}
                disabled={page === 0}
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-xl disabled:opacity-50 transition cursor-pointer"
              >
                Prev
              </button>
              <span className="text-xs font-medium text-muted-foreground">Page {page + 1}</span>
              <button 
                onClick={() => fetchTraces(page + 1)}
                disabled={traces.length < limit}
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-xl disabled:opacity-50 transition cursor-pointer"
              >
                Next
              </button>
              <button
                onClick={() => fetchTraces(page)}
                className="ml-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary hover:underline border border-primary/20 bg-primary/10 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                <ListRestart className="h-3.5 w-3.5" /> Refresh List
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-12 text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading recommendation reasoning...</p>
          </div>
        ) : filteredTraces.length === 0 && traces.length > 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-border bg-card/20 p-12 text-center max-w-xl mx-auto">
            <Compass className="mx-auto h-10 w-10 text-indigo-400 opacity-50 mb-4" />
            <h3 className="text-lg font-bold text-foreground">No {typeFilter?.replace("_", " ")} traces found.</h3>
            <p className="mt-2 text-sm text-muted-foreground">No recommendations of this type have been generated yet.</p>
            <Link href="/dashboard/traceability" className="mt-6 inline-block text-sm font-semibold text-indigo-500 hover:text-indigo-400 transition-colors">
              View all recommendations →
            </Link>
          </div>
        ) : traces.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-border bg-card/20 p-16 text-center max-w-xl mx-auto">
            <Compass className="mx-auto h-12 w-12 text-indigo-400 opacity-50 mb-4" />
            <h3 className="mt-4 text-lg font-bold text-foreground">No recommendations generated yet.</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              EVE needs to analyze your inventory data before generating decisions and reasoning traces. Once your data is processed, recommendations will appear here.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dashboard/inventory" className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-indigo-500/20">
                Upload Inventory
              </Link>
              <Link href="/dashboard/eve" className="w-full sm:w-auto px-6 py-2.5 bg-sidebar-accent/80 hover:bg-sidebar-accent border border-sidebar-border text-foreground font-semibold rounded-lg transition-colors">
                Ask EVE to Analyze
              </Link>
            </div>
          </div>
        ) : selectedTrace && (
          <div className="mt-8 grid gap-8 lg:grid-cols-4">
            
            {/* Sidebar Recommendation list (Col-Span-1) */}
            <div className="lg:col-span-1 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Generated Decisions</h3>
                {typeFilter && TYPE_FILTER_MAP[typeFilter] && (
                  <Link href="/dashboard/traceability" className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-400 uppercase tracking-wider">
                    Clear filter ×
                  </Link>
                )}
              </div>
              {typeFilter && TYPE_FILTER_MAP[typeFilter] && (
                <div className="text-[10px] font-semibold px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Filtering: {typeFilter.replace(/_/g, " ")}
                </div>
              )}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">

                {/* Dynamic items */}
                {filteredTraces.map((trace) => (
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
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                        {trace.recommendation_type}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {trace.created_at?.slice(0, 10)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-foreground line-clamp-2">
                      {trace.action}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground font-medium">Confidence</span>
                      <span className="font-bold text-emerald-500">
                        {Math.round((trace.confidence_score || 0) * 100)}%
                      </span>
                    </div>
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
                    <h4 className="text-sm font-semibold text-amber-500">Business recommendation.</h4>
                    <p className="text-xs text-amber-500/80 mt-1">Review the supporting numbers and expected impact before taking action.</p>
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
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {selectedTrace.reasoning_chain[0] || "Stock level evaluated below target safety limit."}
                  </p>
                  
                  {/* Metadata Bar */}
                  <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-border/50 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <div><span className="text-muted-foreground block mb-1 font-semibold">Business Trigger</span> <span className="text-foreground">{selectedTrace.trigger_type || "Inventory review"}</span></div>
                    <div><span className="text-muted-foreground block mb-1 font-semibold">Decision Owner</span> <span className="text-foreground">{selectedTrace.source_agent || "EVE Strategic Intelligence"}</span></div>
                    <div><span className="text-muted-foreground block mb-1 font-semibold">Evidence Sets</span> <span className="text-foreground">{selectedTrace.source_datasets?.length || 0}</span></div>
                    <div><span className="text-muted-foreground block mb-1 font-semibold">Created</span> <span className="text-foreground">{selectedTrace.created_at}</span></div>
                  </div>
                </div>

                {/* Executive Observation Card */}
                <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <Database className="h-4 w-4 text-indigo-400" /> Operational Observation
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedTrace.evidence_snapshot?.observation ? (
                      Object.entries(selectedTrace.evidence_snapshot.observation).map(([k, v]) => (
                        <div key={k} className="p-3 bg-secondary/40 rounded-lg border border-border/50">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">{k.replace(/_/g, " ")}</span>
                          <span className="text-sm font-bold text-foreground mt-0.5 block">{String(v)}</span>
                        </div>
                      ))
                    ) : (
                      Object.entries(selectedTrace.input_metrics || selectedTrace.supporting_metrics || {}).slice(0, 6).map(([k, v]) => (
                        <div key={k} className="p-3 bg-secondary/40 rounded-lg border border-border/50">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">{k.replace(/_/g, " ")}</span>
                          <span className="text-sm font-bold text-foreground mt-0.5 block">{String(v)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Business & Financial Impact Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">Business Impact</span>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {selectedTrace.evidence_snapshot?.business_impact || "Supply chain threshold exceeded requiring immediate operational intervention."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">Financial Impact</span>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      {selectedTrace.evidence_snapshot?.financial_impact || `Estimated impact of $${(selectedTrace.estimated_financial_impact || 0).toLocaleString()}.`}
                    </p>
                  </div>
                </div>

                {/* Recommended Action & Expected Outcome */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block mb-1">Recommended Action</span>
                    <p className="text-xs font-medium text-foreground leading-relaxed">
                      {selectedTrace.evidence_snapshot?.recommended_action || selectedTrace.action}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-5">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-400 block mb-1">Expected Outcome</span>
                    <p className="text-xs font-medium text-foreground leading-relaxed">
                      {selectedTrace.evidence_snapshot?.expected_outcome || "Optimize inventory levels and maximize gross revenue."}
                    </p>
                  </div>
                </div>

                {/* Risk If Ignored Warning */}
                {selectedTrace.evidence_snapshot?.risk_if_ignored && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex gap-3 items-start">
                    <ShieldAlert className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-red-400 block">Risk If Ignored</span>
                      <p className="text-xs text-red-700 dark:text-red-200 mt-1 leading-relaxed">{selectedTrace.evidence_snapshot.risk_if_ignored}</p>
                    </div>
                  </div>
                )}

                {/* Applied Business Rules & Calculations */}
                {((selectedTrace.business_rules && selectedTrace.business_rules.length > 0) || (selectedTrace.calculations && selectedTrace.calculations.length > 0)) && (
                  <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
                      <Database className="h-4 w-4 text-indigo-400" /> Decision Policy & Arithmetic
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedTrace.business_rules && selectedTrace.business_rules.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Business Rule</h4>
                          <ul className="space-y-2 text-xs text-foreground">
                            {selectedTrace.business_rules.map((rule, idx) => (
                              <li key={idx} className="bg-secondary/40 p-2 rounded border border-border/40 text-[11px] leading-relaxed">{rule}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedTrace.calculations && selectedTrace.calculations.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Financial Arithmetic</h4>
                          <ul className="space-y-2 text-xs text-foreground">
                            {selectedTrace.calculations.map((calc, idx) => (
                              <li key={idx} className="bg-secondary/40 p-2 rounded border border-border/40 text-[11px] leading-relaxed">{calc}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reasoning Chain Timeline */}
                <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-6">
                    <Compass className="h-4 w-4 text-indigo-400" /> Executive Reasoning
                  </h3>
                  
                  <div className="relative border-l-2 border-border pl-4 ml-2 space-y-6">
                    {selectedTrace.reasoning_chain.map((step, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[25px] mt-1 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-background"></div>
                        <h4 className="text-xs font-bold text-indigo-400 uppercase">Step {idx + 1}</h4>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Supporting metrics & details (Right Column) */}
              <div className="space-y-6">
                
                {/* Trust Score & Governance (Phase 2) */}
                {(selectedTrace.trust_score !== undefined || selectedTrace.confidence_governance_flag) && (
                  <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md text-center space-y-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground font-semibold block">Evidence Strength</span>
                      <p className={`mt-2 text-5xl font-extrabold tracking-tight bg-clip-text text-transparent ${
                        (selectedTrace.trust_score ?? 0) < 50 ? 'bg-gradient-to-r from-red-400 to-rose-400' :
                        (selectedTrace.trust_score ?? 0) < 80 ? 'bg-gradient-to-r from-amber-400 to-yellow-400' :
                        'bg-gradient-to-r from-emerald-400 to-teal-400'
                      }`}>
                        {selectedTrace.trust_score !== undefined ? `${Math.round(selectedTrace.trust_score)}/100` : "N/A"}
                      </p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Based on data consistency, impact size, and operating logic
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
                  <span className="text-sm font-medium text-muted-foreground font-semibold">Recommendation Confidence</span>
                  <p className={`mt-3 text-5xl font-extrabold tracking-tight bg-clip-text text-transparent ${selectedTrace.validation_status === 'REJECTED' ? 'bg-gradient-to-r from-red-400 to-rose-400' : 'bg-gradient-to-r from-indigo-400 to-blue-400'}`}>
                    {(selectedTrace.confidence_score * 100).toFixed(0)}%
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5 text-indigo-400" /> Supported by the SKU ledger
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

                {/* Supporting Business Datasets */}
                <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-indigo-400" /> Supporting Business Datasets
                  </h3>
                  <div className="space-y-2.5">
                    {selectedTrace.source_datasets.map((source, index) => (
                      <div key={index} className="rounded-lg bg-card/60 p-2.5 border border-border/40 text-xs break-words">
                        <span className="block font-semibold text-foreground leading-relaxed">{source.replace(/_/g, " ").toUpperCase()}</span>
                      </div>
                    ))}
                    <span className="block text-[10px] text-muted-foreground mt-2 text-center font-medium">
                      Decision Record: #{selectedTrace.id.slice(0, 8)}
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
