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
      {/* Premium Hero System Wrapper (Navbar + Hero) */}
      <div className="premium-hero-context w-full flex flex-col">
        {/* Navbar */}
        <header className="w-full premium-navbar px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-[#4F46E5] rounded-md flex items-center justify-center text-white font-bold tracking-tighter shadow-sm">
              EVE
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              <span className="logo-text text-[#818cf8]">EVE</span> <span className="logo-subtext hidden md:inline text-white">| Inventory Intelligence</span>
            </h1>
          </div>
          
          {/* Desktop Navbar Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/pricing" className="text-sm font-semibold transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="text-sm font-semibold transition-colors">
              Sign In
            </Link>
            <Link 
              href="/signup" 
              className="text-sm font-semibold bg-[#4F46E5] hover:bg-[#4F46E5] px-4 py-2 rounded-lg transition-all shadow-md text-white"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-zinc-400 hover:text-white focus:outline-none"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Mobile Navigation Drawer / Dropdown */}
          {mobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 premium-mobile-menu border-b border-[#E5E7EB] dark:border-zinc-800 p-6 flex flex-col gap-4 shadow-xl z-50 md:hidden">
              <Link 
                href="/pricing" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold transition-colors py-1"
              >
                Pricing
              </Link>
              <Link 
                href="/login" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold transition-colors py-1"
              >
                Sign In
              </Link>
              <Link 
                href="/signup" 
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center text-sm font-semibold bg-[#4F46E5] hover:bg-[#4F46E5] py-3 rounded-lg transition-all shadow-md text-white"
              >
                Get Started
              </Link>
            </div>
          )}
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-24 sm:pt-24 sm:pb-32 flex flex-col items-center justify-center text-center px-4 sm:px-6">
          {/* Depth Layers */}
          <div className="hero-premium-bg" />
          <div className="hero-stars" />
          <div className="hero-ambient-glow" />
          <div className="hero-horizon" />

          {/* Content Layer */}
          <div className="max-w-4xl space-y-6 sm:space-y-8 relative z-10">
            <div className="inline-flex items-center rounded-full sparkles-tag px-3.5 py-1 text-xs sm:text-sm font-medium shadow-sm">
              <Sparkles className="mr-2 h-4 w-4" />
              <span>Inventory Forecasting & Planning Built for Ecommerce Founders, D2C & Apparel Brands</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
              Stop Guessing. <br />
              <span className="forecast-gradient">Start Forecasting.</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl subtitle-desc max-w-2xl mx-auto leading-relaxed">
              EVE predicts stockouts, identifies dead stock, and generates size-level reorder recommendations so founder-led ecommerce, D2C, and apparel brands can reclaim trapped working capital and scale with confidence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full max-w-md mx-auto sm:max-w-none">
              <Link 
                href="/signup" 
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold btn-primary-glow rounded-lg transition-all"
              >
                Analyze My Inventory
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link 
                href="/demo" 
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-medium btn-secondary-tint rounded-lg transition-all"
              >
                View Example Insights
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Shared atmosphere container for seamless transition */}
      <div className="shared-preview-pain-points w-full flex flex-col relative z-20">
        
        {/* Product Preview Section */}
        <section className="px-4 sm:px-6 pb-12 sm:pb-16 max-w-6xl mx-auto w-full relative z-10 -mt-6">
          <div className="preview-window p-4 sm:p-6 md:p-8 space-y-6">
          {/* OS Titlebar */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ef4444]/80" />
              <span className="w-3 h-3 rounded-full bg-[#f59e0b]/80" />
              <span className="w-3 h-3 rounded-full bg-[#10b981]/80" />
              <span className="text-xs text-zinc-400 font-mono ml-2">EVE.app — Executive Inventory Workspace</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#c084fc] bg-purple-950/30 border border-purple-800/35 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              <Activity size={12} className="animate-pulse text-[#c084fc]" /> Live Analysis Active
            </div>
          </div>

          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Inventory Health Score */}
            <div className="preview-card p-5 space-y-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Inventory Health Score</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-white">88%</span>
                <span className="text-xs font-semibold text-emerald-400 flex items-center"><TrendingUp size={12} className="mr-0.5" /> +4.2%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: '88%' }} />
              </div>
              <p className="text-[10px] text-zinc-400">Excellent range. Up from 83.8% last month.</p>
            </div>

            {/* Stockout Risk */}
            <div className="preview-card p-5 space-y-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Stockout Risk</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-white">2 SKUs</span>
                <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">High Alert</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-rose-550 rounded-full" style={{ width: '15%' }} />
              </div>
              <p className="text-[10px] text-zinc-400">Classic Cotton Tee will deplete in 5 days.</p>
            </div>

            {/* Dead Stock Value */}
            <div className="preview-card p-5 space-y-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Dead Stock Value</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-white">$18,450</span>
                <span className="text-xs font-semibold text-amber-405 bg-amber-500/10 px-1.5 py-0.5 rounded">26% Total Asset</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-amber-550 rounded-full" style={{ width: '26%' }} />
              </div>
              <p className="text-[10px] text-zinc-400">3 Excess variant categories flagged (Cargo Jogger).</p>
            </div>

            {/* Working Capital Recovered */}
            <div className="preview-card p-5 space-y-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">Capital Recovered</span>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-emerald-400">$14,200</span>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Active Liquidation</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
              </div>
              <p className="text-[10px] text-zinc-400">Recovered via smart variant cleared campaigns.</p>
            </div>
          </div>

          {/* Double Column Area */}
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Executive Insights Feed */}
            <div className="lg:col-span-5 preview-card p-5 space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Executive Insights</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/15">
                    <span className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 status-pulse-purple" />
                    <div>
                      <p className="text-xs font-bold text-white">3 bestselling SKUs at risk of stockout</p>
                      <p className="text-[10px] text-zinc-400">Replenish Classic Cotton Tee (Black/M, L) within 5 days to avoid $6.2k revenue deficit.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5" />
                    <div>
                      <p className="text-xs font-bold text-white">$14,200 trapped capital identified</p>
                      <p className="text-[10px] text-zinc-400">Cargo Jogger (Navy/XL) has 180+ days velocity. Clearance campaign suggested.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/15">
                    <span className="h-2 w-2 rounded-full bg-purple-500 mt-1.5" />
                    <div>
                      <p className="text-xs font-bold text-white">Reorder recommendation generated</p>
                      <p className="text-[10px] text-zinc-400">Factory orders optimized for 30-day transit lead times with supplier PO matching.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5" />
                    <div>
                      <p className="text-xs font-bold text-white">Inventory health improved by 12%</p>
                      <p className="text-[10px] text-zinc-400">Overall stockturn increased from 3.1x to 4.4x due to dead stock optimization.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visualizations Column */}
            <div className="lg:col-span-7 grid md:grid-cols-2 gap-4">
              {/* Health Trend Chart */}
              <div className="preview-card p-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Health & Stock Turn Trend</h4>
                  <p className="text-[10px] text-zinc-500">6-Month historical projection</p>
                </div>
                <div className="h-32 w-full mt-2 relative">
                  {/* Custom SVG Line Chart */}
                  <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="gradient-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    <line x1="0" y1="25" x2="200" y2="25" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    <line x1="0" y1="50" x2="200" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    <line x1="0" y1="75" x2="200" y2="75" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    {/* Gradient Fill */}
                    <path
                      d="M 0 80 Q 25 70, 50 65 T 100 50 T 150 35 T 200 15 L 200 100 L 0 100 Z"
                      fill="url(#gradient-area)"
                      className="chart-area-fade"
                    />
                    {/* Chart Line */}
                    <path
                      d="M 0 80 Q 25 70, 50 65 T 100 50 T 150 35 T 200 15"
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="chart-line-draw"
                    />
                    {/* Dots */}
                    <circle cx="100" cy="50" r="3" fill="#a855f7" stroke="#ffffff" strokeWidth="1" />
                    <circle cx="200" cy="15" r="3" fill="#a855f7" stroke="#ffffff" strokeWidth="1" />
                  </svg>
                  <div className="absolute top-2 right-2 text-[10px] font-bold text-white bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.5 rounded">
                    88% Target Reached
                  </div>
                </div>
                <div className="flex justify-between text-[9px] text-zinc-500 font-mono mt-1">
                  <span>Jan</span>
                  <span>Mar</span>
                  <span>May</span>
                  <span>Jul (Now)</span>
                </div>
              </div>

              {/* Stock Distribution & Reorder Impact */}
              <div className="preview-card p-4 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Capital Distribution</h4>
                  <p className="text-[10px] text-zinc-500">Allocation breakdown of total assets</p>
                </div>
                <div className="space-y-3">
                  <div>
                     <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                       <span>Healthy Stock ($48,320)</span>
                       <span className="font-bold text-white">66%</span>
                     </div>
                     <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-purple-500 rounded-full" style={{ width: '66%' }} />
                     </div>
                  </div>
                  <div>
                     <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                       <span>Stockout Deficit Risk ($6,150)</span>
                       <span className="font-bold text-rose-450">8%</span>
                     </div>
                     <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-rose-500 rounded-full" style={{ width: '8%' }} />
                     </div>
                  </div>
                  <div>
                     <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                       <span>Trapped Excess ($18,450)</span>
                       <span className="font-bold text-amber-450">26%</span>
                     </div>
                     <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-amber-500 rounded-full" style={{ width: '26%' }} />
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table Mockup */}
          <div className="preview-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.08] bg-white/[0.01] flex justify-between items-center">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Smart Reorder Recommendations</h4>
              <span className="text-[10px] text-zinc-500 font-mono">4 active alerts matching lead times</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/[0.08] text-zinc-400 font-semibold bg-white/[0.02]">
                    <th className="px-5 py-3.5">Product SKU</th>
                    <th className="px-5 py-3.5 text-right">Current Stock</th>
                    <th className="px-5 py-3.5 text-right">Velocity</th>
                    <th className="px-5 py-3.5 text-right">Est. Depletion</th>
                    <th className="px-5 py-3.5 text-right text-purple-400">Reorder Suggestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-zinc-255 font-mono bg-white/[0.005]">
                  <tr>
                    <td className="px-5 py-4 font-sans font-medium text-white">Classic Cotton Tee - Black / M</td>
                    <td className="px-5 py-4 text-right">12 units</td>
                    <td className="px-5 py-4 text-right">2.4 / day</td>
                    <td className="px-5 py-4 text-right"><span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">5 Days</span></td>
                    <td className="px-5 py-4 text-right text-purple-400 font-bold">150 units <span className="text-[9px] text-zinc-550 block font-normal">Factory orders matching MOQ</span></td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 font-sans font-medium text-white">Classic Cotton Tee - Black / L</td>
                    <td className="px-5 py-4 text-right">18 units</td>
                    <td className="px-5 py-4 text-right">3.1 / day</td>
                    <td className="px-5 py-4 text-right"><span className="text-rose-450 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">6 Days</span></td>
                    <td className="px-5 py-4 text-right text-purple-400 font-bold">200 units <span className="text-[9px] text-zinc-550 block font-normal">Expedited PO shipping needed</span></td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 font-sans font-medium text-white">Heavyweight Hoodie - Gray / L</td>
                    <td className="px-5 py-4 text-right">8 units</td>
                    <td className="px-5 py-4 text-right">1.6 / day</td>
                    <td className="px-5 py-4 text-right"><span className="text-rose-450 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">3 Days</span></td>
                    <td className="px-5 py-4 text-right text-purple-400 font-bold">100 units <span className="text-[9px] text-zinc-550 block font-normal">Urgent sea freight trigger</span></td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 font-sans font-medium text-white">Cargo Jogger - Navy / XL</td>
                    <td className="px-5 py-4 text-right">342 units</td>
                    <td className="px-5 py-4 text-right">0.8 / day</td>
                    <td className="px-5 py-4 text-right"><span className="text-emerald-450 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">180+ Days</span></td>
                    <td className="px-5 py-4 text-right text-amber-450 font-bold">Hold Order <span className="text-[9px] text-zinc-550 block font-normal">Overstocked: promo target active</span></td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 font-sans font-medium text-white">Essential Crewneck - White / M</td>
                    <td className="px-5 py-4 text-right">85 units</td>
                    <td className="px-5 py-4 text-right">4.5 / day</td>
                    <td className="px-5 py-4 text-right"><span className="text-amber-450 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded">18 Days</span></td>
                    <td className="px-5 py-4 text-right text-purple-400 font-bold">300 units <span className="text-[9px] text-zinc-550 block font-normal">Regular replenishment cycle</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Transition Divider & Connection Glow */}
      <div className="relative w-full py-4 flex flex-col items-center">
        <div className="section-fade-divider" />
        <div className="transition-connector" />
      </div>

      {/* Pain Points Section */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 relative z-10">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">The Three Flaws in Standard Inventory Planning</h2>
            <p className="text-xs sm:text-sm max-w-xl mx-auto pain-point-desc">
              How guesswork, static tables, and lag times eat away at ecommerce margins.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="pain-point-card pain-point-card-red p-6 space-y-4">
              <div className="h-10 w-10 bg-red-550/10 border border-red-500/25 text-red-400 rounded-lg flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold">Unplanned Bestseller Stockouts</h3>
              <p className="text-xs pain-point-desc leading-relaxed">
                Losing revenue when velocity spikes and suppliers have a 30-day lead time. EVE warns you weeks in advance so you can replenish before the stock hits zero.
              </p>
            </div>

            <div className="pain-point-card pain-point-card-amber p-6 space-y-4">
              <div className="h-10 w-10 bg-amber-550/10 border border-amber-500/25 text-amber-400 rounded-lg flex items-center justify-center">
                <DollarSign size={20} />
              </div>
              <h3 className="text-base font-bold">Trapped Cash in Overstock</h3>
              <p className="text-xs pain-point-desc leading-relaxed">
                Tying up thousands of dollars in slow-moving colors and sizes. EVE isolates excess units and suggests liquidation schedules or production delays.
              </p>
            </div>

            <div className="pain-point-card pain-point-card-indigo p-6 space-y-4">
              <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 rounded-lg flex items-center justify-center">
                <Package size={20} />
              </div>
              <h3 className="text-base font-bold">Spreadsheet Inaccuracy</h3>
              <p className="text-xs pain-point-desc leading-relaxed">
                Manually downloading sales records, mapping variants, and guessing sizes. EVE does the math dynamically, mapping variants, velocities, and lead times.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Transition Divider & Connection Glow */}
      <div className="relative w-full py-4 flex flex-col items-center">
        <div className="section-fade-divider" />
        <div className="transition-connector" />
      </div>

      {/* Outcome-focused capabilities */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 max-w-5xl mx-auto w-full space-y-12 relative z-10">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Core Inventory Insights</h2>
          <p className="text-xs sm:text-sm max-w-xl mx-auto pain-point-desc">
            Everything you need to predict supply needs and safeguard margins.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="insight-card p-6 space-y-4">
            <div className="h-10 w-10 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-base font-bold">Predictive Stockout Alerts</h3>
            <p className="text-xs pain-point-desc leading-relaxed">
              EVE monitors variant-level sales velocities daily. The moment a bestseller shows accelerated demand relative to lead times, an alert is triggered outlining unit deficit and reorder deadline.
            </p>
          </div>

          <div className="insight-card p-6 space-y-4">
            <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-lg flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <h3 className="text-base font-bold">Trapped Capital Calculator</h3>
            <p className="text-xs pain-point-desc leading-relaxed">
              Scan your warehouses instantly for excess items trapping cash. Get actionable recommendations to defer next PO drafts, run targeted size promos, or renegotiate minimum order quantities.
            </p>
          </div>

          <div className="insight-card p-6 space-y-4">
            <div className="h-10 w-10 bg-purple-500/10 border border-purple-500/25 text-[#a78bfa] rounded-lg flex items-center justify-center">
              <Package size={20} />
            </div>
            <h3 className="text-base font-bold">Automated Supplier Planning</h3>
            <p className="text-xs pain-point-desc leading-relaxed">
              Upload factory price lists and lead times. EVE matches historical velocity data to automate reorder sheets, aligning recommendations perfectly with supplier shipping requirements.
            </p>
          </div>

          <div className="insight-card p-6 space-y-4">
            <div className="h-10 w-10 bg-blue-550/10 border border-blue-500/25 text-blue-400 rounded-lg flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <h3 className="text-base font-bold">Document Intelligence</h3>
            <p className="text-xs pain-point-desc leading-relaxed">
              Upload supplier invoices or packing lists. EVE extracts products, volumes, and costs, cross-referencing them against your inventory records to verify accuracy.
            </p>
          </div>
        </div>
      </section>

      {/* Transition Divider & Connection Glow */}
      <div className="relative w-full py-4 flex flex-col items-center">
        <div className="section-fade-divider" />
        <div className="transition-connector" />
      </div>

      {/* 3-step Workflow */}
      <section className="px-4 sm:px-6 py-12 sm:py-16 relative z-10">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">The 3-Step Inventory Workflow</h2>
            <p className="text-xs sm:text-sm max-w-xl mx-auto pain-point-desc">
              How EVE processes raw spreadsheets and supplier files into margin-saving recommendations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Desktop Connective Flow Line */}
            <div className="hidden md:block absolute top-[36px] left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-purple-500/25 to-transparent z-0" />

            {/* Step 1 */}
            <div className="insight-card p-6 space-y-4 relative z-10">
              <span className="absolute top-4 right-4 text-[9px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Step 01</span>
              <div className="h-10 w-10 bg-purple-500/10 border border-purple-500/25 text-[#a78bfa] rounded-lg flex items-center justify-center relative z-10">
                <Upload size={18} />
              </div>
              <h3 className="text-sm font-bold text-white">Upload Data</h3>
              <p className="text-xs pain-point-desc leading-relaxed">
                Drag and drop your variants, stock levels, or supplier invoice lists into the document hub.
              </p>
            </div>

            {/* Step 2 */}
            <div className="insight-card p-6 space-y-4 relative z-10">
              <span className="absolute top-4 right-4 text-[9px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Step 02</span>
              <div className="h-10 w-10 bg-purple-500/10 border border-purple-500/25 text-[#a78bfa] rounded-lg flex items-center justify-center relative z-10">
                <Activity size={18} />
              </div>
              <h3 className="text-sm font-bold text-white">Scan Health</h3>
              <p className="text-xs pain-point-desc leading-relaxed">
                EVE reconciles columns, calculates variant sales velocity, and flags overstock or stockout dates.
              </p>
            </div>

            {/* Step 3 */}
            <div className="insight-card p-6 space-y-4 relative z-10">
              <span className="absolute top-4 right-4 text-[9px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Step 03</span>
              <div className="h-10 w-10 bg-purple-500/10 border border-purple-500/25 text-[#a78bfa] rounded-lg flex items-center justify-center relative z-10">
                <CheckCircle size={18} />
              </div>
              <h3 className="text-sm font-bold text-white">Reorder Recommendations</h3>
              <p className="text-xs pain-point-desc leading-relaxed">
                Get size-level purchase order suggestions tailored to your actual lead times.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-4 sm:px-6 py-20 sm:py-24 text-center overflow-hidden">
        {/* Ambient Glow behind CTA */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="w-[500px] h-[300px] bg-purple-500/10 rounded-full filter blur-[120px] opacity-60" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-8">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Start Using EVE
          </h2>
          <p className="text-sm sm:text-base md:text-lg pain-point-desc max-w-xl mx-auto leading-relaxed">
            Create your workspace and begin analyzing your inventory.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full max-w-md mx-auto sm:max-w-none">
            <Link 
              href="/signup" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold btn-primary-glow rounded-lg transition-all"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link 
              href="/demo" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-medium btn-secondary-tint rounded-lg transition-all"
            >
              View Example Insights
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-transparent border-t border-white/[0.08] px-4 sm:px-6 py-8 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-400 gap-4 relative z-10">
        <div className="text-center md:text-left space-y-1">
          <div>&copy; {new Date().getFullYear()} EVE. All rights reserved.</div>
          <div className="text-zinc-550">Questions? <a href="mailto:support@eveinventory.in" className="text-zinc-300 hover:text-white transition-colors">support@eveinventory.in</a></div>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/pricing" className="text-zinc-300 hover:text-white transition-colors">Pricing</Link>
          <Link href="/terms" className="text-zinc-300 hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="text-zinc-300 hover:text-white transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  </div>
  );
}
