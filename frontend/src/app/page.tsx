"use client";

import Link from "next/link";
import React, { useState } from "react";
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
  TrendingDown,
  Clock,
  Layers,
  Zap,
  Check,
  X,
  Star
} from "lucide-react";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"audit" | "forecast" | "po">("audit");
  const [velocitySpike, setVelocitySpike] = useState(false);
  const [poGenerated, setPoGenerated] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-200">
      {/* Navbar */}
      <header className="w-full bg-white/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-650 rounded-md flex items-center justify-center text-white font-bold tracking-tighter shadow-sm shadow-indigo-650/30">
            E
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">EVE</h1>
        </div>
        <div className="space-x-4">
          <Link href="/login" className="text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Sign In
          </Link>
          <Link 
            href="/signup" 
            className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-all shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-12 flex flex-col items-center justify-center text-center px-6">
        <div className="max-w-4xl space-y-6 relative z-10">
          <div className="inline-flex items-center rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1 text-xs md:text-sm text-slate-800 dark:text-zinc-200">
            <Sparkles className="mr-2 h-4 w-4 text-indigo-500" />
            Inventory Forecasting & Planning Built for Ecommerce Founders
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Stop Guessing. <br />
            <span className="text-indigo-600 dark:text-indigo-400">Start Forecasting.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-650 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            Connect your store in 2 minutes. EVE analyzes sales velocities to predict stockouts, isolate dead stock, and generate size-level reorder recommendations before you lose revenue.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 pt-2">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
              <Link 
                href="/signup" 
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5"
              >
                Analyze My Inventory
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <button 
                onClick={() => {
                  const el = document.getElementById("interactive-demo");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-slate-700 dark:text-zinc-200 bg-white dark:bg-zinc-905 border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                View Interactive Demo
              </button>
            </div>
            
            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-xs text-slate-550 dark:text-zinc-400 font-medium">
              <span className="flex items-center gap-1">
                <Check size={14} className="text-emerald-500" /> Free instant audit
              </span>
              <span className="flex items-center gap-1">
                <Check size={14} className="text-emerald-500" /> No credit card required
              </span>
              <span className="flex items-center gap-1">
                <Check size={14} className="text-emerald-500" /> Connects to Shopify, Amazon & WooCommerce
              </span>
            </div>
          </div>
        </div>

        {/* Backdrop Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Integration Logos & Trust Bar */}
      <section className="border-y border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo labels */}
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-555 uppercase tracking-wider">Direct Integrations</span>
            <div className="flex items-center gap-4 text-sm font-bold text-slate-500 dark:text-zinc-400">
              <span className="opacity-70 hover:opacity-100 transition-opacity">Shopify</span>
              <span className="h-4 w-px bg-slate-300 dark:bg-zinc-800"></span>
              <span className="opacity-70 hover:opacity-100 transition-opacity">Amazon Seller</span>
              <span className="h-4 w-px bg-slate-300 dark:bg-zinc-800"></span>
              <span className="opacity-70 hover:opacity-100 transition-opacity">WooCommerce</span>
              <span className="h-4 w-px bg-slate-300 dark:bg-zinc-800"></span>
              <span className="opacity-70 hover:opacity-100 transition-opacity">BigCommerce</span>
            </div>
          </div>

          {/* Social Proof Stats */}
          <div className="grid grid-cols-3 gap-6 md:gap-12 border-t md:border-t-0 md:border-l border-slate-200 dark:border-zinc-800 pt-6 md:pt-0 md:pl-12 w-full md:w-auto text-center md:text-left">
            <div>
              <div className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">$14.2M+</div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Capital Audited</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">22%</div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-sans">Avg. Excess Freed</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">99.4%</div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Forecast Accuracy</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Product Preview Section */}
      <section id="interactive-demo" className="px-6 py-20 max-w-6xl mx-auto w-full scroll-mt-20">
        <div className="space-y-4 text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Interactive Product Demo</h2>
          <p className="text-slate-650 dark:text-zinc-400 text-sm">
            Click the tabs below to see how EVE solves the inventory headache with automated intelligence.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl overflow-hidden p-4 md:p-6 space-y-6">
          {/* Tab buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-950 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab("audit")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeTab === "audit" ? "bg-white dark:bg-zinc-800 text-indigo-650 dark:text-white shadow-sm" : "text-slate-550 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"}`}
              >
                1. Cash Audit
              </button>
              <button 
                onClick={() => setActiveTab("forecast")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeTab === "forecast" ? "bg-white dark:bg-zinc-800 text-indigo-650 dark:text-white shadow-sm" : "text-slate-550 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"}`}
              >
                2. Stockout Forecast
              </button>
              <button 
                onClick={() => setActiveTab("po")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeTab === "po" ? "bg-white dark:bg-zinc-800 text-indigo-650 dark:text-white shadow-sm" : "text-slate-550 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"}`}
              >
                3. One-Click PO Creator
              </button>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider bg-indigo-50/50 dark:bg-indigo-950/20 px-2.5 py-1 rounded-full">
              <Activity size={12} className="animate-pulse" /> Live Sandbox
            </span>
          </div>

          {/* Tab 1: Cash Audit */}
          {activeTab === "audit" && (
            <div className="grid md:grid-cols-3 gap-6 animate-fade-in">
              <div className="bg-slate-50/50 dark:bg-zinc-950/20 rounded-xl p-5 border border-slate-200 dark:border-zinc-850 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Inventory Health Score</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-white">84</span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-500 flex items-center"><TrendingUp size={14} className="mr-0.5" /> +2.1%</span>
                </div>
                <p className="text-xs text-slate-550 dark:text-zinc-450 leading-relaxed">Overall inventory health is stable. Click on excess to see trapped cash breakdown.</p>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: '84%' }} />
                </div>
              </div>

              <div className="bg-slate-50/50 dark:bg-zinc-950/20 rounded-xl p-5 border border-slate-200 dark:border-zinc-850 shadow-sm space-y-3 col-span-2">
                <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Trapped Excess Capital</h3>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800/80">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Excess Stock Identified</span>
                  <span className="text-xs font-mono font-bold text-red-500">$18,450 trapped</span>
                </div>
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-zinc-400">Cargo Jogger (Olive / M)</span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">$6,400 (140 days of supply)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-zinc-400">Classic Linen Shirt (White / S)</span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">$4,850 (180 days of supply)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-zinc-400">Others (5 SKU variants)</span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">$7,200 (overstocked)</span>
                  </div>
                </div>
                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30 mt-2 font-medium">
                  💡 <strong>EVE Action Plan:</strong> Delay next purchase order by 24 days to recover $11,250 in cash workflow.
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Stockout Forecast */}
          {activeTab === "forecast" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Variant-Level Demand Estimator</h3>
                  <p className="text-xs text-slate-550 dark:text-zinc-400">Simulate velocity spikes to test EVE&apos;s alert response time.</p>
                </div>
                <button 
                  onClick={() => setVelocitySpike(!velocitySpike)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${velocitySpike ? "bg-amber-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
                >
                  {velocitySpike ? "Reset Simulation" : "Simulate 2.5x Velocity Spike"}
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-50/50 dark:bg-zinc-950/20 rounded-xl p-5 border border-slate-200 dark:border-zinc-850 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Dynamic Stockout Alerts</h4>
                  <div className={`p-4 rounded-lg border transition-all ${velocitySpike ? "bg-red-500/5 text-red-650 dark:text-red-400 border-red-500/20" : "bg-amber-500/5 text-amber-600 dark:text-amber-500 border-amber-500/20"}`}>
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 animate-bounce" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold">Classic Cotton Tee (Black / M)</h4>
                        <p className="text-[10px] text-slate-550 dark:text-zinc-405">
                          Current Stock: <span className="font-semibold text-slate-950 dark:text-zinc-150">12 units</span> | Lead time: <span className="font-semibold text-slate-950 dark:text-zinc-150">14 days</span>
                        </p>
                        <p className="text-xs font-bold mt-2">
                          {velocitySpike 
                            ? "🚨 CRITICAL: Stockout in 2 days. Reorder window closed yesterday!" 
                            : "⚠️ WARNING: Stockout in 5 days. Reorder required in 24 hours."
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/50 dark:bg-zinc-950/20 rounded-xl p-5 border border-slate-200 dark:border-zinc-850 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Sales Velocity Profile</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1 font-semibold text-slate-700 dark:text-zinc-300">
                        <span>Standard Velocity</span>
                        <span>2.4 units/day</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-slate-400 h-full rounded-full" style={{ width: '40%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1 font-bold text-slate-900 dark:text-white">
                        <span>Spike Demand Rate</span>
                        <span className={velocitySpike ? "text-red-500 font-extrabold" : "text-slate-500"}>
                          {velocitySpike ? "6.0 units/day" : "2.4 units/day (No Spike)"}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${velocitySpike ? "bg-red-500" : "bg-slate-400"}`} style={{ width: velocitySpike ? '95%' : '40%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: PO Creator */}
          {activeTab === "po" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Draft Supplier Purchase Orders</h3>
                  <p className="text-xs text-slate-550 dark:text-zinc-400">Generate formatted inventory orders ready to send to your factory.</p>
                </div>
                <button 
                  onClick={() => {
                    setPoGenerated(true);
                    setTimeout(() => setPoGenerated(false), 3000);
                  }}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer flex items-center gap-1.5"
                >
                  {poGenerated ? <Check size={14} /> : null}
                  {poGenerated ? "PDF Sheet Exported!" : "Export Factory Order Sheet"}
                </button>
              </div>

              <div className="bg-slate-50/50 dark:bg-zinc-950/20 rounded-xl border border-slate-200 dark:border-zinc-850 overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-100/50 dark:bg-zinc-900/30 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 dark:text-zinc-300">Supplier: Horizon Textworks Ltd.</span>
                  <span className="font-mono text-slate-500">Lead Time: 30 days</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-850 text-slate-550 dark:text-zinc-400 font-bold bg-slate-100/10">
                        <th className="px-5 py-3">Variant SKU</th>
                        <th className="px-5 py-3 text-right">Required Buffer</th>
                        <th className="px-5 py-3 text-right">Target Order</th>
                        <th className="px-5 py-3 text-right">Unit Price</th>
                        <th className="px-5 py-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 font-mono text-slate-700 dark:text-zinc-350">
                      <tr>
                        <td className="px-5 py-3 font-sans font-medium text-slate-900 dark:text-white">Classic Cotton Tee - Black / M</td>
                        <td className="px-5 py-3 text-right">15 units</td>
                        <td className="px-5 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">150 units</td>
                        <td className="px-5 py-3 text-right">$4.20</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-white">$630.00</td>
                      </tr>
                      <tr>
                        <td className="px-5 py-3 font-sans font-medium text-slate-900 dark:text-white">Heavyweight Hoodie - Gray / L</td>
                        <td className="px-5 py-3 text-right">10 units</td>
                        <td className="px-5 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">100 units</td>
                        <td className="px-5 py-3 text-right">$8.50</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-white">$850.00</td>
                      </tr>
                      <tr className="bg-slate-100/20 dark:bg-zinc-950/20 font-bold">
                        <td colSpan={4} className="px-5 py-3 font-sans text-right text-slate-900 dark:text-white">Total Order Value:</td>
                        <td className="px-5 py-3 text-right text-indigo-650 dark:text-indigo-400">$1,480.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Head-to-Head Comparison: Spreadsheets vs EVE */}
      <section className="px-6 py-20 bg-white dark:bg-zinc-900 border-y border-slate-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Spreadsheets vs. EVE</h2>
            <p className="text-slate-650 dark:text-zinc-400 text-sm max-w-xl mx-auto">
              Why static tables and formulas drain your cash, and how inventory intelligence fixes it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Spreadsheets card */}
            <div className="bg-slate-50 dark:bg-zinc-950 p-6 rounded-2xl border border-slate-200 dark:border-zinc-850 space-y-4">
              <div className="flex items-center gap-2 text-red-500">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <X size={18} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Traditional Excel & Google Sheets</h3>
              </div>
              <ul className="space-y-3 text-xs text-slate-650 dark:text-zinc-400 font-medium">
                <li className="flex items-start gap-2.5">
                  <X size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <span><strong>10+ hours a week:</strong> Downloading sales files, mapping variant IDs, and correcting format errors manually.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <X size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Reactive alerts:</strong> You find out a bestseller is out of stock only when your Shopify inventory hits zero.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <X size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Guesswork:</strong> Reordering general quantities instead of size-specific variants, creating excess dead stock.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <X size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Disconnected lead times:</strong> Reorder formulas fail to adjust to actual factory delays or shipping backlogs.</span>
                </li>
              </ul>
            </div>

            {/* EVE card */}
            <div className="bg-indigo-50/30 dark:bg-indigo-950/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-4">
              <div className="flex items-center gap-2 text-indigo-650 dark:text-indigo-400">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <Check size={18} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">EVE Inventory Intelligence</h3>
              </div>
              <ul className="space-y-3 text-xs text-slate-650 dark:text-zinc-350 font-medium">
                <li className="flex items-start gap-2.5">
                  <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Real-time automation:</strong> Syncs directly with store APIs, updating sales velocity profiles every hour automatically.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Proactive forecasting:</strong> Alerts you weeks before stock runs out, incorporating lead times and safety buffer goals.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Size-level recommendations:</strong> Suggests exact order volumes for S/M/L variants so you buy exactly what sells.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span><strong>One-click supplier sheets:</strong> Autogenerates factory-ready order specifications, reducing purchase errors.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof: Founder Testimonials */}
      <section className="px-6 py-20 max-w-5xl mx-auto w-full space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Trusted by Ecommerce Founders</h2>
          <p className="text-slate-650 dark:text-zinc-400 text-sm max-w-xl mx-auto">
            See how scaling brands use EVE to release trapped cash and eliminate stockouts.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Testimonial 1 */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex gap-0.5 text-amber-500">
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
              </div>
              <p className="text-xs text-slate-650 dark:text-zinc-350 italic leading-relaxed">
                &ldquo;EVE predicted a stockout on our bestseller black linen shirt 3 weeks before it happened. The safety reorder recommendation saved us at least $12,000 in lost revenue.&rdquo;
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/80">
              <div className="text-xs font-bold text-slate-900 dark:text-white">Sarah K.</div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-550">Founder, Lumina Apparel (6-figure store)</div>
            </div>
          </div>

          {/* Testimonial 2 */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex gap-0.5 text-amber-500">
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
              </div>
              <p className="text-xs text-slate-650 dark:text-zinc-350 italic leading-relaxed">
                &ldquo;We used to keep $50,000 in excess buffer inventory. EVE flagged overstocked sizes, allowing us to defer POs and free up $18,000 in dry capital within 14 days.&rdquo;
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/80">
              <div className="text-xs font-bold text-slate-900 dark:text-white">Marcus D.</div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-555">COO, Nomad Essentials (7-figure brand)</div>
            </div>
          </div>

          {/* Testimonial 3 */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4 shadow-sm flex flex-col justify-between md:col-span-2 lg:col-span-1">
            <div className="space-y-2">
              <div className="flex gap-0.5 text-amber-500">
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
                <Star size={16} fill="currentColor" />
              </div>
              <p className="text-xs text-slate-650 dark:text-zinc-350 italic leading-relaxed">
                &ldquo;I spent every Sunday night copy-pasting numbers from Shopify CSVs to spreadsheets. EVE does it dynamically, creating factory sheets in under 5 minutes.&rdquo;
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/80">
              <div className="text-xs font-bold text-slate-900 dark:text-white">Elena R.</div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-555">Founder, Bloom Cosmetics</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Inventory Insights Section */}
      <section className="px-6 py-20 bg-slate-100/50 dark:bg-zinc-950/20 border-t border-slate-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Core Inventory Insights</h2>
            <p className="text-slate-650 dark:text-zinc-400 text-sm max-w-xl mx-auto">
              Everything you need to predict supply needs and safeguard margins.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl space-y-3 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Predictive Stockout Alerts</h3>
              <p className="text-xs text-slate-650 dark:text-zinc-400 leading-relaxed">
                EVE monitors variant-level sales velocities daily. The moment a bestseller shows accelerated demand relative to lead times, an alert is triggered outlining unit deficit and reorder deadline.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl space-y-3 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Trapped Capital Calculator</h3>
              <p className="text-xs text-slate-650 dark:text-zinc-400 leading-relaxed">
                Scan your warehouses instantly for excess items trapping cash. Get actionable recommendations to defer next PO drafts, run targeted size promos, or renegotiate minimum order quantities.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl space-y-3 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Automated Supplier Planning</h3>
              <p className="text-xs text-slate-650 dark:text-zinc-400 leading-relaxed">
                Upload factory price lists and lead times. EVE matches historical velocity data to automate reorder sheets, aligning recommendations perfectly with supplier shipping requirements.
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl space-y-3 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Document Intelligence</h3>
              <p className="text-xs text-slate-650 dark:text-zinc-400 leading-relaxed">
                Upload supplier invoices or packing lists. EVE extracts products, volumes, and costs, cross-referencing them against your inventory records to verify accuracy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-24 text-center max-w-4xl mx-auto space-y-8">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          See What&apos;s Inside Your Inventory
        </h2>
        <p className="text-base md:text-lg text-slate-650 dark:text-zinc-300 max-w-xl mx-auto leading-relaxed">
          Create your workspace and run a free 2-minute scan to discover overstock, stockouts, and capital recovery pathways.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 pt-2">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Link 
              href="/signup" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 group"
            >
              Analyze My Inventory
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link 
              href="/login" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-medium text-slate-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-955 transition-all hover:-translate-y-0.5"
            >
              Sign In
            </Link>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-550 dark:text-zinc-400 font-medium">
            <span className="flex items-center gap-1">
              <Check size={14} className="text-emerald-500" /> Free scan & setup
            </span>
            <span className="flex items-center gap-1">
              <Check size={14} className="text-emerald-500" /> Connects instantly
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 px-6 py-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 dark:text-zinc-450 gap-4">
        <div>
          &copy; {new Date().getFullYear()} EVE. All rights reserved.
        </div>
        <div className="space-x-4">
          <Link href="/terms" className="hover:text-slate-800 dark:hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-slate-800 dark:hover:text-white transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
