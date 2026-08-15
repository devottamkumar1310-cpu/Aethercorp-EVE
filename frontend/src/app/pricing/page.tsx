"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertTriangle, Sparkles, ArrowRight } from "lucide-react";
import { POSITIONING, PRICING, PLAN_MARKETING } from "@/lib/config";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { fetchPlans, startCheckout, PlanInfo } from "@/services/billingService";
import { logger } from "@/lib/logger";

type Interval = "month" | "year";

function formatLimit(plan: PlanInfo, key: "max_shopify_stores" | "max_skus"): string {
  const value = plan[key];
  if (value === null) return "Unlimited";
  return value.toLocaleString();
}

export default function PricingPage() {
  const [plans, setPlans] = useState<PlanInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>("month");
  const [authenticated, setAuthenticated] = useState(false);
  const [startingPlan, setStartingPlan] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    track("pricing_viewed");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPlans()
      .then((data) => {
        if (!cancelled) setPlans(data);
      })
      .catch((err) => {
        logger.error("Failed to load plans", err);
        if (!cancelled) setLoadError("Could not load pricing right now. Please try again shortly.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await createClient().auth.getSession();
      if (!cancelled) setAuthenticated(Boolean(data.session));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectPlan = async (planKey: string) => {
    track("pricing_plan_selected", { plan: planKey, interval });
    setActionError(null);

    if (!authenticated) {
      router.push(`/signup?plan=${planKey}&interval=${interval}`);
      return;
    }

    const workspaceId = typeof window !== "undefined"
      ? localStorage.getItem("active_workspace_id")
      : null;
    if (!workspaceId) {
      router.push("/onboarding");
      return;
    }

    setStartingPlan(planKey);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const token = session?.access_token;
      if (!token) {
        router.push("/login");
        return;
      }
      const checkoutUrl = await startCheckout(token, planKey, interval);
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setActionError(err.message || "Could not start checkout. Please try again.");
      setStartingPlan(null);
    }
  };

  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* Header Navigation */}
      <header className="w-full border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 rounded-xl" aria-label="EVE home">
            <div className="h-9 w-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-md shadow-violet-600/25">
              EVE
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-foreground">EVE</span>
              <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
                {POSITIONING.tagline}
              </span>
            </div>
          </Link>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-8 text-xs font-semibold text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/demo" className="hover:text-foreground transition-colors">Live Demo</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </nav>

          <div className="flex items-center gap-3">
            {authenticated ? (
              <Link
                href="/dashboard"
                className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-xs font-semibold px-4 py-2 rounded-lg text-foreground hover:text-[color:var(--eve-accent)] transition-colors">
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm"
                >
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full py-14 sm:py-20">
        {/* Headline */}
        <section className="max-w-4xl mx-auto w-full px-4 sm:px-6 text-center space-y-5 mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-semibold tracking-wide">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{PRICING.trialCopy}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            {PRICING.headline}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {PRICING.subheadline}
          </p>

          {/* Monthly / Annual toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary border border-border">
            {(["month", "year"] as Interval[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setInterval(opt)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  interval === opt
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt === "month" ? "Monthly" : "Annual — 2 months free"}
              </button>
            ))}
          </div>
        </section>

        {loadError && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 mb-8">
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
              <span>{loadError}</span>
            </div>
          </div>
        )}

        {actionError && (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 mb-8">
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
              <span>{actionError}</span>
            </div>
          </div>
        )}

        {/* Plan cards */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6">
          {!plans ? (
            <div className="grid gap-6 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-6 h-96 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3 items-stretch">
              {plans.map((plan) => {
                const marketing = PLAN_MARKETING[plan.key] || { tagline: plan.name, forWhom: "" };
                const price = interval === "month" ? plan.monthly_price : plan.annual_price;
                const perMonthEquivalent = interval === "year" ? Math.round(plan.annual_price / 12) : null;
                const isPopular = Boolean(marketing.popular);

                return (
                  <div
                    key={plan.key}
                    className={`relative flex flex-col bg-card border rounded-2xl p-6 sm:p-7 shadow-sm transition-all ${
                      isPopular ? "border-[color:var(--eve-accent)] ring-1 ring-[color:var(--eve-accent)]/40 shadow-lg" : "border-border"
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[color:var(--eve-accent)] text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                        Most Popular
                      </span>
                    )}

                    <div className="space-y-1.5 mb-5">
                      <h2 className="text-xl font-extrabold text-foreground">{plan.name}</h2>
                      <p className="text-sm font-semibold text-[color:var(--eve-accent)]">{marketing.tagline}</p>
                      <p className="text-xs text-muted-foreground">{marketing.forWhom}</p>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-extrabold text-foreground tabular-nums">
                          ${interval === "month" ? price : perMonthEquivalent}
                        </span>
                        <span className="text-sm text-muted-foreground font-medium">/month</span>
                      </div>
                      {interval === "year" ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          ${plan.annual_price.toLocaleString()} billed annually · save ${plan.annual_savings.toLocaleString()}/yr
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">billed monthly</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectPlan(plan.key)}
                      disabled={startingPlan === plan.key}
                      className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all mb-6 cursor-pointer disabled:opacity-60 ${
                        isPopular
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                          : "bg-secondary text-foreground hover:bg-muted border border-border"
                      }`}
                    >
                      {startingPlan === plan.key ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <>
                          Start Free Trial
                          <ArrowRight size={14} aria-hidden />
                        </>
                      )}
                    </button>

                    <dl className="grid grid-cols-2 gap-2 text-xs mb-6 pb-6 border-b border-border/70">
                      <div>
                        <dt className="text-muted-foreground">Shopify stores</dt>
                        <dd className="font-bold text-foreground">{formatLimit(plan, "max_shopify_stores")}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">SKU limit</dt>
                        <dd className="font-bold text-foreground">{formatLimit(plan, "max_skus")}</dd>
                      </div>
                    </dl>

                    <ul className="space-y-2.5 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-xs text-foreground">
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" aria-hidden />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-10">
            {PRICING.trialCopy} No permanent free tier — every workspace runs on a real plan.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full bg-background border-t border-border px-4 sm:px-6 py-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} {POSITIONING.legalName} All rights reserved.</div>
          <div className="flex flex-wrap justify-center gap-6 font-medium">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/demo" className="hover:text-foreground transition-colors">Live Demo</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
