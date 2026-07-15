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
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-200">
      {/* Navbar */}
      <header className="w-full bg-card border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold tracking-tighter shadow-sm shadow-indigo-600/30">
            EVE
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            EVE
          </h1>
        </div>
        
        {/* Desktop Navbar Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/pricing" className="text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Pricing
          </Link>
          <Link href="/login" className="text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Sign In
          </Link>
          <Link 
            href="/signup" 
            className="text-sm font-semibold bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5"
            style={{ color: '#ffffff' }}
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none"
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Mobile Navigation Drawer / Dropdown */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-card border-b border-slate-200 dark:border-zinc-800 p-6 flex flex-col gap-4 shadow-xl z-50 animate-fade-in md:hidden">
            <Link 
              href="/pricing" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1"
            >
              Pricing
            </Link>
            <Link 
              href="/login" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1"
            >
              Sign In
            </Link>
            <Link 
              href="/signup" 
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center text-sm font-semibold bg-indigo-600 py-3 rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 text-white"
            >
              Get Started
            </Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-12 sm:pt-20 sm:pb-16 flex flex-col items-center justify-center text-center px-4 sm:px-6">
        <div className="max-w-4xl space-y-6 sm:space-y-8 relative z-10">
          <div className="inline-flex items-center rounded-full border border-slate-200 dark:border-zinc-800 bg-card px-3 py-1 text-xs sm:text-sm text-foreground animate-fade-in font-medium">
            <Sparkles className="mr-2 h-4 w-4 text-indigo-500" />
            Built for ecommerce founders.
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-foreground leading-tight">
            Stop Stockouts and Dead Inventory <br />
            <span className="hero-headline-accent">Before They Cost You Money</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-slate-700 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            EVE analyzes your inventory and shows what to reorder, what is becoming dead stock, and where cash is trapped.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full max-w-md mx-auto sm:max-w-none">
            <Link 
              href="/demo" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-bold text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 group"
            >
              Try Demo
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              href="/demo" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-foreground bg-card border border-slate-300 dark:border-zinc-700 rounded-lg hover:bg-muted transition-all hover:-translate-y-0.5"
            >
              View Example Insights
            </Link>
          </div>
        </div>

        {/* Backdrop Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Product Preview Section */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 max-w-6xl mx-auto w-full">
        <div className="bg-slate-50/50 dark:bg-zinc-950/20 rounded-2xl border border-border/80 shadow-inner overflow-hidden p-4 sm:p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground font-mono ml-2">NovaWear Dashboard</span>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 uppercase tracking-wider">
              <Activity size={12} className="animate-pulse" /> Live Analysis
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Health Overview */}
            <div className="bg-card rounded-xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Inventory Health Score</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-foreground">84</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-500 flex items-center"><TrendingUp size={14} className="mr-0.5" /> +2.1%</span>
              </div>
              <p className="text-xs text-muted-foreground">Overall inventory efficiency is optimal. Two critical stockout risks detected.</p>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: '84%' }} />
              </div>
            </div>

            {/* Reorders Warning Widget */}
            <div className="bg-card rounded-xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Critical Action Required</h3>
              <div className="flex items-start gap-2.5 text-amber-600 dark:text-amber-500 bg-amber-500/5 p-3 rounded-lg border border-amber-500/20">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold">Stockout Risk: Cargo Pants</h4>
                  <p className="text-[10px] text-muted-foreground">11 days remaining. Reorder 300 units.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-indigo-600 dark:text-indigo-400 bg-indigo-400/5 p-3 rounded-lg border border-indigo-400/20">
                <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold">Dead Stock: Black Oversized Tee</h4>
                  <p className="text-[10px] text-muted-foreground">120 units unsold. Run promotion, reduce reorder frequency.</p>
                </div>
              </div>
            </div>

            {/* Trapped Capital overview */}
            <div className="bg-card rounded-xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Capital Breakdown</h3>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Healthy Inventory</span>
                  <span className="font-semibold text-foreground">$48,320</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Stockout Risk Capital</span>
                  <span className="font-semibold text-foreground">$6,150</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Excess Trapped Capital</span>
                  <span className="font-semibold text-foreground">$11,200</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table Mockup */}
          <div className="bg-card rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-slate-50/50 dark:bg-zinc-900/30 flex justify-between items-center">
              <h4 className="text-xs font-bold text-foreground">Recommended Reorders</h4>
              <span className="text-[10px] text-muted-foreground font-mono">2 SKU alerts active</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-medium bg-card/10">
                    <th className="px-5 py-3">Product SKU</th>
                    <th className="px-5 py-3 text-right">Current Stock</th>
                    <th className="px-5 py-3 text-right">Sales Velocity</th>
                    <th className="px-5 py-3 text-right">Days Left</th>
                    <th className="px-5 py-3 text-right text-indigo-600 dark:text-indigo-400">Reorder Suggestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground/90 font-mono">
                  <tr>
                    <td className="px-5 py-3 font-sans font-medium text-foreground">Cargo Pants</td>
                    <td className="px-5 py-3 text-right">45</td>
                    <td className="px-5 py-3 text-right">4.1 / day</td>
                    <td className="px-5 py-3 text-right text-red-500 dark:text-red-400 font-bold">11</td>
                    <td className="px-5 py-3 text-right text-indigo-600 dark:text-indigo-400 font-bold">300 units</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-sans font-medium text-foreground">Black Oversized Tee</td>
                    <td className="px-5 py-3 text-right">120</td>
                    <td className="px-5 py-3 text-right">0.2 / day</td>
                    <td className="px-5 py-3 text-right text-amber-500 font-bold">600+</td>
                    <td className="px-5 py-3 text-right text-muted-foreground font-bold">Run Promo ($2,800 trapped)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing / Founding Customer Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-indigo-600 dark:bg-indigo-900 border-y border-indigo-700 dark:border-indigo-800 text-white">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Founding Customer Program</h2>
          <p className="text-indigo-100 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Free for the first 10 ecommerce brands. In exchange for your honest product feedback, you'll get full access to EVE at zero cost while we build the ultimate inventory platform together.
          </p>
          <div className="pt-4">
            <Link 
              href="/signup" 
              className="inline-flex items-center justify-center px-8 py-3.5 text-base font-bold text-indigo-600 bg-white border border-transparent rounded-lg hover:bg-slate-50 transition-all shadow-md hover:-translate-y-0.5"
            >
              Claim Your Spot
            </Link>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-card border-y border-border">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">The Three Flaws in Standard Inventory Planning</h2>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-xl mx-auto">
              How guesswork, static tables, and lag times eat away at ecommerce margins.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-3 p-2">
              <div className="h-10 w-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Unplanned Bestseller Stockouts</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Losing revenue when velocity spikes and suppliers have a 30-day lead time. EVE warns you weeks in advance so you can replenish before the stock hits zero.
              </p>
            </div>

            <div className="space-y-3 p-2">
              <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg flex items-center justify-center">
                <DollarSign size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Trapped Cash in Overstock</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tying up thousands of dollars in slow-moving colors and sizes. EVE isolates excess units and suggests liquidation schedules or production delays.
              </p>
            </div>

            <div className="space-y-3 p-2">
              <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center">
                <Package size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Spreadsheet Inaccuracy</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Manually downloading sales records, mapping variants, and guessing sizes. EVE does the math dynamically, mapping variants, velocities, and lead times.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Outcome-focused capabilities */}
      <section className="px-4 sm:px-6 py-20 sm:py-24 max-w-5xl mx-auto w-full space-y-16">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">Understand Inventory Risk Instantly</h2>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-xl mx-auto">
            Everything you need to predict supply needs and safeguard margins.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-card border border-border p-6 rounded-2xl space-y-3">
            <h3 className="text-base font-bold text-foreground">Know What To Reorder</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              EVE monitors variant-level sales velocities daily. The moment a bestseller shows accelerated demand relative to lead times, an alert is triggered outlining unit deficit and reorder deadline.
            </p>
          </div>

          <div className="bg-card border border-border p-6 rounded-2xl space-y-3">
            <h3 className="text-base font-bold text-foreground">See Trapped Cash</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Scan your warehouses instantly for excess items trapping cash. Get actionable recommendations to defer next PO drafts, run targeted size promos, or renegotiate minimum order quantities.
            </p>
          </div>

          <div className="bg-card border border-border p-6 rounded-2xl space-y-3">
            <h3 className="text-base font-bold text-foreground">Prevent Stockouts</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload factory price lists and lead times. EVE matches historical velocity data to automate reorder sheets, aligning recommendations perfectly with supplier shipping requirements.
            </p>
          </div>

          <div className="bg-card border border-border p-6 rounded-2xl space-y-3">
            <h3 className="text-base font-bold text-foreground">Identify Dead Inventory</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Stop guessing which variants are dragging down profitability. EVE spots dead stock trends early so you can pivot marketing spend before products become unsellable.
            </p>
          </div>
        </div>
      </section>

      {/* Who Is EVE For Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-slate-50/50 dark:bg-zinc-900/20 border-y border-border">
        <div className="max-w-4xl mx-auto space-y-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">Who Is EVE For?</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 text-sm font-medium text-foreground">
            <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-center gap-2 shadow-sm">
              <CheckCircle size={16} className="text-indigo-500" /> Shopify brands
            </div>
            <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-center gap-2 shadow-sm">
              <CheckCircle size={16} className="text-indigo-500" /> D2C apparel brands
            </div>
            <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-center gap-2 shadow-sm text-center">
              <CheckCircle size={16} className="text-indigo-500 flex-shrink-0" /> Founders managing inventory manually
            </div>
            <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-center gap-2 shadow-sm">
              <CheckCircle size={16} className="text-indigo-500" /> Brands with 10+ SKUs
            </div>
            <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-center gap-2 shadow-sm">
              <CheckCircle size={16} className="text-indigo-500" /> Growing ecommerce businesses
            </div>
          </div>
        </div>
      </section>

      {/* 3-step Workflow */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-card border-y border-border">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">The 3-Step Inventory Workflow</h2>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-xl mx-auto">
              How EVE processes raw spreadsheets and supplier files into margin-saving recommendations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="space-y-3 p-4 bg-secondary border border-border rounded-xl relative">
              <span className="absolute top-4 right-4 text-xs font-mono text-indigo-400 font-bold">STEP 01</span>
              <div className="h-8 w-8 bg-indigo-500/10 text-indigo-400 rounded-md flex items-center justify-center">
                <Upload size={16} />
              </div>
              <h3 className="text-sm font-bold text-foreground">Upload Data</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Drag and drop your variants, stock levels, or supplier invoice lists into the document hub.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3 p-4 bg-secondary border border-border rounded-xl relative">
              <span className="absolute top-4 right-4 text-xs font-mono text-indigo-400 font-bold">STEP 02</span>
              <div className="h-8 w-8 bg-indigo-500/10 text-indigo-400 rounded-md flex items-center justify-center">
                <Activity size={16} />
              </div>
              <h3 className="text-sm font-bold text-foreground">Scan Health</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                EVE reconciles columns, calculates variant sales velocity, and flags overstock or stockout dates.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-3 p-4 bg-secondary border border-border rounded-xl relative">
              <span className="absolute top-4 right-4 text-xs font-mono text-indigo-400 font-bold">STEP 03</span>
              <div className="h-8 w-8 bg-indigo-500/10 text-indigo-400 rounded-md flex items-center justify-center">
                <CheckCircle size={16} />
              </div>
              <h3 className="text-sm font-bold text-foreground">Reorder Recommendations</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Get size-level purchase order suggestions tailored to your actual lead times.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 sm:px-6 py-20 sm:py-24 text-center max-w-4xl mx-auto space-y-8">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          Start Using EVE
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-slate-700 dark:text-zinc-300 max-w-xl mx-auto leading-relaxed">
          Create your workspace and begin analyzing your inventory.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full max-w-md mx-auto sm:max-w-none">
          <Link 
            href="/signup" 
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 group"
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <Link 
            href="/demo" 
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-medium text-foreground bg-card border border-slate-300 dark:border-zinc-700 rounded-lg hover:bg-muted transition-all hover:-translate-y-0.5"
          >
            View Example Insights
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-card border-t border-border px-4 sm:px-6 py-8 flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
        <div className="text-center md:text-left space-y-2">
          <div>&copy; {new Date().getFullYear()} EVE. All rights reserved. Built for ecommerce founders.</div>
          <div className="font-medium text-foreground">Questions? support@eveinventory.in</div>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
