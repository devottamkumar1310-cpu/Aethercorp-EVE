"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { PRICING, FOUNDING_OFFER, REVENUE_RANGES, POSITIONING } from "@/lib/config";
import { joinWaitlist } from "@/lib/services/waitlistService";
import { track } from "@/lib/analytics";
import { BookDemoButton } from "@/components/marketing/BookDemoButton";
import { StartFreeTrialButton } from "@/components/marketing/StartFreeTrialButton";

export default function PricingPage() {
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [revenueRange, setRevenueRange] = useState("");
  const [challenge, setChallenge] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    track("pricing_viewed");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const result = await joinWaitlist({
        email: email.trim(),
        company_name: companyName.trim() || undefined,
        company_website: companyWebsite.trim() || undefined,
        revenue_range: revenueRange || undefined,
        biggest_inventory_challenge: challenge.trim() || undefined,
      });
      track("waitlist_submitted", {
        revenue_range: revenueRange || "unspecified",
        has_website: Boolean(companyWebsite.trim()),
        status: result.status,
      });
      setAlreadyRegistered(result.status === "already_registered");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* Header */}
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
            <Link href="/login" className="text-xs font-semibold px-4 py-2 rounded-lg text-foreground hover:text-[color:var(--eve-accent)] transition-colors">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* Hero */}
        <section className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-14 sm:pt-20 pb-10 text-center space-y-5">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
            Pricing that fits a{" "}
            <span className="eve-gradient-text">founder-run brand</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {PRICING.trialDays} days free. No credit card. Import your Shopify export and
            see your dead stock and stockout risk before you decide anything.
          </p>
          {FOUNDING_OFFER.enabled && (
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 rounded-xl border border-[color:var(--eve-accent)]/30 bg-[color:var(--eve-accent)]/5 px-4 py-2.5 text-xs">
              <span className="font-bold text-foreground">{FOUNDING_OFFER.headline}</span>
              <span className="text-muted-foreground">{FOUNDING_OFFER.detail}</span>
            </div>
          )}
        </section>

        {/* Plans */}
        <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pb-16">
          <div className="grid gap-6 md:grid-cols-3 items-start">
            {PRICING.plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border bg-card p-6 sm:p-7 shadow-sm flex flex-col h-full ${
                  plan.highlighted
                    ? "border-[color:var(--eve-accent)] shadow-lg md:-translate-y-2"
                    : "border-border"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-md">
                    Most brands start here
                  </div>
                )}

                <div className="space-y-1.5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    {plan.name}
                  </h2>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-foreground">
                      {PRICING.currency}{plan.price}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">{plan.cadence}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pt-1">{plan.blurb}</p>
                </div>

                <ul className="space-y-2.5 py-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-foreground">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-px" aria-hidden />
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Every tier starts the same way. A "Talk to us" tier put the
                    most valuable visitor into a sales queue instead of the
                    product. */}
                <StartFreeTrialButton
                  variant={plan.highlighted ? "primary" : "secondary"}
                  label={plan.cta}
                  location={`pricing_plan_${plan.id}`}
                  className="w-full py-3 text-xs"
                />
              </div>
            ))}
          </div>

          <div className="text-center text-xs text-muted-foreground pt-8 space-y-2">
            <p>
              Every plan starts with the same {PRICING.trialDays}-day trial — one click with
              Google, no credit card, no call. Cancel any time; we don&apos;t ask why, and we
              don&apos;t hold your data hostage.
            </p>
            <p>
              Not sure which tier fits your catalogue?{" "}
              <Link href="/contact" className="font-semibold text-[color:var(--eve-accent)] hover:underline">
                Email us
              </Link>{" "}
              or{" "}
              <BookDemoButton
                variant="ghost"
                location="pricing_plans_footnote"
                label="book 15 minutes with the founder"
                showIcon={false}
                className="text-xs underline underline-offset-2"
              />
              .
            </p>
          </div>
        </section>

        {/* Early access — now actually persisted */}
        <section className="border-t border-border bg-muted/20 py-14 px-4 sm:px-6">
          <div className="max-w-xl mx-auto w-full">
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-lg space-y-6">
              {!submitted ? (
                <>
                  <div className="space-y-2 border-b border-border pb-4">
                    <h2 className="text-lg font-extrabold text-foreground">
                      Not ready to sign up? Get the inventory teardown.
                    </h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Tell us about your brand and we&apos;ll send back a short read on where
                      your inventory is leaking cash — whether or not you ever use EVE.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-xs font-semibold text-foreground mb-1.5">
                        Work email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        required
                        placeholder="founder@yourbrand.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--eve-accent)]/20 focus:border-[color:var(--eve-accent)] transition-all"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="company" className="block text-xs font-semibold text-foreground mb-1.5">
                          Brand name
                        </label>
                        <input
                          type="text"
                          id="company"
                          placeholder="Acme Studios"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--eve-accent)]/20 focus:border-[color:var(--eve-accent)] transition-all"
                        />
                      </div>
                      <div>
                        <label htmlFor="website" className="block text-xs font-semibold text-foreground mb-1.5">
                          Store URL
                        </label>
                        <input
                          type="text"
                          id="website"
                          placeholder="acmestudios.com"
                          value={companyWebsite}
                          onChange={(e) => setCompanyWebsite(e.target.value)}
                          className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--eve-accent)]/20 focus:border-[color:var(--eve-accent)] transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="revenue" className="block text-xs font-semibold text-foreground mb-1.5">
                        Annual revenue
                      </label>
                      <select
                        id="revenue"
                        value={revenueRange}
                        onChange={(e) => setRevenueRange(e.target.value)}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--eve-accent)]/20 focus:border-[color:var(--eve-accent)] transition-all"
                      >
                        <option value="">Prefer not to say</option>
                        {REVENUE_RANGES.map((range) => (
                          <option key={range} value={range}>{range}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="challenge" className="block text-xs font-semibold text-foreground mb-1.5">
                        Biggest inventory headache right now
                      </label>
                      <textarea
                        id="challenge"
                        rows={3}
                        placeholder="We keep selling out of mediums and sitting on XLs…"
                        value={challenge}
                        onChange={(e) => setChallenge(e.target.value)}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--eve-accent)]/20 focus:border-[color:var(--eve-accent)] transition-all resize-y"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 text-primary-foreground font-bold rounded-xl text-sm bg-primary hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Sending…
                        </>
                      ) : (
                        <>
                          Send me the teardown
                          <ArrowRight size={16} aria-hidden />
                        </>
                      )}
                    </button>

                    <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                      One email from a human. No drip sequence, no sharing your data.
                    </p>
                  </form>
                </>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-xl text-center space-y-3">
                  <div className="h-10 w-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold mx-auto">
                    <Check className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    {alreadyRegistered ? "You're already on the list" : "Got it — talk soon"}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    {alreadyRegistered
                      ? "We already have your details. If you haven't heard from us, email us directly and we'll jump the queue."
                      : <>We&apos;ll reply to <strong className="text-foreground">{email}</strong> personally. You don&apos;t have to wait for us, though — the trial is open right now.</>}
                  </p>
                  <div className="pt-2 flex flex-col items-center gap-2">
                    <StartFreeTrialButton
                      label="Start the free trial"
                      location="pricing_post_submit"
                      className="px-5 py-2.5 text-xs"
                    />
                    <BookDemoButton
                      variant="ghost"
                      location="pricing_post_submit"
                      label="Or book 15 minutes with the founder"
                      showIcon={false}
                      className="text-[11px] underline underline-offset-2"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-6 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
              Your data stays in your workspace. EVE&apos;s AI has read-only access.
            </div>
          </div>
        </section>
      </main>

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
