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
    <div className="landing-page min-h-screen bg-white dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-200">
      {/* Navbar */}
      <header className="w-full bg-white dark:bg-zinc-950 border-b border-[#E5E7EB] dark:border-zinc-800 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-[#4F46E5] rounded-md flex items-center justify-center text-white font-bold tracking-tighter shadow-sm">
            EVE
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-[#4F46E5] tracking-tight">
            EVE <span className="hidden md:inline text-[#111111] dark:text-white">| Inventory Intelligence</span>
          </h1>
        </div>
        
        {/* Desktop Navbar Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/pricing" className="text-sm font-semibold text-[#111111] dark:text-zinc-300 hover:text-[#4F46E5] dark:hover:text-indigo-400 transition-colors">
            Pricing
          </Link>
          <Link href="/login" className="text-sm font-semibold text-[#111111] dark:text-zinc-300 hover:text-[#4F46E5] dark:hover:text-indigo-400 transition-colors">
            Sign In
          </Link>
          <Link 
            href="/signup" 
            className="text-sm font-semibold bg-[#4F46E5] hover:bg-[#4F46E5] hover:text-[#111111] px-4 py-2 rounded-lg transition-all shadow-md text-white"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-[#111111] dark:text-zinc-300 hover:text-[#4F46E5] focus:outline-none"
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Mobile Navigation Drawer / Dropdown */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-950 border-b border-[#E5E7EB] dark:border-zinc-800 p-6 flex flex-col gap-4 shadow-xl z-50 md:hidden">
            <Link 
              href="/pricing" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#111111] dark:text-zinc-300 hover:text-[#4F46E5] transition-colors py-1"
            >
              Pricing
            </Link>
            <Link 
              href="/login" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-semibold text-[#111111] dark:text-zinc-300 hover:text-[#4F46E5] transition-colors py-1"
            >
              Sign In
            </Link>
            <Link 
              href="/signup" 
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center text-sm font-semibold bg-[#4F46E5] hover:bg-[#4F46E5] hover:text-[#111111] py-3 rounded-lg transition-all shadow-md text-white"
            >
              Get Started
            </Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-12 sm:pt-20 sm:pb-16 flex flex-col items-center justify-center text-center px-4 sm:px-6">
        <div className="max-w-4xl space-y-6 sm:space-y-8 relative z-10">
          <div className="inline-flex items-center rounded-full border border-[#E5E7EB] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-1 text-xs sm:text-sm text-[#4B5563] dark:text-zinc-350 shadow-sm font-medium">
            <Sparkles className="mr-2 h-4 w-4 text-[#4F46E5]" />
            Inventory Forecasting & Planning Built for Ecommerce Founders, D2C & Apparel Brands
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-[#111111] dark:text-white leading-tight opacity-1">
            Stop Guessing. <br />
            <span className="text-[#4F46E5] opacity-1">Start Forecasting.</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-[#4B5563] dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed opacity-1">
            EVE predicts stockouts, identifies dead stock, and generates size-level reorder recommendations so founder-led ecommerce, D2C, and apparel brands can reclaim trapped working capital and scale with confidence.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full max-w-md mx-auto sm:max-w-none">
            <Link 
              href="/signup" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white bg-[#4F46E5] hover:bg-[#4F46E5] hover:text-[#111111] border border-transparent rounded-lg transition-all shadow-md shadow-indigo-650/20 hover:-translate-y-0.5"
            >
              Analyze My Inventory
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link 
              href="/demo" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-[#4B5563] dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-700 rounded-lg hover:bg-[#4F46E5] hover:text-[#111111] transition-all hover:-translate-y-0.5"
            >
              View Example Insights
            </Link>
          </div>
        </div>
      </section>

      {/* Product Preview Section */}
      <section className="px-4 sm:px-6 pb-20 sm:pb-24 max-w-6xl mx-auto w-full">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-[#E5E7EB] dark:border-zinc-800 shadow-md p-4 sm:p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-[#6B7280] dark:text-zinc-500 font-mono ml-2">EVE Dashboard Workspace</span>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 uppercase tracking-wider">
              <Activity size={12} className="animate-pulse" /> Live Analysis
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Health Overview */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl p-5 border border-[#E5E7EB] dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-wider">Inventory Health Score</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-[#111111] dark:text-white">84</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-500 flex items-center"><TrendingUp size={14} className="mr-0.5" /> +2.1%</span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-zinc-300">Overall inventory efficiency is optimal. Two critical stockout risks detected.</p>
              <div className="h-1.5 w-full bg-[#E5E7EB] dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: '84%' }} />
              </div>
            </div>

            {/* Reorders Warning Widget */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl p-5 border border-[#E5E7EB] dark:border-zinc-800 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-wider">Critical Action Required</h3>
              <div className="flex items-start gap-2.5 text-amber-700 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-250 dark:border-amber-900/40">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300">2 SKU Bestsellers at Risk</h4>
                  <p className="text-[10px] text-[#4B5563] dark:text-[#a1a1aa] font-medium">Classic Cotton Tee (Black/M, L) will run out in 5 days.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-lg border border-indigo-250 dark:border-indigo-900/40">
                <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300">Trapped Capital Recovered</h4>
                  <p className="text-[10px] text-[#4B5563] dark:text-[#a1a1aa] font-medium">$14,200 in excess Cargo Jogger stock flagged for promo.</p>
                </div>
              </div>
            </div>

            {/* Trapped Capital overview */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl p-5 border border-[#E5E7EB] dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-[#6B7280] dark:text-zinc-400 uppercase tracking-wider">Capital Breakdown</h3>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#4B5563] dark:text-zinc-300 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Healthy Inventory</span>
                  <span className="font-semibold text-[#111111] dark:text-white">$48,320</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#4B5563] dark:text-zinc-300 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Stockout Risk Capital</span>
                  <span className="font-semibold text-[#111111] dark:text-white">$6,150</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#4B5563] dark:text-zinc-300 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Excess Trapped Capital</span>
                  <span className="font-semibold text-[#111111] dark:text-white">$18,450</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table Mockup */}
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-[#E5E7EB] dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 flex justify-between items-center">
              <h4 className="text-xs font-bold text-[#111111] dark:text-white">Recommended Reorders</h4>
              <span className="text-[10px] text-[#6B7280] dark:text-zinc-400 font-mono">2 SKU alerts active</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-[#E5E7EB] dark:border-zinc-800 text-[#4B5563] dark:text-zinc-400 font-medium">
                    <th className="px-5 py-3">Product SKU</th>
                    <th className="px-5 py-3 text-right">Current Stock</th>
                    <th className="px-5 py-3 text-right">Sales Velocity</th>
                    <th className="px-5 py-3 text-right">Days Left</th>
                    <th className="px-5 py-3 text-right text-[#4F46E5] dark:text-indigo-400">Reorder Suggestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-zinc-850 text-[#111111] dark:text-zinc-200 font-mono">
                  <tr>
                    <td className="px-5 py-3 font-sans font-medium text-[#111111] dark:text-white">Classic Cotton Tee - Black / M</td>
                    <td className="px-5 py-3 text-right">12</td>
                    <td className="px-5 py-3 text-right">2.4 / day</td>
                    <td className="px-5 py-3 text-right text-red-650 dark:text-red-400 font-bold">5</td>
                    <td className="px-5 py-3 text-right text-[#4F46E5] dark:text-indigo-400 font-bold">150 units</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-sans font-medium text-[#111111] dark:text-white">Heavyweight Hoodie - Gray / L</td>
                    <td className="px-5 py-3 text-right">8</td>
                    <td className="px-5 py-3 text-right">1.6 / day</td>
                    <td className="px-5 py-3 text-right text-red-650 dark:text-red-400 font-bold">3</td>
                    <td className="px-5 py-3 text-right text-[#4F46E5] dark:text-indigo-400 font-bold">100 units</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-transparent border-y border-[#E5E7EB] dark:border-zinc-800">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111111] dark:text-white tracking-tight">The Three Flaws in Standard Inventory Planning</h2>
            <p className="text-[#4B5563] dark:text-zinc-300 text-xs sm:text-sm max-w-xl mx-auto">
              How guesswork, static tables, and lag times eat away at ecommerce margins.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
              <div className="h-10 w-10 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-[#111111] dark:text-white">Unplanned Bestseller Stockouts</h3>
              <p className="text-xs text-[#4B5563] dark:text-zinc-300 leading-relaxed">
                Losing revenue when velocity spikes and suppliers have a 30-day lead time. EVE warns you weeks in advance so you can replenish before the stock hits zero.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
              <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-lg flex items-center justify-center">
                <DollarSign size={20} />
              </div>
              <h3 className="text-base font-bold text-[#111111] dark:text-white">Trapped Cash in Overstock</h3>
              <p className="text-xs text-[#4B5563] dark:text-zinc-300 leading-relaxed">
                Tying up thousands of dollars in slow-moving colors and sizes. EVE isolates excess units and suggests liquidation schedules or production delays.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-4">
              <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-655 rounded-lg flex items-center justify-center">
                <Package size={20} />
              </div>
              <h3 className="text-base font-bold text-[#111111] dark:text-white">Spreadsheet Inaccuracy</h3>
              <p className="text-xs text-[#4B5563] dark:text-zinc-300 leading-relaxed">
                Manually downloading sales records, mapping variants, and guessing sizes. EVE does the math dynamically, mapping variants, velocities, and lead times.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Outcome-focused capabilities */}
      <section className="px-4 sm:px-6 py-20 sm:py-24 max-w-5xl mx-auto w-full space-y-16">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111111] dark:text-white tracking-tight">Core Inventory Insights</h2>
          <p className="text-[#4B5563] dark:text-zinc-300 text-xs sm:text-sm max-w-xl mx-auto">
            Everything you need to predict supply needs and safeguard margins.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 p-6 rounded-2xl space-y-3 shadow-sm">
            <h3 className="text-base font-bold text-[#111111] dark:text-white">Predictive Stockout Alerts</h3>
            <p className="text-xs text-[#4B5563] dark:text-zinc-300 leading-relaxed">
              EVE monitors variant-level sales velocities daily. The moment a bestseller shows accelerated demand relative to lead times, an alert is triggered outlining unit deficit and reorder deadline.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 p-6 rounded-2xl space-y-3 shadow-sm">
            <h3 className="text-base font-bold text-[#111111] dark:text-white">Trapped Capital Calculator</h3>
            <p className="text-xs text-[#4B5563] dark:text-zinc-300 leading-relaxed">
              Scan your warehouses instantly for excess items trapping cash. Get actionable recommendations to defer next PO drafts, run targeted size promos, or renegotiate minimum order quantities.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 p-6 rounded-2xl space-y-3 shadow-sm">
            <h3 className="text-base font-bold text-[#111111] dark:text-white">Automated Supplier Planning</h3>
            <p className="text-xs text-[#4B5563] dark:text-zinc-300 leading-relaxed">
              Upload factory price lists and lead times. EVE matches historical velocity data to automate reorder sheets, aligning recommendations perfectly with supplier shipping requirements.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 p-6 rounded-2xl space-y-3 shadow-sm">
            <h3 className="text-base font-bold text-[#111111] dark:text-white">Document Intelligence</h3>
            <p className="text-xs text-[#4B5563] dark:text-zinc-300 leading-relaxed">
              Upload supplier invoices or packing lists. EVE extracts products, volumes, and costs, cross-referencing them against your inventory records to verify accuracy.
            </p>
          </div>
        </div>
      </section>

      {/* 3-step Workflow */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-transparent border-y border-[#E5E7EB] dark:border-zinc-800">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111111] dark:text-white tracking-tight">The 3-Step Inventory Workflow</h2>
            <p className="text-[#4B5563] dark:text-zinc-300 text-xs sm:text-sm max-w-xl mx-auto">
              How EVE processes raw spreadsheets and supplier files into margin-saving recommendations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="space-y-3 bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl relative shadow-sm p-6">
              <span className="absolute top-4 right-4 text-xs font-mono text-[#4F46E5] dark:text-indigo-400 font-bold">STEP 01</span>
              <div className="h-8 w-8 bg-indigo-500/10 text-[#4F46E5] rounded-md flex items-center justify-center">
                <Upload size={16} />
              </div>
              <h3 className="text-sm font-bold text-[#111111] dark:text-white">Upload Data</h3>
              <p className="text-xs text-[#4B5563] dark:text-zinc-300 leading-relaxed">
                Drag and drop your variants, stock levels, or supplier invoice lists into the document hub.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3 bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl relative shadow-sm p-6">
              <span className="absolute top-4 right-4 text-xs font-mono text-[#4F46E5] dark:text-indigo-400 font-bold">STEP 02</span>
              <div className="h-8 w-8 bg-indigo-500/10 text-[#4F46E5] rounded-md flex items-center justify-center">
                <Activity size={16} />
              </div>
              <h3 className="text-sm font-bold text-[#111111] dark:text-white">Scan Health</h3>
              <p className="text-xs text-[#4B5563] dark:text-zinc-300 leading-relaxed">
                EVE reconciles columns, calculates variant sales velocity, and flags overstock or stockout dates.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-3 bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-800 rounded-xl relative shadow-sm p-6">
              <span className="absolute top-4 right-4 text-xs font-mono text-[#4F46E5] dark:text-indigo-400 font-bold">STEP 03</span>
              <div className="h-8 w-8 bg-indigo-500/10 text-[#4F46E5] rounded-md flex items-center justify-center">
                <CheckCircle size={16} />
              </div>
              <h3 className="text-sm font-bold text-[#111111] dark:text-white">Reorder Recommendations</h3>
              <p className="text-xs text-[#4B5563] dark:text-zinc-300 leading-relaxed">
                Get size-level purchase order suggestions tailored to your actual lead times.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 sm:px-6 py-20 sm:py-24 text-center max-w-4xl mx-auto space-y-8">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#111111] dark:text-white">
          Start Using EVE
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-[#4B5563] dark:text-zinc-300 max-w-xl mx-auto leading-relaxed">
          Create your workspace and begin analyzing your inventory.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full max-w-md mx-auto sm:max-w-none">
          <Link 
            href="/signup" 
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-[#4F46E5] hover:bg-[#4F46E5] hover:text-[#111111] border border-transparent rounded-lg transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 group"
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <Link 
            href="/demo" 
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-medium text-[#4B5563] dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-[#E5E7EB] dark:border-zinc-700 rounded-lg hover:bg-[#4F46E5] hover:text-[#111111] transition-all hover:-translate-y-0.5"
          >
            View Example Insights
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-white dark:bg-zinc-950 border-t border-[#E5E7EB] dark:border-zinc-800 px-4 sm:px-6 py-6 flex flex-col md:flex-row items-center justify-between text-xs text-[#6B7280] gap-4">
        <div className="text-center md:text-left space-y-1">
          <div>&copy; {new Date().getFullYear()} EVE. All rights reserved.</div>
          <div className="text-[#6B7280]">Questions? <a href="mailto:support@eveinventory.in" className="hover:text-[#111111] dark:hover:text-white">support@eveinventory.in</a></div>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/pricing" className="hover:text-[#111111] dark:hover:text-white transition-colors">Pricing</Link>
          <Link href="/terms" className="hover:text-[#111111] dark:hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-[#111111] dark:hover:text-white transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
