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
    <div className="eve-public-shell min-h-screen bg-[#020203] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Background Star field & Glows */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="hero-stars" />
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-500/10 rounded-full filter blur-[120px] opacity-60" />
      </div>

      {/* Navbar */}
      <header className="eve-public-nav w-full bg-black/40 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-50 relative">
        <div className="flex items-center gap-2">
          <Link href="/" className="h-8 w-8 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-black tracking-tighter shadow-md shadow-purple-900/20">
            E
          </Link>
          <Link href="/" className="text-lg sm:text-xl font-semibold text-white tracking-tight hover:opacity-90">
            EVE
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors">
            Home
          </Link>
          <Link href="/login" className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link 
            href="/signup" 
            className="text-xs sm:text-sm font-semibold bg-violet-600 hover:bg-violet-700 px-3 sm:px-4 py-2 rounded-lg transition-all text-white shadow-md hover:-translate-y-0.5"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-20 flex flex-col justify-center items-center text-center space-y-10 relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center rounded-full border border-purple-500/20 bg-purple-500/5 px-3 py-1 text-xs sm:text-sm text-purple-400">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          EVE Private Beta Invitation
        </div>

        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Simple, Scale-Ready Pricing <br />
            <span className="hero-headline-accent">Coming Soon.</span>
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            EVE is currently in an invitation-only Private Beta for founder-led ecommerce, D2C, and apparel brands. We are onboarding new merchants weekly.
          </p>
        </div>

        {/* Beta Notice & Form Card */}
        <div className="eve-public-card w-full max-w-xl bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl text-left space-y-6">
          <div className="space-y-2 border-b border-white/[0.08] pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
              Private Beta Request
            </h2>
            <div className="space-y-2 text-xs text-zinc-400 leading-relaxed">
              <p>Join the EVE early access waitlist.</p>
              <p>Get notified when new onboarding slots open and receive updates as the platform evolves.</p>
            </div>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Work Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  placeholder="name@yourbrand.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
                />
              </div>

              <div className="space-y-2.5">
                <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Early Access Perks:</span>
                <ul className="space-y-1.5 text-xs text-zinc-300">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400" /> Free historical inventory mapping audit
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400" /> Locked-in early adopter subscription discounts
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400" /> Directly influence our predictive roadmap
                  </li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-white font-bold rounded-lg text-sm transition-all btn-primary-glow flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Joining..." : "Join Waitlist"}
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <div className="bg-purple-500/5 border border-purple-500/20 p-6 rounded-xl text-center space-y-3 animate-fade-in">
              <div className="h-10 w-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold mx-auto">
                ✓
              </div>
              <h3 className="text-sm font-bold text-white">Added to Waitlist!</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Thank you for joining. We will notify you at <strong className="text-white">{email}</strong> as soon as your onboarding slot is ready and send you updates as the platform evolves.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-transparent border-t border-white/[0.08] px-4 sm:px-6 py-8 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-400 gap-4 relative z-10">
        <div className="text-center md:text-left">
          &copy; {new Date().getFullYear()} EVE. All rights reserved.
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/" className="text-zinc-300 hover:text-white transition-colors">Home</Link>
          <Link href="/terms" className="text-zinc-300 hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="text-zinc-300 hover:text-white transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
