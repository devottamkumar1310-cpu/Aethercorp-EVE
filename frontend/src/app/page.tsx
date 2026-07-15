"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Upload, 
  Activity, 
  Package, 
  ShieldCheck,
  DollarSign,
  Menu,
  X
} from "lucide-react";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="landing-page min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      {/* Navigation */}
      <header className="w-full bg-slate-50/80 dark:bg-zinc-950/80 border-b border-slate-200/60 dark:border-zinc-900/60 px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 bg-slate-900 dark:bg-white rounded-md flex items-center justify-center text-white dark:text-black font-extrabold text-sm tracking-tighter">
            E
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            EVE
          </span>
        </div>
        
        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/pricing" className="text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/login" className="text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            Sign In
          </Link>
          <Link 
            href="/signup" 
            className="text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-md hover:bg-slate-800 dark:hover:bg-zinc-100 transition-all shadow-sm"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white focus:outline-none"
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-900 p-6 flex flex-col gap-4 shadow-xl z-50 md:hidden">
            <Link 
              href="/pricing" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white py-1"
            >
              Pricing
            </Link>
            <Link 
              href="/login" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white py-1"
            >
              Sign In
            </Link>
            <Link 
              href="/signup" 
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-black py-2.5 rounded-md"
            >
              Get Started
            </Link>
          </div>
        )}
      </header>

      {/* Hero & Product Preview Wrapper (Connected Layout) */}
      <section className="relative overflow-hidden pt-8 pb-10 md:pt-10 md:pb-16 flex flex-col items-center text-center px-6 max-w-6xl mx-auto w-full">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        <div className="max-w-4xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/90 px-3.5 py-1 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span className="hero-badge-text">Inventory intelligence for modern ecommerce founders</span>
          </div>

          <h1 className="hero-headline text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.05] max-w-3xl mx-auto">
            Stop Guessing.<br />
            <span className="hero-headline text-slate-900 dark:text-white">Start Forecasting.</span>
          </h1>

          <p className="hero-subheadline text-base sm:text-lg md:text-xl text-slate-700 dark:text-zinc-200 max-w-2xl mx-auto leading-relaxed font-medium">
            EVE predicts stockouts, identifies dead stock, and generates size-level recommendations so you can reclaim trapped cash and scale with absolute confidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full max-w-md mx-auto sm:max-w-none">
            <Link 
              href="/signup" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white dark:text-black bg-slate-900 dark:bg-white border border-transparent rounded-lg hover:bg-slate-800 dark:hover:bg-zinc-100 transition-all shadow-md"
            >
              Analyze My Inventory
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link 
              href="/demo" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-slate-850 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all"
            >
              View Example Insights
            </Link>
          </div>
        </div>

        {/* Dashboard Preview - Sits Higher, connected visually */}
        <div className="mt-8 md:mt-10 w-full relative group">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-purple-500/5 to-transparent rounded-xl blur-2xl -z-10 opacity-70" />
          
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800/85 shadow-2xl overflow-hidden p-4 sm:p-5 md:p-6 space-y-5 text-left">
            {/* Header / Window controls */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-zinc-800" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-zinc-800" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-zinc-800" />
                <span className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono ml-2">workspace // live-data</span>
              </div>
              <span className="text-[10px] font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded flex items-center gap-1.5 uppercase tracking-wider">
                <Activity size={10} className="text-emerald-500 animate-pulse" /> Live Analysis
              </span>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {/* Health Overview */}
              <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-lg p-4 border border-slate-100 dark:border-zinc-800/50 space-y-3">
                <h3 className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Inventory Health Score</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">84</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 flex items-center"><TrendingUp size={12} className="mr-0.5" /> +2.1%</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400">Overall inventory efficiency is optimal. Two critical stockout risks detected.</p>
                <div className="h-1 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-900 dark:bg-white rounded-full" style={{ width: '84%' }} />
                </div>
              </div>

              {/* Reorders Warning Widget */}
              <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-lg p-4 border border-slate-100 dark:border-zinc-800/50 space-y-2.5">
                <h3 className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Critical Action Required</h3>
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/5 p-2 rounded border border-amber-200/50 dark:border-amber-500/10">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <h4 className="text-[11px] font-bold">2 SKU Bestsellers at Risk</h4>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-500">Classic Cotton Tee will run out in 5 days.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-slate-800 dark:text-white bg-slate-100 dark:bg-zinc-800 p-2 rounded border border-slate-200/50 dark:border-zinc-750/50">
                  <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <h4 className="text-[11px] font-bold">Trapped Capital Flagged</h4>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-500">$14,200 in excess Jogger stock identified.</p>
                  </div>
                </div>
              </div>

              {/* Capital Breakdown */}
              <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-lg p-4 border border-slate-100 dark:border-zinc-800/50 space-y-3">
                <h3 className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Capital Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-zinc-400 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-900 dark:bg-white" /> Healthy Inventory</span>
                    <span className="font-semibold text-slate-900 dark:text-white">$48,320</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-zinc-400 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Stockout Risk Capital</span>
                    <span className="font-semibold text-slate-900 dark:text-white">$6,150</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-zinc-400 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Excess Trapped Capital</span>
                    <span className="font-semibold text-slate-900 dark:text-white">$18,450</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Table Mockup */}
            <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-800/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-100/50 dark:bg-zinc-900/80 flex justify-between items-center">
                <h4 className="text-[11px] font-bold text-slate-900 dark:text-white">Recommended Reorders</h4>
                <span className="text-[9px] text-slate-500 dark:text-zinc-500 font-mono">2 SKU alerts active</span>
              </div>
              <div className="overflow-x-auto scrollbar-none">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-zinc-800/50 text-slate-500 dark:text-zinc-500 font-medium">
                      <th className="px-4 py-2 font-semibold">Product SKU</th>
                      <th className="px-4 py-2 text-right font-semibold">Current Stock</th>
                      <th className="px-4 py-2 text-right font-semibold">Sales Velocity</th>
                      <th className="px-4 py-2 text-right font-semibold">Days Left</th>
                      <th className="px-4 py-2 text-right text-slate-900 dark:text-white font-bold">Reorder Suggestion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50 text-slate-800 dark:text-zinc-300 font-mono text-[11px]">
                    <tr>
                      <td className="px-4 py-2 font-sans font-medium text-slate-900 dark:text-white">Classic Cotton Tee - Black / M</td>
                      <td className="px-4 py-2 text-right">12</td>
                      <td className="px-4 py-2 text-right">2.4 / day</td>
                      <td className="px-4 py-2 text-right text-red-500 font-semibold">5</td>
                      <td className="px-4 py-2 text-right text-slate-900 dark:text-white font-bold">150 units</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-sans font-medium text-slate-900 dark:text-white">Heavyweight Hoodie - Gray / L</td>
                      <td className="px-4 py-2 text-right">8</td>
                      <td className="px-4 py-2 text-right">1.6 / day</td>
                      <td className="px-4 py-2 text-right text-red-500 font-semibold">3</td>
                      <td className="px-4 py-2 text-right text-slate-900 dark:text-white font-bold">100 units</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section - Linear style minimalist layout */}
      <section className="px-6 py-16 border-y border-slate-200/60 dark:border-zinc-900/60 bg-white/40 dark:bg-zinc-950/20">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">The Three Flaws in Standard Inventory Planning</h2>
            <p className="text-slate-500 dark:text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto">
              How guesswork, static tables, and lag times eat away at ecommerce margins.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-3.5">
              <div className="h-9 w-9 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-lg flex items-center justify-center">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Unplanned Bestseller Stockouts</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Losing revenue when velocity spikes and suppliers have a 30-day lead time. EVE warns you weeks in advance so you can replenish before the stock hits zero.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="h-9 w-9 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-lg flex items-center justify-center">
                <DollarSign size={18} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Trapped Cash in Overstock</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Tying up thousands of dollars in slow-moving colors and sizes. EVE isolates excess units and suggests liquidation schedules or production delays.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="h-9 w-9 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-lg flex items-center justify-center">
                <Package size={18} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Spreadsheet Inaccuracy</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Manually downloading sales records, mapping variants, and guessing sizes. EVE does the math dynamically, mapping variants, velocities, and lead times.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Outcome-focused capabilities */}
      <section className="px-6 py-16 md:py-20 max-w-5xl mx-auto w-full space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Core Inventory Insights</h2>
          <p className="text-slate-500 dark:text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto">
            Everything you need to predict supply needs and safeguard margins.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-900 p-5 rounded-xl space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Predictive Stockout Alerts</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              EVE monitors variant-level sales velocities daily. The moment a bestseller shows accelerated demand relative to lead times, an alert is triggered outlining unit deficit and reorder deadline.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-900 p-5 rounded-xl space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Trapped Capital Calculator</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Scan your warehouses instantly for excess items trapping cash. Get actionable recommendations to defer next PO drafts, run targeted size promos, or renegotiate minimum order quantities.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-900 p-5 rounded-xl space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Automated Supplier Planning</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Upload factory price lists and lead times. EVE matches historical velocity data to automate reorder sheets, aligning recommendations perfectly with supplier shipping requirements.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-900 p-5 rounded-xl space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Document Intelligence</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Upload supplier invoices or packing lists. EVE extracts products, volumes, and costs, cross-referencing them against your inventory records to verify accuracy.
            </p>
          </div>
        </div>
      </section>

      {/* 3-step Workflow */}
      <section className="px-6 py-16 border-y border-slate-200/60 dark:border-zinc-900/60 bg-white/40 dark:bg-zinc-950/20">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">The 3-Step Inventory Workflow</h2>
            <p className="text-slate-500 dark:text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto">
              How EVE processes raw spreadsheets and supplier files into margin-saving recommendations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="space-y-3 p-4 bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-900/80 rounded-xl relative">
              <span className="absolute top-4 right-4 text-[10px] font-mono text-slate-400 dark:text-zinc-500 font-bold">01</span>
              <div className="h-8 w-8 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/30 text-slate-900 dark:text-white rounded-md flex items-center justify-center">
                <Upload size={14} />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Upload Data</h3>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                Drag and drop your variants, stock levels, or supplier invoice lists into the document hub.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3 p-4 bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-900/80 rounded-xl relative">
              <span className="absolute top-4 right-4 text-[10px] font-mono text-slate-400 dark:text-zinc-500 font-bold">02</span>
              <div className="h-8 w-8 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/30 text-slate-900 dark:text-white rounded-md flex items-center justify-center">
                <Activity size={14} />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Scan Health</h3>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                EVE reconciles columns, calculates variant sales velocity, and flags overstock or stockout dates.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-3 p-4 bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-900/80 rounded-xl relative">
              <span className="absolute top-4 right-4 text-[10px] font-mono text-slate-400 dark:text-zinc-500 font-bold">03</span>
              <div className="h-8 w-8 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/30 text-slate-900 dark:text-white rounded-md flex items-center justify-center">
                <CheckCircle size={14} />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Reorder Suggestions</h3>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                Get size-level purchase order suggestions tailored to your actual lead times.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto space-y-6">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Start Using EVE
        </h2>
        <p className="text-xs sm:text-sm md:text-base text-slate-650 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Create your workspace and begin analyzing your inventory.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full max-w-md mx-auto sm:max-w-none">
          <Link 
            href="/signup" 
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white dark:text-black bg-slate-900 dark:bg-white border border-transparent rounded-lg hover:bg-slate-800 dark:hover:bg-zinc-100 transition-all shadow-md group"
          >
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link 
            href="/demo" 
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-slate-800 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-all"
          >
            View Example Insights
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-slate-50 dark:bg-zinc-950 border-t border-slate-200/60 dark:border-zinc-900/60 px-6 py-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 dark:text-zinc-500 gap-4">
        <div className="text-center md:text-left">
          &copy; {new Date().getFullYear()} EVE. All rights reserved.
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors">Pricing</Link>
          <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy Policy</Link>
          <a href="mailto:support@eveinventory.in" className="hover:text-slate-900 dark:hover:text-white transition-colors">support@eveinventory.in</a>
        </div>
      </footer>
    </div>
  );
}
