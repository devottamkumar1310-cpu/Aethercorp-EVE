"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import {
  BillingStatus,
  fetchBillingStatus,
  openBillingPortal,
} from "@/services/billingService";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return "—";
  }
}

function daysRemaining(value: string | null): number | null {
  if (!value) return null;
  const diffMs = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const checkoutResult = searchParams.get("checkout");

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) return;
      const data = await fetchBillingStatus(session.access_token);
      setStatus(data);
    } catch (err) {
      logger.error("Failed to load billing status", err);
      setLoadError("Could not load your billing status right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenPortal = async () => {
    setPortalError(null);
    setPortalLoading(true);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) return;
      const url = await openBillingPortal(session.access_token);
      window.location.href = url;
    } catch (err: any) {
      setPortalError(err.message || "Could not open the billing portal.");
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-8 animate-pulse">
        <div className="h-10 bg-muted rounded w-1/3" />
        <div className="bg-card rounded-2xl border border-border h-64" />
      </main>
    );
  }

  const trialDays = status ? daysRemaining(status.trial_ends_at) : null;
  const isTrial = status?.source === "trial";
  const isFounder = status?.source === "founder";
  const isPaid = status?.source === "stripe";

  return (
    <div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-8 font-sans">
      <div className="border-b border-border pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <CreditCard className="h-7 w-7 text-indigo-500" />
            Billing &amp; Plan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your workspace&apos;s current plan, subscription status, and billing management.
          </p>
        </div>
        <Link
          href="/pricing"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-border bg-card hover:bg-muted text-foreground transition-all shadow-xs w-fit"
        >
          <span>Compare All Plans</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {checkoutResult === "success" && (
        <div className="flex items-start gap-2.5 text-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl px-4 py-3">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Subscription confirmed. It may take a few seconds to appear below — refresh if needed.</span>
        </div>
      )}
      {checkoutResult === "canceled" && (
        <div className="flex items-start gap-2.5 text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Checkout was canceled. Your plan is unchanged.</span>
        </div>
      )}
      {loadError && (
        <div className="flex items-start gap-2.5 text-sm bg-rose-500/10 text-rose-700 dark:text-rose-400 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}
      {portalError && (
        <div className="flex items-start gap-2.5 text-sm bg-rose-500/10 text-rose-700 dark:text-rose-400 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{portalError}</span>
        </div>
      )}

      {status && (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Active Plan Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gradient-to-br from-indigo-950/20 via-card to-card border border-indigo-500/30 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{isFounder ? "Founder Access" : isTrial ? "Free Trial" : status.plan.name}</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-foreground pt-1">{status.plan.name} Plan</h2>
                </div>
                <div
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold w-fit ${
                    status.active
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{status.active ? "Active" : "Inactive"}</span>
                </div>
              </div>

              {isTrial && trialDays !== null && (
                <div className="p-4 rounded-xl bg-card border border-border/80 flex items-start gap-3">
                  <Clock className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-foreground block">
                      {trialDays} {trialDays === 1 ? "day" : "days"} left in your free trial
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      Trial ends {formatDate(status.trial_ends_at)}. Subscribe any time to keep EVE running without interruption.
                    </p>
                  </div>
                </div>
              )}

              {isPaid && status.cancel_at_period_end && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-foreground block">Subscription ending</span>
                    <p className="text-muted-foreground leading-relaxed">
                      Your plan will not renew and access ends on {formatDate(status.current_period_end)}.
                      Your workspace and data stay intact — reopen billing to resume any time.
                    </p>
                  </div>
                </div>
              )}

              {isPaid && !status.cancel_at_period_end && (
                <div className="p-4 rounded-xl bg-card border border-border/80 flex items-start gap-3">
                  <Clock className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-foreground block">
                      Renews {formatDate(status.current_period_end)}
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      Billed {status.billing_interval === "year" ? "annually" : "monthly"}.
                    </p>
                  </div>
                </div>
              )}

              {!status.active && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-foreground block">Subscription required</span>
                    <p className="text-muted-foreground leading-relaxed">
                      Your trial has ended and no active subscription was found. Subscribe to
                      reconnect Shopify, use Telegram/WhatsApp, and continue getting EVE analysis.
                    </p>
                  </div>
                </div>
              )}

              {/* Inclusions */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  What&apos;s included
                </span>
                <div className="grid sm:grid-cols-2 gap-3">
                  {status.plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5 text-xs text-foreground font-medium">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {!isFounder && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleOpenPortal}
                  disabled={portalLoading || (!isPaid && !isTrial)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  {isPaid ? "Manage Billing" : "Upgrade Plan"}
                </button>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border border-border bg-card hover:bg-muted text-foreground transition-all"
                >
                  View Plans
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}

            {!status.configured && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Billing is not fully configured on this deployment yet. Contact support if
                  Manage Billing / Upgrade doesn&apos;t open.
                </p>
              </div>
            )}
          </div>

          {/* Plan limits sidebar */}
          <aside className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Plan Limits
              </h3>
              <div className="space-y-3 text-xs divide-y divide-border">
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Shopify stores</span>
                  <span className="font-bold text-foreground">{status.plan.max_shopify_stores}</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">SKU limit</span>
                  <span className="font-bold text-foreground">
                    {status.plan.max_skus === null ? "Unlimited" : status.plan.max_skus.toLocaleString()}
                  </span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Telegram</span>
                  <span className="font-bold text-foreground">{status.plan.telegram ? "Included" : "Not included"}</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">WhatsApp</span>
                  <span className="font-bold text-foreground">{status.plan.whatsapp ? "Included" : "Not included"}</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Sync frequency</span>
                  <span className="font-bold text-foreground">{status.plan.hourly_sync ? "Hourly" : "Standard"}</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Support</span>
                  <span className="font-bold text-foreground capitalize">{status.plan.support_level}</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Have Questions?</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Questions about plans, limits, or billing? Contact our founder directly.
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
