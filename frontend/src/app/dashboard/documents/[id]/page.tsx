"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getDocumentDetails, fetchDocumentPreviewBlob } from "@/services/documentService";
import { ProcessedDocumentDetail } from "@/types/document";
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ShieldAlert, 
  FileText, 
  MessageSquare,
  Sparkles,
  Download,
  AlertTriangle,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [document, setDocument] = useState<ProcessedDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const loadDocument = async (token: string) => {
    try {
      const data = await getDocumentDetails(docId, token);
      setDocument(data);

      try {
        const blob = await fetchDocumentPreviewBlob(docId, token);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch (err) {
        logger.error("Failed to load document preview blob:", err);
      }
    } catch {
      toast.error("Document hub is currently processing updates. Please try again.");
      router.push("/dashboard/documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      await loadDocument(session.access_token);
    }
    init();

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [docId, router]);

  const handleDownload = () => {
    if (!previewUrl || !document) return;
    const a = window.document.createElement("a");
    a.href = previewUrl;
    a.download = document.filename;
    a.click();
  };

  const getFriendlyMimeLabel = (mime: string) => {
    if (!mime) return "Document";
    const lower = mime.toLowerCase();
    if (lower.startsWith("image/")) return "Image";
    if (lower === "application/pdf") return "PDF Document";
    if (lower === "text/csv") return "CSV Data Table";
    if (lower.includes("sheet") || lower.includes("excel") || lower.includes("xlsx")) return "Excel Spreadsheet";
    return "Business Document";
  };

  const renderExtractedData = (data: any) => {
    if (!data || typeof data !== "object") {
      return (
        <div className="p-4 bg-background border border-border rounded-xl text-center text-xs text-muted-foreground italic">
          No structured metadata extracted yet.
        </div>
      );
    }
    
    const formatKey = (key: string) => {
      return key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const entries = Object.entries(data).filter((entry) => typeof entry[1] !== "object" && entry[1] !== null);
    const arrays = Object.entries(data).filter((entry) => Array.isArray(entry[1]));

    return (
      <div className="space-y-4">
        {entries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
            {entries.map(([key, val]) => (
              <div key={key} className="bg-background border border-border rounded-xl p-3.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">{formatKey(key)}</span>
                <span className="text-sm font-bold text-foreground mt-1 block truncate">
                  {String(val)}
                </span>
              </div>
            ))}
          </div>
        )}
        {arrays.map(([key, val]: any) => (
          <div key={key} className="space-y-2 pt-2 animate-fade-in">
            <span className="text-xs font-bold text-muted-foreground block uppercase tracking-wider">{formatKey(key)}</span>
            <div className="bg-background border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[400px]">
                <thead>
                  <tr className="bg-card border-b border-slate-800 text-muted-foreground">
                    {val.length > 0 && Object.keys(val[0]).map((header) => (
                      <th key={header} className="p-3 font-semibold uppercase">{formatKey(header)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {val.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-800/40 hover:bg-card text-muted-foreground">
                      {Object.values(item).map((v: any, cellIdx) => (
                        <td key={cellIdx} className="p-3">{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto text-slate-950 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-muted rounded-xl" />
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-48" />
              <div className="h-3.5 bg-muted rounded w-32" />
            </div>
          </div>
          <div className="h-10 bg-muted rounded-xl w-32" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card border border-border rounded-2xl flex flex-col min-h-[500px]">
            <div className="p-4 bg-background border-b border-border h-12" />
            <div className="flex-1 bg-secondary p-4" />
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="h-5 bg-muted rounded w-1/3" />
              <div className="h-16 bg-slate-100 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center text-foreground">
        <XCircle className="h-12 w-12 text-red-500 mb-3" />
        <p className="font-semibold text-lg">Document Not Found</p>
        <Link href="/dashboard/documents" className="mt-4 text-indigo-400 hover:underline flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto text-foreground">
      {/* Navigation & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/documents"
            className="p-2 bg-secondary hover:bg-secondary text-muted-foreground border border-border rounded-xl transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight max-w-md truncate">{document.filename}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {new Date(document.created_at).toLocaleDateString()}
              </span>
              <span>•</span>
              <span className="px-2.5 py-0.5 bg-secondary text-muted-foreground rounded-full font-semibold border border-slate-700">
                {getFriendlyMimeLabel(document.content_type)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {previewUrl && (
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary text-muted-foreground font-semibold border border-border rounded-xl transition-all"
            >
              <Download className="h-4 w-4" /> Download File
            </button>
          )}
          {(document.status === "completed" || document.status === "success") && (
            <Link 
              href={`/dashboard/eve?document_id=${document.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 text-foreground font-bold rounded-xl shadow-lg transition-all"
            >
              <MessageSquare className="h-4 w-4" /> Ask EVE AI Assistant
            </Link>
          )}
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: File Preview Panel */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col min-h-[550px]">
          <div className="p-4 bg-background border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4 text-indigo-400" /> Document Viewer
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              ID: {document.id.slice(0, 8)}
            </span>
          </div>

          <div className="flex-1 bg-background p-4 flex items-center justify-center relative min-h-[450px]">
            {previewUrl ? (
              document.content_type.startsWith("image/") ? (
                <Image
                  src={previewUrl} 
                  alt={document.filename} 
                  width={800}
                  height={600}
                  unoptimized
                  className="max-w-full max-h-[500px] object-contain rounded-lg shadow-md"
                />
              ) : document.content_type === "application/pdf" ? (
                <iframe 
                  src={`${previewUrl}#toolbar=0`} 
                  className="w-full h-[550px] border-0 rounded-lg"
                  title="PDF Document Preview"
                />
              ) : (
                /* Excel / CSV Spreadsheet Empty Preview State */
                <div className="w-full max-w-md p-6 space-y-6 text-center animate-fade-in">
                  <div className="mx-auto w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-inner">
                    <Sparkles className="h-8 w-8 text-indigo-400" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-foreground">Structured Dataset Ingested</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Spreadsheet content was parsed into EVE memory. Direct raw preview is not suited for this viewport, but you can run executive commands below.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <Link
                      href={`/dashboard/eve?document_id=${document.id}&query=summarize+key+trends`}
                      className="flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:border-indigo-500/50 hover:bg-background/80 text-left text-xs font-semibold text-muted-foreground transition-all cursor-pointer"
                    >
                      <span>📊 Summarize Key Trends & Margin Risk</span>
                      <ChevronRight size={14} className="text-indigo-400" />
                    </Link>
                    <Link
                      href={`/dashboard/eve?document_id=${document.id}&query=find+anomalies`}
                      className="flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:border-indigo-500/50 hover:bg-background/80 text-left text-xs font-semibold text-muted-foreground transition-all cursor-pointer"
                    >
                      <span>🔍 Audit Anomalies & Mismatches</span>
                      <ChevronRight size={14} className="text-indigo-400" />
                    </Link>
                    <button 
                      onClick={handleDownload}
                      className="flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:border-indigo-500/50 hover:bg-background/80 text-left text-xs font-semibold text-muted-foreground transition-all"
                    >
                      <span>💾 Export Raw Dataset</span>
                      <Download size={13} className="text-indigo-400" />
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center p-6 space-y-3">
                <Loader2 className="h-10 w-10 mx-auto text-indigo-400 animate-spin" />
                <p className="text-xs text-muted-foreground">Preparing preview stream...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: COO Insights, Extracted Data, and Audit Timeline */}
        <div className="space-y-6">
          {/* COO Executive Insights - Primary Panel */}
          {document.coo_insights ? (
            <div className="bg-gradient-to-br from-indigo-950/20 to-purple-950/20 border border-indigo-900/40 rounded-2xl p-6 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <h3 className="font-extrabold text-base text-indigo-300 flex items-center gap-2 border-b border-indigo-950/40 pb-3">
                <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" /> EVE Executive Insights
              </h3>
              
              {/* Summary */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">Executive Summary</span>
                <p className="text-sm text-foreground leading-relaxed">
                  {typeof document.coo_insights === "string" 
                    ? document.coo_insights 
                    : (document.coo_insights as any).summary || "No summary available."}
                </p>
              </div>

              {/* Risks */}
              {typeof document.coo_insights !== "string" && (document.coo_insights as any).risks && (document.coo_insights as any).risks.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-indigo-950/40">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block">Detected Supply Chain Risks</span>
                  <div className="space-y-2">
                    {(document.coo_insights as any).risks.map((risk: any, i: number) => {
                      const riskDesc = typeof risk === "string" ? risk : risk.description || "";
                      const isStockout = riskDesc.toLowerCase().includes("stockout") || riskDesc.toLowerCase().includes("inventory");
                      return (
                        <div key={i} className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-2 flex flex-col justify-between sm:flex-row sm:items-center sm:gap-4">
                          <p className="text-xs text-rose-200/90 leading-relaxed flex-1">{riskDesc}</p>
                          {isStockout && (
                            <Link href="/dashboard/projects" className="text-[10px] font-bold px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 rounded-lg text-rose-300 transition-all text-center whitespace-nowrap">
                              Initialize Project Run
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Opportunities */}
              {typeof document.coo_insights !== "string" && (document.coo_insights as any).opportunities && (document.coo_insights as any).opportunities.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-indigo-950/40">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">Opportunities & Volume Discounts</span>
                  <div className="space-y-2">
                    {(document.coo_insights as any).opportunities.map((opp: any, i: number) => {
                      const oppDesc = typeof opp === "string" ? opp : opp.description || "";
                      return (
                        <div key={i} className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2 flex flex-col justify-between sm:flex-row sm:items-center sm:gap-4">
                          <p className="text-xs text-foreground leading-relaxed flex-1">{oppDesc}</p>
                          <Link href="/dashboard/eve" className="text-[10px] font-bold px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg text-emerald-700 dark:text-emerald-300 transition-all text-center whitespace-nowrap">
                            Draft Negotiation Prompt
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {typeof document.coo_insights !== "string" && (document.coo_insights as any).recommendations && (document.coo_insights as any).recommendations.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-indigo-950/40">
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest block">Recommended Action Plan</span>
                  <div className="space-y-2">
                    {(document.coo_insights as any).recommendations.map((rec: any, i: number) => {
                      const recDesc = typeof rec === "string" ? rec : rec.description || "";
                      const isPayment = recDesc.toLowerCase().includes("payment") || recDesc.toLowerCase().includes("discount") || recDesc.toLowerCase().includes("inv-");
                      return (
                        <div key={i} className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-2 flex flex-col justify-between sm:flex-row sm:items-center sm:gap-4">
                          <p className="text-xs text-foreground leading-relaxed flex-1">{recDesc}</p>
                          {isPayment ? (
                            <Link href="/dashboard/finance" className="text-[10px] font-bold px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-lg text-indigo-700 dark:text-indigo-300 transition-all text-center whitespace-nowrap">
                              Log Discount Expense
                            </Link>
                          ) : (
                            <Link href="/dashboard/eve" className="text-[10px] font-bold px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-lg text-indigo-700 dark:text-indigo-300 transition-all text-center whitespace-nowrap">
                              Execute via EVE AI
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-5 text-center text-muted-foreground text-sm italic">
              Generating executive COO summary insights...
            </div>
          )}

          {/* Quality Assessment & Validation */}
          {document.quality_assessment && (
            <div className="bg-card backdrop-blur-md border border-border rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Quality Validation
                </h3>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                  Score: {(document.quality_assessment as any).quality_score || 0}%
                </span>
              </div>

              {((document.quality_assessment as any).detected_issues || []).length === 0 ? (
                <div className="p-3 bg-emerald-950/10 border border-emerald-900/20 rounded-xl flex items-center gap-3 text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-semibold">No critical issues or duplicates detected. Schema is clean.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {((document.quality_assessment as any).detected_issues || []).map((issue: any, index: number) => (
                    <div 
                      key={index}
                      className={`p-3 border rounded-xl flex items-start gap-3 text-sm bg-amber-950/20 border-amber-900/30 text-amber-400`}
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-xs uppercase block">{issue.rule_name || "Validation Warning"}</span>
                        <span className="text-xs mt-1 block opacity-90">{issue.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Extracted Key-Value Values */}
          <div className="bg-card backdrop-blur-md border border-border rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-foreground border-b border-border pb-3 flex items-center justify-between">
              Ingested Document Values
            </h3>
            {renderExtractedData(document.extracted_data)}
          </div>

          {/* Processing Status */}
          <div className="bg-card backdrop-blur-md border border-border rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-foreground border-b border-border pb-3">
              Processing Status
            </h3>

            <div className="py-2">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-4 right-4 top-4 h-0.5 bg-secondary -z-10" />
                
                {[
                  { key: "uploaded", label: "Uploaded" },
                  { key: "processing", label: "Processing" },
                  { key: "classified", label: "Classified" },
                  { key: "validated", label: "Validated" },
                  { key: "completed", label: "Completed" }
                ].map((stage, idx) => {
                  const getStepStatus = (stepKey: string) => {
                    if (document.status === "failure") {
                      let failStep = "processing";
                      if (document.document_type) failStep = "classified";
                      if (document.quality_assessment) failStep = "validated";
                      
                      if (stepKey === failStep) return "failed";
                      
                      const stepOrder = ["uploaded", "processing", "classified", "validated", "completed"];
                      if (stepOrder.indexOf(stepKey) < stepOrder.indexOf(failStep)) return "completed";
                      return "upcoming";
                    }

                    if (document.status === "success" && stepKey === "completed") {
                      return "completed";
                    }

                    const stepOrder = ["uploaded", "processing", "classified", "validated", "completed"];
                    const currentIndex = stepOrder.indexOf(document.status);
                    const targetIndex = stepOrder.indexOf(stepKey);

                    if (targetIndex < currentIndex) return "completed";
                    if (targetIndex === currentIndex) return "active";
                    return "upcoming";
                  };

                  const stepStatus = getStepStatus(stage.key);

                  return (
                    <div key={stage.key} className="flex flex-col items-center gap-2 flex-1 relative text-center">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all duration-305 ${
                        stepStatus === "completed"
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                          : stepStatus === "active"
                          ? "bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-300 animate-pulse shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                          : stepStatus === "failed"
                          ? "bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                          : "bg-card border-border text-muted-foreground"
                      }`}>
                        {stepStatus === "completed" ? (
                          <CheckCircle className="h-4.5 w-4.5" />
                        ) : stepStatus === "failed" ? (
                          <XCircle className="h-4.5 w-4.5" />
                        ) : stepStatus === "active" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block ${
 stepStatus === "completed"
 ? "text-emerald-400"
 : stepStatus === "active"
 ? "text-indigo-400"
 : stepStatus === "failed"
 ? "text-rose-400"
 : "text-muted-foreground"
 }`}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {document.status === "failure" && document.error_message && (
              <div className="p-3.5 bg-red-950/20 border border-red-900/30 rounded-xl flex items-start gap-3 mt-4">
                <ShieldAlert className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-red-300">Processing Error</p>
                  <p className="text-sm text-red-400/90 mt-1">Processing anomaly detected. Document could not be fully analyzed.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
