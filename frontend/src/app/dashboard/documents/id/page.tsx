"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Brain, 
  MessageSquare,
  Sparkles,
  ExternalLink,
  Download,
  AlertTriangle,
  Info
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [document, setDocument] = useState<ProcessedDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const loadDocument = async (token: string) => {
    try {
      const data = await getDocumentDetails(docId, token);
      setDocument(data);

      // Fetch the preview as a secure blob with auth headers
      try {
        const blob = await fetchDocumentPreviewBlob(docId, token);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch (err) {
        console.error("Failed to load document preview blob:", err);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load document details.");
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
      setSessionToken(session.access_token);
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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center gap-4 text-slate-100">
        <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
        <p className="text-slate-400 text-sm">Retrieving document intelligence details...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center text-slate-100">
        <XCircle className="h-12 w-12 text-red-500 mb-3" />
        <p className="font-semibold text-lg">Document Not Found</p>
        <Link href="/dashboard/documents" className="mt-4 text-indigo-400 hover:underline flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto text-slate-100">
      {/* Navigation & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/documents"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight max-w-md truncate">{document.filename}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {new Date(document.created_at).toLocaleDateString()}
              </span>
              <span>•</span>
              <span>UUID: {document.id.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {previewUrl && (
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 rounded-xl transition-all"
            >
              <Download className="h-4 w-4" /> Download
            </button>
          )}
          {(document.status === "completed" || document.status === "success") && (
            <Link 
              href={`/dashboard/eve?document_id=${document.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              <MessageSquare className="h-4 w-4" /> Ask EVE About This Document
            </Link>
          )}
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: File Preview Panel */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-300">
              <FileText className="h-4 w-4 text-indigo-400" /> Live Preview
            </h3>
            {document.content_type && (
              <span className="text-xs px-2.5 py-0.5 bg-slate-800 text-slate-400 rounded-full font-mono">
                {document.content_type}
              </span>
            )}
          </div>

          <div className="flex-1 bg-slate-950/60 p-4 flex items-center justify-center relative min-h-[400px]">
            {previewUrl ? (
              document.content_type.startsWith("image/") ? (
                <img 
                  src={previewUrl} 
                  alt={document.filename} 
                  className="max-w-full max-h-[500px] object-contain rounded-lg shadow-md"
                />
              ) : document.content_type === "application/pdf" ? (
                <iframe 
                  src={`${previewUrl}#toolbar=0`} 
                  className="w-full h-[550px] border-0 rounded-lg"
                  title="PDF Document Preview"
                />
              ) : (
                <div className="text-center p-6 space-y-4">
                  <FileText className="h-16 w-16 mx-auto text-slate-700" />
                  <p className="text-sm text-slate-400">Preview not supported directly inside viewer for this file format.</p>
                  <button 
                    onClick={handleDownload}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Download to View
                  </button>
                </div>
              )
            ) : (
              <div className="text-center p-6 space-y-3">
                <Loader2 className="h-10 w-10 mx-auto text-indigo-400 animate-spin" />
                <p className="text-xs text-slate-500">Preparing preview stream...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Extracted Metadata & Analytics */}
        <div className="space-y-6">
          {/* Status & Processing Timeline */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-slate-200 border-b border-slate-800 pb-3">
              Processing Timeline
            </h3>

            {/* Stepper Timeline */}
            <div className="py-2">
              <div className="flex items-center justify-between relative">
                {/* Connecting Line */}
                <div className="absolute left-4 right-4 top-4 h-0.5 bg-slate-800 -z-10" />
                
                {[
                  { key: "uploaded", label: "Uploaded" },
                  { key: "processing", label: "Processing" },
                  { key: "classified", label: "Classified" },
                  { key: "validated", label: "Validated" },
                  { key: "completed", label: "Completed" }
                ].map((stage, idx) => {
                  // Helper logic to find step status
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
                      {/* Step Circle */}
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all duration-305 ${
                        stepStatus === "completed"
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                          : stepStatus === "active"
                            ? "bg-indigo-500/10 border-indigo-500 text-indigo-400 animate-pulse shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                            : stepStatus === "failed"
                              ? "bg-rose-500/10 border-rose-500 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                              : "bg-slate-900 border-slate-800 text-slate-500"
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
                              : "text-slate-500"
                      }`}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {document.status === "failure" && document.error_message && (
              <div className="p-3.5 bg-red-950/20 border border-red-900/30 rounded-xl flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-red-300">Processing Error</p>
                  <p className="text-sm text-red-400/90 mt-1">{document.error_message}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5">
                <span className="text-xs text-slate-500 block">Identified Type</span>
                <span className="text-base font-bold text-slate-200 mt-1 block">
                  {document.document_type || "Classifying..."}
                </span>
              </div>
              <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5">
                <span className="text-xs text-slate-500 block">Confidence Level</span>
                <span className="text-base font-bold text-indigo-400 mt-1 block">
                  {document.classification_confidence 
                    ? `${(document.classification_confidence * 100).toFixed(0)}%` 
                    : "Analyzing..."}
                </span>
              </div>
            </div>
          </div>

          {/* COO Executive Insights */}
          {document.coo_insights && (
            <div className="bg-gradient-to-br from-indigo-950/20 to-purple-950/20 backdrop-blur-md border border-indigo-900/30 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="font-bold text-base text-indigo-300 flex items-center gap-2 border-b border-indigo-950/40 pb-3">
                <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" /> EVE COO Executive Insight
              </h3>
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {typeof document.coo_insights === "string" 
                  ? document.coo_insights 
                  : (document.coo_insights as any).summary || JSON.stringify(document.coo_insights)}
              </div>
            </div>
          )}

          {/* Quality Assessment & Validation */}
          {document.quality_assessment && (
            <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-200 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-emerald-400" /> Quality Assessment
                </h3>
                <span className={`text-sm font-extrabold px-3 py-1 rounded-full ${
                  (document.quality_assessment as any).quality_score >= 80 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                    : (document.quality_assessment as any).quality_score >= 50 
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}>
                  Score: {(document.quality_assessment as any).quality_score || 0}%
                </span>
              </div>

              {/* Anomaly list */}
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
                      className={`p-3 border rounded-xl flex items-start gap-3 text-sm ${
                        issue.severity === "critical" 
                          ? "bg-red-950/20 border-red-900/30 text-red-400" 
                          : "bg-amber-950/20 border-amber-900/30 text-amber-400"
                      }`}
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

          {/* Extracted JSON Fields */}
          {document.extracted_data && (
            <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="font-bold text-base text-slate-200 border-b border-slate-800 pb-3 flex items-center justify-between">
                Extracted Data Values
              </h3>
              
              <div className="bg-slate-950/60 rounded-xl border border-slate-850 p-4 font-mono text-xs text-indigo-300 max-h-[300px] overflow-y-auto">
                <pre>{JSON.stringify(document.extracted_data, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
