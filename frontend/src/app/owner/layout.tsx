"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ownerAnalyticsService } from "@/services/ownerAnalyticsService";
import { Shield, ShieldAlert, LogOut, RefreshCw, BarChart3, Lock } from "lucide-react";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    async function checkOwnerAuth() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        if (!token) {
          router.replace("/login");
          return;
        }

        // Validate admin status against backend /api/internal/overview
        await ownerAnalyticsService.getOverview(token);
        setAuthorized(true);
      } catch (err: any) {
        console.error("[OWNER SECURITY GUARD] Access rejected:", err);
        setAuthError(err.message || "Access denied. Owner privileges required.");
        setAuthorized(false);
        // Automatically redirect unauthorized users away after 2.5s
        setTimeout(() => {
          router.replace("/dashboard/inventory");
        }, 2500);
      }
    }

    checkOwnerAuth();
  }, [router]);

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="relative inline-flex p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Shield className="h-8 w-8 animate-pulse" />
          </div>
          <p className="text-sm font-mono text-slate-400 uppercase tracking-widest">
            Verifying Owner & Admin Privileges...
          </p>
        </div>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-slate-900/90 p-8 text-center backdrop-blur-xl shadow-2xl space-y-6">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">403 Forbidden - Access Denied</h2>
            <p className="mt-2 text-xs text-slate-400 font-mono">
              {authError || "This internal Owner Analytics Dashboard is restricted to owner and admin accounts only."}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 font-mono">
            Redirecting to customer dashboard in 2 seconds...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500/30">
      {/* Top Owner Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white tracking-tight">EVE</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Owner Telemetry
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">Internal Platform Analytics & System Monitor</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE ADMIN SESSION</span>
            </div>

            <button
              onClick={() => router.push("/dashboard/inventory")}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors"
            >
              Exit to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Owner Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {children}
      </main>
    </div>
  );
}

function Router() {
  return useRouter();
}
