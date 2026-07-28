"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ownerAnalyticsService } from "@/services/ownerAnalyticsService";
import { Shield, Lock, ArrowLeft } from "lucide-react";

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

  // Loading privilege verification state (Forced Light Theme)
  if (authorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-900">
        <div className="text-center space-y-4">
          <div className="relative inline-flex p-4 rounded-2xl bg-amber-100/60 border border-amber-300/60 text-amber-700 shadow-sm">
            <Shield className="h-8 w-8 animate-pulse" />
          </div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest font-semibold">
            Verifying Owner & Admin Credentials...
          </p>
        </div>
      </div>
    );
  }

  // Unauthorized state (Forced Light Theme)
  if (authorized === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-900 font-sans">
        <div className="max-w-md w-full rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-xl space-y-6">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">403 Forbidden - Access Denied</h2>
            <p className="mt-2 text-xs text-slate-600 font-mono">
              {authError || "This internal Owner Analytics Dashboard is restricted to owner accounts only."}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-500 font-mono">
            Redirecting to customer dashboard in 2 seconds...
          </div>
        </div>
      </div>
    );
  }

  // Executive Light Theme Layout (Forced Light Theme Mode for /owner)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-amber-100 selection:text-amber-900 antialiased">
      {/* Top Executive Navigation Header (Light Mode) */}
      <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 shadow-xs">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 tracking-tight text-base">EVE</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase bg-amber-100/80 text-amber-900 border border-amber-300/70">
                  Owner Telemetry
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">Internal Platform Analytics & System Health Monitor</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>LIVE ADMIN SESSION</span>
            </div>

            <button
              onClick={() => router.push("/dashboard/inventory")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all shadow-2xs hover:shadow-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Exit to App
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {children}
      </main>
    </div>
  );
}
