"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Upload, 
  Activity, 
  Package, 
  DollarSign,
  Menu,
  X,
  ShieldCheck,
  Layers,
  FileText,
  Brain,
  ChevronDown,
  ChevronUp,
  Zap,
  Lock,
  RefreshCw,
  Building2,
  Users,
  BarChart3
} from "lucide-react";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "inventory" | "traceability">("inventory");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "How quickly can I set up EVE for my brand?",
      a: "Setup takes less than 2 minutes. You can upload any variant inventory CSV, connect via Shopify, or integrate via API. EVE immediately parses columns, reconciles SKU quantities, and surfaces stockout risks."
    },
    {
      q: "Does EVE replace my existing e-commerce store or ERP?",
      a: "No. EVE acts as an executive intelligence layer on top of your existing setup (Shopify, WooCommerce, ERPs, or custom warehouses), transforming raw stock lists into proactive reorder plans and cash flow forecasts."
    },
    {
      q: "How does EVE predict stockout depletion dates?",
      a: "EVE analyzes historical daily sales velocities for every SKU and size variant, factors in supplier lead times and minimum order quantities (MOQs), and alerts you before stock runs out."
    },
    {
      q: "What is Decision Traceability and why is it important?",
      a: "Decision Traceability gives you 100% transparency into every AI recommendation. You can inspect the exact evidence datasets, math formulas, confidence scores, and business rules behind every advice before taking action."
    },
    {
      q: "Is my proprietary business and customer data secure?",
      a: "Yes. EVE adheres to strict SOC2 and GDPR compliance guidelines with enterprise-grade encryption in transit and at rest. Your data is isolated per workspace and is never used to train shared public AI models."
    }
  ];

  return (
    <div className="landing-page min-h-screen bg-white dark:bg-[#070a14] text-foreground flex flex-col font-sans transition-colors duration-200">
      
      {/* 1. Header Navigation */}
      <header className="w-full border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-md shadow-violet-500/20">
              EVE
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-1.5">
                EVE <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">OS 2.0</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">Executive Operating System</span>
            </div>
          </div>
          
          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Capabilities</a>
            <a href="#traceability" className="hover:text-foreground transition-colors">Decision Traceability</a>
            <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>

          {/* Action Triggers */}
          <div className="hidden md:flex items-center gap-3">
            <Link 
              href="/login" 
              className="text-xs font-semibold px-4 py-2 text-foreground hover:text-primary transition-colors"
            >
              Sign In
            </Link>
            <Link 
              href="/signup" 
              className="text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-4.5 py-2 rounded-xl transition-all shadow-xs"
            >
              Start 14-Day Free Trial
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground focus:outline-none"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border bg-card p-6 flex flex-col gap-4 animate-fade-in">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">Capabilities</a>
            <a href="#traceability" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">Decision Traceability</a>
            <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">Workflow</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">FAQ</a>
            <div className="pt-4 border-t border-border flex flex-col gap-2.5">
              <Link href="/login" className="w-full text-center text-xs font-semibold py-2.5 rounded-xl border border-border text-foreground">Sign In</Link>
              <Link href="/signup" className="w-full text-center text-xs font-semibold bg-primary text-primary-foreground py-2.5 rounded-xl shadow-xs">Start 14-Day Free Trial</Link>
            </div>
          </div>
        )}
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 flex flex-col items-center text-center px-4 sm:px-6">
        <div className="max-w-4xl space-y-6 sm:space-y-8 relative z-10">
          
          {/* Release Banner Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>EVE 2.0 Released: Autonomous Decision Traceability & Replenishment</span>
            <ArrowRight className="h-3 w-3" />
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] text-foreground">
            The Executive Operating System <br />
            <span className="bg-gradient-to-r from-violet-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
              for E-Commerce Founders
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Predict stockout dates, isolate dead stock capital, and automate supplier purchase orders with sub-second decision traceability. Built for e-commerce CEOs, D2C brands, and apparel retailers.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 w-full max-w-md mx-auto sm:max-w-none">
            <Link 
              href="/signup" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md shadow-primary/25 cursor-pointer"
            >
              Start 14-Day Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link 
              href="/demo" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border rounded-xl transition-all cursor-pointer"
            >
              Explore Live Interactive Demo
            </Link>
          </div>

          <p className="text-xs text-muted-foreground font-medium">
            No credit card required • 2-minute setup • Connects via CSV, Shopify, or API
          </p>
        </div>
      </section>

      {/* 3. Executive Credibility & Proof Strip */}
      <section className="border-y border-border/60 bg-muted/30 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">Sub-Second</div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Decision Traceability Sync</div>
          </div>
          <div className="space-y-1">
            <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">100%</div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Audit Trail Evidence</div>
          </div>
          <div className="space-y-1">
            <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">Variant-Level</div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Size & Color Velocity Math</div>
          </div>
          <div className="space-y-1">
            <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">&lt; 2 min</div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Setup & Data Ingestion</div>
          </div>
        </div>
      </section>

      {/* 4. Interactive Live Product Preview Shell */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">Interactive Application Preview</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Experience EVE Before You Sign Up
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
            Switch between modules to inspect how EVE optimizes inventory, delivers operational commands, and audits decision reasoning.
          </p>
          <div className="inline-block px-3 py-1 rounded-full bg-muted border border-border text-[10px] text-muted-foreground font-medium">
            * Interactive interface displaying sample e-commerce brand dataset
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center">
          <div className="inline-flex p-1.5 rounded-xl bg-muted/60 border border-border gap-1">
            <button
              onClick={() => setActiveTab("inventory")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "inventory"
                  ? "bg-card text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📦 Inventory Intelligence
            </button>
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "overview"
                  ? "bg-card text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ⚡ Operations Overview
            </button>
            <button
              onClick={() => setActiveTab("traceability")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "traceability"
                  ? "bg-card text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🔍 Decision Traceability
            </button>
          </div>
        </div>

        {/* Window Mockup */}
        <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
          {/* OS Window Header */}
          <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="text-xs font-mono text-muted-foreground ml-2">app.eveinventory.in/dashboard/{activeTab}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Activity size={10} className="animate-pulse" /> Live Workspace Synced
            </span>
          </div>

          {/* Tab Content Display */}
          <div className="p-6 sm:p-8 space-y-6">
            {activeTab === "inventory" && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-xl bg-muted/30 border border-border space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inventory Valuation (COGS)</span>
                    <div className="text-2xl sm:text-3xl font-extrabold text-foreground">$148,320</div>
                    <span className="text-[11px] text-emerald-500 font-semibold">Healthy Capital Ratio</span>
                  </div>
                  <div className="p-5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-rose-500">Stockout Risk SKUs</span>
                    <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">2 SKUs</div>
                    <span className="text-[11px] text-rose-500 font-semibold">Depleting within 5 days</span>
                  </div>
                  <div className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">Dead Stock Capital</span>
                    <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">$18,450</div>
                    <span className="text-[11px] text-amber-500 font-semibold">Trapped in non-moving variants</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Variant Replenishment Suggestions</h4>
                    <span className="text-[10px] text-muted-foreground">Updated by EVE just now</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[550px]">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground font-semibold">
                          <th className="py-2.5 px-3">Variant SKU</th>
                          <th className="py-2.5 px-3 text-right">Current Units</th>
                          <th className="py-2.5 px-3 text-right">Daily Velocity</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                          <th className="py-2.5 px-3 text-right">Suggested Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50 text-foreground">
                        <tr>
                          <td className="py-3 px-3 font-medium">Classic Cotton Tee — Black / M</td>
                          <td className="py-3 px-3 text-right font-mono">12 units</td>
                          <td className="py-3 px-3 text-right font-mono">2.4 / day</td>
                          <td className="py-3 px-3 text-right"><span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">5 Days Left</span></td>
                          <td className="py-3 px-3 text-right font-bold text-primary">Reorder 150 units</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-3 font-medium">Cargo Jogger — Navy / XL</td>
                          <td className="py-3 px-3 text-right font-mono">342 units</td>
                          <td className="py-3 px-3 text-right font-mono">0.8 / day</td>
                          <td className="py-3 px-3 text-right"><span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">180+ Days</span></td>
                          <td className="py-3 px-3 text-right font-bold text-amber-500">Hold PO / Clearance</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "overview" && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">Portfolio Clients</span>
                    <div className="text-2xl font-bold text-foreground">24 Active</div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">Active Projects</span>
                    <div className="text-2xl font-bold text-foreground">12 In Flight</div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">Task Velocity</span>
                    <div className="text-2xl font-bold text-emerald-500">92% Delivered</div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">Net Profit Margin</span>
                    <div className="text-2xl font-bold text-emerald-500">$34,800</div>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-muted/30 border border-border space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Today's Founder Operational Priorities</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-card rounded-lg border border-border text-xs space-y-1">
                      <span className="font-semibold text-foreground">Project Milestone Delivery</span>
                      <p className="text-muted-foreground text-[11px]">3 deliverable targets scheduled for completion today.</p>
                    </div>
                    <div className="p-3 bg-card rounded-lg border border-border text-xs space-y-1">
                      <span className="font-semibold text-foreground">Client Account Review</span>
                      <p className="text-muted-foreground text-[11px]">Client SLA metrics operating in optimal range.</p>
                    </div>
                    <div className="p-3 bg-card rounded-lg border border-border text-xs space-y-1">
                      <span className="font-semibold text-foreground">Financial Ledger Sync</span>
                      <p className="text-muted-foreground text-[11px]">Recent revenue entries reconciled with bank records.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "traceability" && (
              <div className="space-y-6 animate-fade-in">
                <div className="p-5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Decision Governance Record #REC-8942</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">VALIDATED</span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Reorder 150 units of Classic Cotton Tee (Black / M)</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Stock level evaluated below 5-day safety threshold. Projected depletion on July 27th with supplier lead time of 7 days.
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-2.5 bg-card rounded-lg border border-border text-xs">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Confidence Score</span>
                      <span className="font-bold text-emerald-500 mt-0.5 block">98% High Confidence</span>
                    </div>
                    <div className="p-2.5 bg-card rounded-lg border border-border text-xs">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Estimated Financial Impact</span>
                      <span className="font-bold text-foreground mt-0.5 block">$6,200 Revenue Safeguarded</span>
                    </div>
                    <div className="p-2.5 bg-card rounded-lg border border-border text-xs">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Business Trigger</span>
                      <span className="font-bold text-foreground mt-0.5 block">Velocity Spike (2.4/day)</span>
                    </div>
                    <div className="p-2.5 bg-card rounded-lg border border-border text-xs">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Evidence Datasets</span>
                      <span className="font-bold text-foreground mt-0.5 block">Shopify Sales + Factory PO</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. The Diagnosis — 3 Core Inventory Problems */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/20 border-y border-border/60">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-rose-500">The Problem</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Why Standard Inventory Planning Fails Brands
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
              How stockouts, overstock, and manual spreadsheets quietly drain margins and lock up working capital.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Unplanned Bestseller Stockouts</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When demand surges unexpectedly and suppliers have 30-day lead times, you lose revenue and customer trust. EVE predicts depletion dates weeks in advance.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                <DollarSign size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Trapped Cash in Overstock</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tying up tens of thousands of dollars in slow-moving variant sizes. EVE isolates dead stock and suggests liquidation promos or order deferrals.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-500 border border-violet-500/20 flex items-center justify-center">
                <Layers size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Spreadsheet Inaccuracy & Math Errors</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Manually downloading sales exports, mapping size variants, and guessing lead times. EVE automates variant math and reconciles quantities in sub-seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Product Capabilities Grid */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto w-full space-y-12">
        <div className="text-center space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">Core Capabilities</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Everything Required to Master Your Cash Flow
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
            From automated replenishment sheets to AI strategic advice, EVE handles the heavy lifting of inventory management.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-3 hover:border-primary/40 hover:-translate-y-1 hover:shadow-md transition-all duration-200 group">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 w-fit group-hover:scale-105 transition-transform">
              <AlertTriangle size={18} />
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Predictive Stockout Alerts</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Monitors variant-level sales velocity daily and alerts you before popular sizes deplete, matching supplier lead times.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-3 hover:border-primary/40 hover:-translate-y-1 hover:shadow-md transition-all duration-200 group">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 w-fit group-hover:scale-105 transition-transform">
              <DollarSign size={18} />
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Dead Stock Capital Isolation</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Scans warehouses for non-moving variants, providing exact dollar figures for trapped working capital and liquidation strategies.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-3 hover:border-primary/40 hover:-translate-y-1 hover:shadow-md transition-all duration-200 group">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 w-fit group-hover:scale-105 transition-transform">
              <Package size={18} />
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Automated Supplier Planning</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Generates size-level purchase order suggestions aligned with supplier minimum order quantities (MOQs) and lead times.
            </p>
          </div>

          <div id="traceability" className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-3 hover:border-primary/40 hover:-translate-y-1 hover:shadow-md transition-all duration-200 group">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 w-fit group-hover:scale-105 transition-transform">
              <ShieldCheck size={18} />
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Decision Traceability</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Full audit trail into evidence datasets, confidence scores, and business math behind every AI recommendation.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-3 hover:border-primary/40 hover:-translate-y-1 hover:shadow-md transition-all duration-200 group">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 w-fit group-hover:scale-105 transition-transform">
              <FileText size={18} />
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Document Ingestion Vault</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload supplier invoices, packing lists, and CSV ledgers. EVE classifies and integrates them into operational memory instantly.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-3 hover:border-primary/40 hover:-translate-y-1 hover:shadow-md transition-all duration-200 group">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-500 w-fit group-hover:scale-105 transition-transform">
              <Brain size={18} />
            </div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">EVE AI CEO Strategic Assistant</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Command deep business audits using plain text. Ask questions regarding margins, dead stock, or project delivery pacing.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Workflow Step-by-Step */}
      <section id="workflow" className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/20 border-y border-border/60">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-primary">Simple 3-Step Setup</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              From Raw Data to Execution in 2 Minutes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="p-6 rounded-2xl border border-border bg-card space-y-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center mx-auto">1</div>
              <h3 className="text-sm font-bold text-foreground">Upload Inventory or Connect Store</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Drag and drop your variant stock CSV, or connect your Shopify catalog in one click.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card space-y-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center mx-auto">2</div>
              <h3 className="text-sm font-bold text-foreground">EVE Scans Health & Velocity</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                EVE calculates sales velocity per variant size, evaluates lead times, and flags stockout risk dates.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card space-y-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center mx-auto">3</div>
              <h3 className="text-sm font-bold text-foreground">Review & Execute Purchase Orders</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Receive exact reorder suggestions and audit evidence behind every recommendation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto w-full space-y-12">
        <div className="text-center space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-primary">Transparent Pricing</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Simple Plans for Growing E-Commerce Brands
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
            14-day free trial on all plans. No credit card required to begin.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Starter */}
          <div className="p-6 rounded-2xl border border-border bg-card space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Starter</span>
              <div className="text-3xl font-extrabold text-foreground">$49 <span className="text-xs font-normal text-muted-foreground">/ month</span></div>
              <p className="text-xs text-muted-foreground">For emerging D2C brands taking control of variant inventory.</p>
              <ul className="space-y-2 text-xs text-foreground font-medium pt-2">
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Up to 500 SKUs</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Stockout Risk Predictions</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Dead Stock Identification</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Master CSV Ingestion</li>
              </ul>
            </div>
            <Link href="/signup" className="w-full text-center py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors block">
              Start Free Trial
            </Link>
          </div>

          {/* Growth (Featured) */}
          <div className="p-6 rounded-2xl border-2 border-primary bg-card space-y-6 flex flex-col justify-between relative shadow-lg">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-3 py-0.5 rounded-full shadow-xs">
              Most Popular
            </span>
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Growth</span>
              <div className="text-3xl font-extrabold text-foreground">$149 <span className="text-xs font-normal text-muted-foreground">/ month</span></div>
              <p className="text-xs text-muted-foreground">For scaling e-commerce brands needing automated PO planning.</p>
              <ul className="space-y-2 text-xs text-foreground font-medium pt-2">
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Up to 5,000 SKUs</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Automated PO Generation</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Decision Traceability</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> EVE AI CEO Strategic Assistant</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Document Vault Ingestion</li>
              </ul>
            </div>
            <Link href="/signup" className="w-full text-center py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs block">
              Start 14-Day Free Trial
            </Link>
          </div>

          {/* Enterprise */}
          <div className="p-6 rounded-2xl border border-border bg-card space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Enterprise</span>
              <div className="text-3xl font-extrabold text-foreground">Custom</div>
              <p className="text-xs text-muted-foreground">For high-volume multi-brand groups and enterprise retailers.</p>
              <ul className="space-y-2 text-xs text-foreground font-medium pt-2">
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Unlimited SKUs & Workspaces</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Custom API & ERP Connectors</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Dedicated Account Manager</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Custom AI Model Guardrails</li>
              </ul>
            </div>
            <a href="mailto:support@eveinventory.in" className="w-full text-center py-2.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors block">
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      {/* 9. Interactive FAQ Accordion */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/20 border-y border-border/60">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-primary">Frequently Asked Questions</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Everything You Need to Know
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200 hover:border-primary/30"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none group"
                >
                  <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{faq.q}</span>
                  <div className={`p-1 rounded-full bg-muted transition-transform duration-200 ${openFaq === index ? "rotate-180 bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                    <ChevronDown size={16} />
                  </div>
                </button>
                {openFaq === index && (
                  <div className="px-5 pb-5 text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3.5 animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. High-Impact Bottom CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 text-center bg-card border-b border-border relative overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-8 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Transform Your Inventory Into Your Greatest Cash Flow Asset
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Join forward-thinking e-commerce founders and D2C brands using EVE to eliminate stockouts and reclaim trapped capital.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link 
              href="/signup" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md cursor-pointer"
            >
              Start 14-Day Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link 
              href="/demo" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border rounded-xl transition-all cursor-pointer"
            >
              Explore Live Demo
            </Link>
          </div>
        </div>
      </section>

      {/* 11. Enterprise Footer */}
      <footer className="w-full bg-background border-t border-border px-4 sm:px-6 py-12">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 text-xs mb-12">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs">
                EVE
              </div>
              <span className="font-extrabold text-foreground text-sm">EVE Operating System</span>
            </div>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              The Executive Operating System for e-commerce founders, D2C brands, and retail operators. Autonomous inventory forecasting, decision traceability, and capital recovery.
            </p>
          </div>
          
          <div className="space-y-3">
            <span className="font-bold text-foreground uppercase tracking-wider block">Product</span>
            <ul className="space-y-2 text-muted-foreground font-medium">
              <li><a href="#features" className="hover:text-foreground transition-colors">Inventory Intelligence</a></li>
              <li><a href="#traceability" className="hover:text-foreground transition-colors">Decision Traceability</a></li>
              <li><a href="#features" className="hover:text-foreground transition-colors">Supplier Reorder Automation</a></li>
              <li><Link href="/demo" className="hover:text-foreground transition-colors">Interactive Demo</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <span className="font-bold text-foreground uppercase tracking-wider block">Company</span>
            <ul className="space-y-2 text-muted-foreground font-medium">
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing Plans</a></li>
              <li><a href="mailto:support@eveinventory.in" className="hover:text-foreground transition-colors">Contact Support</a></li>
              <li><a href="mailto:sales@eveinventory.in" className="hover:text-foreground transition-colors">Enterprise Sales</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <span className="font-bold text-foreground uppercase tracking-wider block">Legal & Privacy</span>
            <ul className="space-y-2 text-muted-foreground font-medium">
              <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><a href="mailto:security@eveinventory.in" className="hover:text-foreground transition-colors">Security Center</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-border/60 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} EVE Inc. All rights reserved.</div>
          <div>Support: <a href="mailto:support@eveinventory.in" className="text-foreground hover:underline">support@eveinventory.in</a></div>
        </div>
      </footer>

    </div>
  );
}
