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
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Brain
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function DocumentHubPage() {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const loadDocs = async (token: string) => {
    try {
      const data = await listDocuments(token);
      setDocuments(data);
    } catch (err: any) {
      toast.error("Document hub is currently processing updates.");
    }
  };

  useEffect(() => {
    let intervalId: any;
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
        await loadDocs(session.access_token);
        
        // Auto-poll if any document is processing, uploaded, classified, or validated
        intervalId = setInterval(async () => {
          const hasProcessing = documents.some(
            d => d.status !== "completed" && d.status !== "success" && d.status !== "failure"
          );
          if (hasProcessing || documents.length === 0) {
            const data = await listDocuments(session.access_token);
            setDocuments(data);
          }
        }, 5000);
      }
      setLoading(false);
    }
    init();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [router, documents.some(d => d.status !== "completed" && d.status !== "success" && d.status !== "failure")]);

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
    // Limits
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
    } catch (err: any) {
      toast.error(
        <div className="flex flex-col gap-0.5">
          <span>Document processing is currently syncing. Please try again in a moment.</span>
          <span className="text-[10px] text-slate-400 leading-normal">
            Need help? Contact <a href="mailto:aethercorp.support@gmail.com" className="underline text-indigo-450 hover:text-indigo-350">aethercorp.support@gmail.com</a> or use our <a href="https://forms.gle/qETMVJfDzHnF86xi7" target="_blank" rel="noopener noreferrer" className="underline text-indigo-450 hover:text-indigo-350">Feedback Form</a>.
          </span>
        </div>,
        { id: toastId, duration: 8000 }
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
    } catch (err: any) {
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
    <div className="space-y-8 p-6 max-w-7xl mx-auto text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            <Brain className="h-8 w-8 text-indigo-400" /> Unified Document Hub
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Upload company invoices, supplier receipts, and purchase orders. EVE classifies, extracts, and integrates them automatically.
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
 dragActive 
 ? "border-indigo-400 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]" 
 : "border-border bg-card hover:border-foreground/20 hover:bg-muted"
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
            <Loader2 className="h-12 w-12 text-indigo-400 animate-spin" />
            <p className="text-indigo-300 font-semibold text-lg animate-pulse">Uploading file to EVE...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400">
              <UploadCloud className="h-10 w-10" />
            </div>
            <div>
              <p className="text-lg font-bold">Drag and drop file here, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Supported formats: PDF, CSV, XLSX, PNG, JPG, JPEG (Max 10MB)
              </p>
              <p className="text-xs text-indigo-400 mt-2.5 font-medium max-w-md mx-auto">
                Only upload business documents that you are authorized to process.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Documents Table */}
      <div className="bg-card backdrop-blur-md border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-indigo-400" /> Recent Documents
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 bg-muted text-muted-foreground rounded-full">
            {documents.length} Total
          </span>
        </div>

        {loading ? (
          <div className="overflow-x-auto animate-pulse">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <th className="p-4 pl-6">Filename</th>
                  <th className="p-4">Doc Type</th>
                  <th className="p-4">File Size</th>
                  <th className="p-4">Upload Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...Array(3)].map((_, i) => (
                  <tr key={i}>
                    <td className="p-4 pl-6"><div className="h-4 bg-muted rounded w-2/3" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-1/3" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-1/4" /></td>
                    <td className="p-4"><div className="h-4 bg-muted rounded w-1/4" /></td>
                    <td className="p-4"><div className="h-6 bg-muted rounded-full w-16" /></td>
                    <td className="p-4 pr-6 text-right"><div className="h-4 bg-muted rounded w-12 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <File className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-muted-foreground">No documents processed yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Upload an operational file above to begin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <th className="p-4 pl-6">Filename</th>
                  <th className="p-4">Doc Type</th>
                  <th className="p-4">File Size</th>
                  <th className="p-4">Upload Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted transition-colors group">
                    <td className="p-4 pl-6 font-medium text-foreground max-w-xs truncate">
                      {doc.filename}
                    </td>
                    <td className="p-4 text-foreground">
                      {doc.document_type || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {formatBytes(doc.file_size)}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="p-4">
                      {doc.status === "uploaded" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-semibold animate-pulse">
                          Uploaded
                        </span>
                      )}
                      {doc.status === "processing" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-semibold animate-pulse">
                          <Loader2 className="h-3 w-3 animate-spin" /> Processing
                        </span>
                      )}
                      {doc.status === "classified" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-semibold animate-pulse">
                          Classified
                        </span>
                      )}
                      {doc.status === "validated" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-xs font-semibold animate-pulse">
                          Validated
                        </span>
                      )}
                      {(doc.status === "completed" || doc.status === "success") && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-semibold">
                          <CheckCircle className="h-3 w-3" /> Completed
                        </span>
                      )}
                      {doc.status === "failure" && (
                        <span 
                          title="Processing anomaly detected"
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-semibold cursor-help"
                        >
                          <XCircle className="h-3 w-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Link 
                          href={`/dashboard/documents/${doc.id}`}
                          className="p-1.5 bg-card hover:bg-indigo-500/10 text-muted-foreground hover:text-indigo-400 border border-border rounded-lg transition-all"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button 
                          onClick={() => handleDelete(doc.id, doc.filename)}
                          className="p-1.5 bg-card hover:bg-red-500/10 text-muted-foreground hover:text-red-400 border border-border rounded-lg transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
