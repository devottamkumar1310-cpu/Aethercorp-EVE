"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles, CheckCircle2 } from "lucide-react";

export default function PricingPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setSubmitted(true);
      setLoading(false);
    }, 800);
  };

  return (
    <div data-theme="executive-light" className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* Header Navigation */}
      <header className="w-full border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 rounded-xl" aria-label="EVE home">
            <div className="h-9 w-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-md shadow-violet-600/25">
              EVE
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-1.5">
                EVE
                <span className="chip chip-accent text-[10px] font-semibold px-2 py-0.5">Pricing & Access</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">Executive Operating System</span>
            </div>
          </Link>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-8 text-xs font-semibold text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/demo" className="hover:text-foreground transition-colors">Live Demo</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-xs font-semibold px-4 py-2 rounded-lg text-foreground hover:text-indigo-600 transition-colors">
              Sign In
            </Link>
            <Link 
              href="/signup" 
              className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-20 flex flex-col justify-center items-center text-center space-y-10">
        {/* Badge */}
        <div className="chip-accent inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          <span>EVE Private Beta & Free Trial Program</span>
        </div>

        {/* Headline */}
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
            Simple, Transparent Pricing <br />
            <span className="eve-gradient-text">Available After Free Trial</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Every new brand receives full access during their initial trial. Custom subscription pricing plans are unlocked for early merchants upon trial completion.
          </p>
        </div>

        {/* Card Form */}
        <div className="w-full max-w-xl bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl text-left space-y-6">
          <div className="space-y-2 border-b border-border pb-4">
            <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
              Request Early Access & Pricing Lock
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Join the EVE early access waitlist to lock in founder rates and reserve your brand's onboarding slot.
            </p>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-foreground mb-1.5">
                  Work Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  placeholder="founder@yourbrand.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-2.5">
                <span className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Early Access Perks:</span>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2 font-medium">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Full access during complimentary trial
                  </li>
                  <li className="flex items-center gap-2 font-medium">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Historical inventory & PO mapping audit
                  </li>
                  <li className="flex items-center gap-2 font-medium">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> Guaranteed early adopter subscription discount lock
                  </li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-white font-bold rounded-xl text-sm bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Joining..." : "Join Waitlist"}
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-xl text-center space-y-3 animate-fade-in">
              <div className="h-10 w-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold mx-auto">
                ✓
              </div>
              <h3 className="text-sm font-bold text-foreground">Added to Waitlist!</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Thank you for joining. We will notify you at <strong className="text-foreground">{email}</strong> as soon as your onboarding slot is ready and lock in your early access pricing.
              </p>
            </div>
          )}
        </div>

        {/* Free trial direct link */}
        <div className="pt-2">
          <p className="text-xs text-muted-foreground">
            Want to start immediately?{" "}
            <Link href="/signup" className="font-bold text-indigo-600 hover:text-indigo-500 underline transition-colors">
              Start Free Trial Now
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-background border-t border-border px-4 sm:px-6 py-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} EVE Inc. All rights reserved.</div>
          <div className="flex flex-wrap justify-center gap-6 font-medium">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/demo" className="hover:text-foreground transition-colors">Live Demo</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

