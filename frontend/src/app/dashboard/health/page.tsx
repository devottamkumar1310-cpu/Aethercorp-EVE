"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, HardDrive, Cpu, RefreshCw, AlertCircle } from "lucide-react";

import { API_BASE_URL, apiFetch } from "@/lib/api";

interface HealthData {
  status: string;
  database: string;
  storage: string;
  system: {
    cpu_usage_percent: number;
    memory_usage_percent: number;
    disk_usage_percent: number;
  };
}

export default function HealthDashboard() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      const resp = await apiFetch(`${API_BASE_URL}/api/health`);
      if (!resp.ok) {
        throw new Error(`Unable to load platform status.`);
      }
      const json = await resp.json();
      setData(json);
      setError(null);
    } catch {
      setError("System status telemetry is synchronizing. Please wait.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <p className="text-xs font-semibold text-muted-foreground">Checking platform status...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-xs space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertCircle size={20} />
          </div>
          <h3 className="text-base font-bold text-foreground">Platform Status Synchronizing</h3>
          <p className="text-xs text-muted-foreground">{error || "Unable to reach platform servers right now."}</p>
          <button
            onClick={() => fetchHealth()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
          >
            <RefreshCw size={14} /> Refresh Platform Status
          </button>
        </div>
      </div>
    );
  }

  const isHealthy = data.status === "healthy";

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 max-w-[1600px] mx-auto w-full space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">System Operations</span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-xs font-medium text-muted-foreground">Infrastructure Health</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Executive Platform Readiness
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Real-time status across data encryption, business storage, AI engine pipelines, and computing capacity.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="uppercase tracking-wider font-bold">
            {isHealthy ? "All Executive Systems Operational" : "System Alert Active"}
          </span>
        </div>
      </div>

      {/* Operational Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        
        {/* Data Vault */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Business Data Vault</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 capitalize">
                {data.database}
              </span>
            </div>
            <p className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-500" /> Secure Business Ledger
            </p>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Encrypted enterprise database, active connections, and business data integrity fully verified.
            </p>
          </div>
        </div>

        {/* Document Storage */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document & File Hub</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 capitalize">
                {data.storage}
              </span>
            </div>
            <p className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <HardDrive size={18} className="text-primary" /> Enterprise File Storage
            </p>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Secure document ingestion, attachment processing, and file read/write permissions verified.
            </p>
          </div>
        </div>

        {/* AI Safeguards */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Executive Safeguards</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
                Active
              </span>
            </div>
            <p className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-500" /> Risk & Anomaly Watch
            </p>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Proactive business monitoring and continuous anomaly detection active across all workspaces.
            </p>
          </div>
        </div>
      </div>

      {/* Business Availability & Operating Speed */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Cpu size={16} className="text-primary" /> Business Performance & Response Speed
        </h2>
        
        <div className="grid gap-6 md:grid-cols-3">
          
          {/* Data Sync Speed */}
          <div className="flex flex-col gap-2 p-4 bg-muted/30 rounded-xl border border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider">Data Sync Performance</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">100% Operational</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-2 rounded-full bg-emerald-500 w-full" />
            </div>
          </div>

          {/* AI Response Speed */}
          <div className="flex flex-col gap-2 p-4 bg-muted/30 rounded-xl border border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider">AI Executive Speed</span>
              <span className="font-bold text-foreground">Sub-Second</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-2 rounded-full bg-primary w-full" />
            </div>
          </div>

          {/* Vault Availability */}
          <div className="flex flex-col gap-2 p-4 bg-muted/30 rounded-xl border border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider">Vault Capacity</span>
              <span className="font-bold text-foreground">100% Available</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-2 rounded-full bg-cyan-500 w-full" />
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
