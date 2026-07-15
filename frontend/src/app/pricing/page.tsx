"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

export default function PricingPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    // Simulate API request
    setTimeout(() => {
      setSubmitted(true);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-200">
      {/* Navbar */}
      <header className="w-full bg-card border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
        <div className="flex items-center gap-2">
          <Link href="/" className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold tracking-tighter shadow-sm shadow-indigo-600/30">
            EVE
          </Link>
          <Link href="/" className="text-lg sm:text-xl font-semibold text-foreground tracking-tight hover:opacity-90">
            EVE
          </Link>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/" className="text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Home
          </Link>
          <Link href="/login" className="text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Sign In
          </Link>
          <Link 
            href="/signup" 
            className="text-xs sm:text-sm font-semibold bg-indigo-600 px-3 sm:px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5"
            style={{ color: '#ffffff' }}
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-20 flex flex-col justify-center items-center text-center space-y-10">
        {/* Badge */}
        <div className="inline-flex items-center rounded-full border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-1 text-xs sm:text-sm text-indigo-600 dark:text-indigo-400">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          EVE Private Beta Invitation
        </div>

        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Simple, Scale-Ready Pricing <br />
            <span className="hero-headline-accent">Coming Soon.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-700 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            EVE is currently in an invitation-only Private Beta for founder-led ecommerce, D2C, and apparel brands. We are onboarding new merchants weekly.
          </p>
        </div>

        {/* Beta Notice & Form Card */}
        <div className="w-full max-w-xl bg-card border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-lg text-left space-y-6">
          <div className="space-y-2 border-b border-border pb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              Private Beta Request
            </h2>
            <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>Join the EVE early access waitlist.</p>
              <p>Get notified when new onboarding slots open and receive updates as the platform evolves.</p>
            </div>
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
                  placeholder="name@yourbrand.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-slate-300 dark:border-zinc-700 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2.5">
                <span className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Early Access Perks:</span>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-zinc-300">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500" /> Free historical inventory mapping audit
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500" /> Locked-in early adopter subscription discounts
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-500" /> Directly influence our predictive roadmap
                  </li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Joining..." : "Join Waitlist"}
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <div className="bg-indigo-500/5 border border-indigo-500/20 p-6 rounded-xl text-center space-y-3 animate-fade-in">
              <div className="h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold mx-auto">
                ✓
              </div>
              <h3 className="text-sm font-bold text-foreground">Added to Waitlist!</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Thank you for joining. We will notify you at <strong>{email}</strong> as soon as your onboarding slot is ready and send you updates as the platform evolves.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-card border-t border-border px-4 sm:px-6 py-6 flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
        <div className="text-center md:text-left">
          &copy; {new Date().getFullYear()} EVE. All rights reserved.
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
