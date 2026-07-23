"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { listDocuments, uploadDocument, deleteDocument } from "@/services/documentService";
import { ProcessedDocument } from "@/types/document";
import { 
  FileText, 
  UploadCloud, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  File, 
  Eye, 
  Brain,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function DocumentHubPage() {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pollTrigger, setPollTrigger] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const shouldPoll = (items: ProcessedDocument[]) =>
      items.length === 0 ||
      items.some(
        (d) => d.status !== "completed" && d.status !== "success" && d.status !== "failure"
      );

    const schedulePoll = (token: string, delay = 5000) => {
      timeoutId = setTimeout(async () => {
        if (cancelled) return;
        try {
          const data = await listDocuments(token);
          if (cancelled) return;
          setDocuments(data);
          if (shouldPoll(data)) {
            schedulePoll(token);
          }
        } catch {
          if (!cancelled) {
            schedulePoll(token);
          }
        }
      }, delay);
    };

    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setSessionToken(session.access_token);
      
      const activeWorkspace = localStorage.getItem("active_workspace_id");
      if (activeWorkspace) {
        try {
          const data = await listDocuments(session.access_token);
          if (!cancelled) {
            setDocuments(data);
            if (shouldPoll(data)) {
              schedulePoll(session.access_token);
            }
          }
        } catch {
          if (!cancelled) {
            toast.error("Document hub is currently processing updates.");
          }
        }
      }
      if (!cancelled) setLoading(false);
    }
    init();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [router, pollTrigger]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processUpload(e.target.files[0]);
    }
  };

  const processUpload = async (file: File) => {
    const allowedExtensions = [".pdf", ".csv", ".xlsx", ".png", ".jpg", ".jpeg"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      toast.error(`Invalid file format '${ext}'. Allowed types: PDF, CSV, XLSX, PNG, JPG`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit.");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const newDoc = await uploadDocument(file, sessionToken);
      toast.success(`${file.name} uploaded successfully. EVE is analyzing it.`, { id: toastId });
      setDocuments(prev => [newDoc, ...prev]);
      setPollTrigger((value) => value + 1);
    } catch {
      toast.error(
        <div className="flex flex-col gap-0.5">
          <span>Document processing is currently syncing. Please try again in a moment.</span>
        </div>,
        { id: toastId, duration: 5000 }
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;
    try {
      await deleteDocument(docId, sessionToken);
      toast.success("Document deleted.");
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch {
      toast.error("Document deletion is currently synchronizing. Please try again.");
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 max-w-[1600px] mx-auto w-full space-y-8 transition-colors duration-200 text-foreground">
      
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Intelligence Hub</span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-xs font-medium text-muted-foreground">Business Vault</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5 text-foreground">
            <Brain className="h-7 w-7 text-primary" /> Document Hub
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Central repository for Inventory CSVs, Supplier Invoices, Purchase Orders, and Reports. EVE extracts structured metrics automatically into Decision Traceability.
          </p>
        </div>
      </div>

      {/* Ingestion Dropzone */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 md:p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
          dragActive 
            ? "border-primary bg-primary/10 shadow-lg scale-[1.005]" 
            : "border-border bg-card hover:border-primary/40 hover:bg-muted/50 shadow-xs"
        }`}
      >
        <input 
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          accept=".pdf,.csv,.xlsx,.png,.jpg,.jpeg"
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-foreground font-semibold text-base animate-pulse font-sans">Processing document into operational memory...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 text-primary">
              <UploadCloud className="h-10 w-10" />
            </div>
            <div>
              <p className="text-base md:text-lg font-bold text-foreground">Drag and drop business documents here, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: Inventory CSV, Supplier Invoices (PDF), Purchase Orders, Financial Reports (Max 10MB)
              </p>
              <p className="text-[11px] text-primary mt-2 font-semibold uppercase tracking-wider">
                Automated Categorization & Decision Engine Integration
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Documents Category Filtering Bar */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {["Recent Uploads", "Inventory CSV", "Supplier Invoices", "Purchase Orders", "Reports"].map((cat, idx) => (
            <span
              key={cat}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                idx === 0
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
            </span>
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-mono">5 Category Views</span>
      </div>

      {/* Documents Registry Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-border bg-muted/30 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Document Vault Registry
            </h2>
            <p className="text-xs text-muted-foreground">List of all ingested business records and extracted intelligence status</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-muted text-foreground border border-border rounded-full">
            {documents.length} Records Ingested
          </span>
        </div>

        {loading ? (
          <div className="overflow-x-auto animate-pulse p-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded-lg w-full" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-4 max-w-md mx-auto">
            <File className="h-10 w-10 mx-auto text-primary/60" />
            <div>
              <p className="font-bold text-sm text-foreground">No business documents ingested yet</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Upload supplier invoices, purchase orders, or inventory CSVs to begin automated AI extraction and financial reconciliation.
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
            >
              <Upload size={14} /> Upload First Document
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="border-b border-border bg-muted/20 text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Document Name</th>
                  <th className="px-5 py-3.5 font-semibold">Doc Type</th>
                  <th className="px-5 py-3.5 font-semibold">File Size</th>
                  <th className="px-5 py-3.5 font-semibold">Ingestion Date</th>
                  <th className="px-5 py-3.5 font-semibold">AI Extraction Status</th>
                  <th className="px-5 py-3.5 font-semibold">Connected Workspace</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => {
                  const isCsv = doc.filename?.toLowerCase().endsWith(".csv");
                  const targetHref = isCsv ? "/dashboard/inventory" : "/dashboard/finance";
                  const targetLabel = isCsv ? "Inventory Intelligence →" : "Financial Intelligence →";

                  return (
                    <tr key={doc.id} className="hover:bg-muted/40 transition-colors group">
                      <td className="px-5 py-4 font-semibold text-foreground max-w-xs truncate">
                        {doc.filename}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground font-medium">
                        {doc.document_type ? (
                          <span className="capitalize">{doc.document_type}</span>
                        ) : (
                          <span className="text-muted-foreground/50">Standard</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground font-mono text-xs">
                        {formatBytes(doc.file_size)}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground font-medium">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {doc.status === "completed" || doc.status === "success" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="h-3 w-3 text-emerald-500" /> Complete
                          </span>
                        ) : doc.status === "failure" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <XCircle className="h-3 w-3 text-rose-500" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin text-amber-500" /> Extracting...
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Link href={targetHref} className="text-xs font-semibold text-primary hover:underline">
                          {targetLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {doc.id && (
                            <Link 
                              href={`/dashboard/documents/${doc.id}`}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                              title="View Extracted Insights"
                            >
                              <Eye size={15} />
                            </Link>
                          )}
                          <button 
                            onClick={() => handleDelete(doc.id, doc.filename)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Document"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
