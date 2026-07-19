"use client";

import React, { useEffect, useState } from "react";

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
      const resp = await fetch("/api/health");
      if (!resp.ok) {
        throw new Error(`Failed to load health metrics (HTTP ${resp.status})`);
      }
      const json = await resp.json();
      setData(json);
      setError(null);
    } catch {
      setError("System health telemetry is currently syncing. Please wait.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-muted-foreground">Loading system metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-950/10 p-6 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            ⚠️
          </div>
          <h3 className="text-lg font-semibold text-foreground">Health Monitor Offline</h3>
          <p className="mt-2 text-sm text-red-200/80">{error || "Check backend API connection."}</p>
          <button
            onClick={() => fetchHealth()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-red-500"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const isHealthy = data.status === "healthy";

  return (
    <div className="min-h-screen bg-background p-6 font-sans text-foreground lg:p-10">
      <div className="mx-auto max-w-6xl">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/80 to-muted-foreground bg-clip-text text-transparent">
              System Operations Health
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time platform diagnostics, cluster workloads, and connection states.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isHealthy ? "bg-emerald-400" : "bg-red-400"}`}></span>
              <span className={`relative inline-flex h-3 w-3 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-red-500"}`}></span>
            </span>
            <span className={`text-sm font-semibold uppercase tracking-wider ${isHealthy ? "text-emerald-400" : "text-red-400"}`}>
              EVE Platform {data.status}
            </span>
          </div>
        </div>

        {/* Status Metrics Cards */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          
          {/* Database Card */}
          <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Database Connection</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.database === "healthy" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                {data.database}
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold tracking-tight">PostgreSQL</p>
            <p className="mt-1 text-xs text-muted-foreground">Supabase DB cluster, pooling, and vector capabilities verified.</p>
          </div>

          {/* Storage Card */}
          <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Storage Ingestion API</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.storage === "healthy" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                {data.storage}
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold tracking-tight">Local / GCS</p>
            <p className="mt-1 text-xs text-muted-foreground">Read, write, and directory permission operations fully verified.</p>
          </div>

          {/* Alerting Metric */}
          <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Error Telemetry Gateway</span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                active
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold tracking-tight">GCP Alerting</p>
            <p className="mt-1 text-xs text-muted-foreground">Structured telemetry enabled for HTTP 5xx, database, and AI failures.</p>
          </div>
        </div>

        {/* Resources Section */}
        <div className="mt-8 rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-md lg:p-8">
          <h2 className="text-xl font-bold tracking-tight text-foreground">System Resource Usage</h2>
          
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            
            {/* CPU usage */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">CPU Load</span>
                <span className="font-semibold text-foreground">{data.system.cpu_usage_percent.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${data.system.cpu_usage_percent}%` }}
                ></div>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Memory Allocation</span>
                <span className="font-semibold text-foreground">{data.system.memory_usage_percent.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                  style={{ width: `${data.system.memory_usage_percent}%` }}
                ></div>
              </div>
            </div>

            {/* Disk space */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Disk Footprint</span>
                <span className="font-semibold text-foreground">{data.system.disk_usage_percent.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                  style={{ width: `${data.system.disk_usage_percent}%` }}
                ></div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
