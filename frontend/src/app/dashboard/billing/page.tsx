"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Info,
  Clock,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { logger } from "@/lib/logger";

export default function BillingPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await apiFetch(`${API_BASE_URL}/api/profile/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            setProfile(await res.json());
          }
        }
      } catch (err) {
        logger.error("Failed to load profile for billing page", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-8 font-sans">
      {/* Header */}
      <div className="border-b border-border pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <CreditCard className="h-7 w-7 text-indigo-500" />
            Billing &amp; Account Plan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your current plan status, early access inclusions, and billing commitments.
          </p>
        </div>
        <Link
          href="/pricing"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-border bg-card hover:bg-muted text-foreground transition-all shadow-xs w-fit"
        >
          <span>View Public Pricing Details</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="bg-card rounded-2xl border border-border p-8 h-64 animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-20 bg-muted rounded w-full" />
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Active Plan Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gradient-to-br from-indigo-950/20 via-card to-card border border-indigo-500/30 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Founding Customer Tier</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-foreground pt-1">Early Access Plan</h2>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold w-fit">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Active &amp; Fully Included</span>
                </div>
              </div>

              {/* Inclusions */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Plan Capabilities Included Today</span>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    "Variant-level demand forecasting (size & colour)",
                    "Stockout risk & dead stock capital isolation",
                    "Decision Traceability & evidence audit trails",
                    "CSV ingestion with Shopify auto-mapping",
                    "Unlimited scenario & query analysis with EVE AI",
                    "Read-only store safety guarantee",
                  ].map((inc) => (
                    <div key={inc} className="flex items-start gap-2.5 text-xs text-foreground font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{inc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Early Access Notice */}
              <div className="p-4 rounded-xl bg-card border border-border/80 flex items-start gap-3">
                <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-foreground block">Zero Billing During Early Access</span>
                  <p className="text-muted-foreground leading-relaxed">
                    We are currently working closely with our first cohort of fashion brands to finalize pricing based on real catalogue feedback. As an early user, your access remains 100% active at zero cost.
                  </p>
                </div>
              </div>
            </div>

            {/* Billing Guarantees */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                <div className="flex items-center gap-2 text-indigo-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">Advance Notice</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Before public launch pricing takes effect, you will receive at least <strong>30 days&apos; advance email notice</strong> with founding customer benefits.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                <div className="flex items-center gap-2 text-emerald-500">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">Data Privacy</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your sales and inventory data is encrypted, stored within strict workspace boundaries, and never shared or sold.
                </p>
              </div>
            </div>
          </div>

          {/* Account Details & Support Card */}
          <aside className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Account Summary
              </h3>

              <div className="space-y-3 text-xs divide-y divide-border">
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Account Holder</span>
                  <span className="font-bold text-foreground">{profile?.full_name || "Founder"}</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Email</span>
                  <span className="font-mono text-foreground">{profile?.email || ""}</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Current Status</span>
                  <span className="px-2 py-0.5 rounded font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Early Access</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Monthly Fee</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">$0 / month</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <Link
                  href="/dashboard/settings"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-border bg-secondary hover:bg-muted text-foreground transition-all"
                >
                  Manage Account Settings
                </Link>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Have Questions?</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If you have questions regarding pricing, tier limits, or custom enterprise requirements, contact our founder directly.
              </p>
              <a
                href="mailto:support@eveinventory.in?subject=EVE%20Billing%20Question"
                className="inline-block text-xs font-bold text-[color:var(--eve-accent)] hover:underline pt-1"
              >
                support@eveinventory.in →
              </a>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
