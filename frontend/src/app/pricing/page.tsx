"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";
import { REVENUE_RANGES, POSITIONING } from "@/lib/config";
import { joinWaitlist } from "@/lib/services/waitlistService";
import { track } from "@/lib/analytics";

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
            <Link href="/login" className="text-xs font-semibold px-4 py-2 rounded-lg text-foreground hover:text-[color:var(--eve-accent)] transition-colors">
              Sign In
            </Link>
            <Link
              href="/demo"
              className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              Explore Demo
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col justify-center py-12 sm:py-20">
        {/* Waitlist Section */}
        <section className="max-w-4xl mx-auto w-full px-4 sm:px-6 text-center space-y-8">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-semibold tracking-wide">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Early Access</span>
          </div>

          {/* Headlines & Copy */}
          <div className="space-y-4 max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
              Pricing Coming Soon
            </h1>
            <p className="text-lg sm:text-xl text-foreground/90 font-medium leading-relaxed max-w-2xl mx-auto">
              We&apos;re working closely with our first group of fashion brands to finalize pricing based on real customer feedback.
            </p>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Join the waitlist to get early access, founding customer benefits, and be the first to know when pricing is announced.
            </p>
          </div>

          {/* Form Card */}
          <div className="max-w-xl mx-auto text-left pt-2">
            <div className="bg-card border border-border/80 shadow-xl rounded-2xl p-6 sm:p-8 space-y-6 backdrop-blur-sm">
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                      <span>{error}</span>
                    </div>
                  )}

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

                  {/* Primary CTA */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 text-primary-foreground font-bold rounded-xl text-sm bg-primary hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Submitting…
                      </>
                    ) : (
                      <>
                        Join the Waitlist
                        <ArrowRight size={16} aria-hidden />
                      </>
                    )}
                  </button>

                  {/* Secondary Text */}
                  <p className="text-xs text-muted-foreground text-center font-medium pt-1">
                    No credit card required.
                  </p>
                </form>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-xl text-center space-y-4">
                  <div className="h-12 w-12 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold mx-auto shadow-md">
                    <Check className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="text-base font-extrabold text-foreground">
                    {alreadyRegistered ? "You're already on the list!" : "You're on the waitlist!"}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    {alreadyRegistered
                      ? "We have your details. We will notify you as soon as pricing is announced and early access spots open."
                      : <>Thank you for joining. We will reach out to <strong className="text-foreground">{email}</strong> with founding customer benefits and pricing updates.</>}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground pt-1">
                    No credit card required.
                  </p>
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
