"use client";

import React, { useState } from "react";
import { AlertOctagon, RefreshCw, ChevronDown, ChevronUp, Server, ShieldAlert } from "lucide-react";

interface OwnerErrorStateProps {
  error: string;
  endpoint?: string;
  lastSuccessTime?: string | null;
  onRetry: () => void;
  retrying?: boolean;
}

export const OwnerErrorState: React.FC<OwnerErrorStateProps> = ({
  error,
  endpoint = "/api/internal/overview",
  lastSuccessTime,
  onRetry,
  retrying = false,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Human-readable explanation builder based on error signature
  let humanMessage = "The Owner Analytics service encountered a connection issue while requesting live platform telemetry.";
  if (error.includes("403") || error.includes("Access Denied")) {
    humanMessage = "Your account does not have owner privileges for this environment, or your session has expired.";
  } else if (error.includes("Failed to fetch") || error.includes("NetworkError")) {
    humanMessage = "Unable to establish an HTTPS connection to the Cloud Run backend service. Check network connectivity or CORS origin settings.";
  }

  return (
    <div className="rounded-3xl border border-rose-500/30 bg-slate-900/90 p-8 backdrop-blur-2xl shadow-2xl shadow-rose-950/20 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start space-x-4">
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shrink-0">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Telemetry Connection Interrupted
            </h3>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400">
              HTTP Service Error
            </span>
          </div>
          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            {humanMessage}
          </p>
        </div>
      </div>

      {/* Control Buttons & Last Refresh Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-slate-800/80">
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <Server className="h-4 w-4 text-slate-500" />
          <span>Last successful sync: {lastSuccessTime ? new Date(lastSuccessTime).toLocaleTimeString() : "None in current session"}</span>
        </div>

        <div className="flex items-center space-x-3 self-end sm:self-auto">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showTechnicalDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Diagnostic Details
          </button>

          <button
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-mono text-xs font-bold transition-all shadow-lg shadow-amber-500/10"
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Re-establishing..." : "Retry Connection"}
          </button>
        </div>
      </div>

      {/* Collapsible Technical Details (Owner Diagnostic View) */}
      {showTechnicalDetails && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 space-y-2 text-xs font-mono text-slate-400">
          <div className="flex justify-between border-b border-slate-800/60 pb-2">
            <span className="text-slate-500">Target Endpoint:</span>
            <span className="text-amber-400 font-semibold">{endpoint}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/60 pb-2">
            <span className="text-slate-500">Exception Signature:</span>
            <span className="text-rose-400">{error}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Required Authorization:</span>
            <span className="text-slate-300">Bearer &lt;Supabase JWT&gt; (Owner: devottamkumar1310@gmail.com)</span>
          </div>
        </div>
      )}
    </div>
  );
};
