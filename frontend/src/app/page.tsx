"use client";

import { useState, useEffect } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Package,
  DollarSign,
  Menu,
  X,
  ShieldCheck,
  Layers,
  FileText,
  Brain,
  ChevronDown,
  Activity,
} from "lucide-react";
import { POSITIONING } from "@/lib/config";
import { track } from "@/lib/analytics";
import { BookDemoButton } from "@/components/marketing/BookDemoButton";

type TabKey = "overview" | "inventory" | "traceability";

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: "inventory", label: "Inventory Intelligence", emoji: "📦" },
  { key: "overview", label: "Operations Overview", emoji: "⚡" },
  { key: "traceability", label: "Decision Traceability", emoji: "🔍" },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("inventory");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    track("landing_view");
  }, []);

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

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.key === activeTab);
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = TABS[(i + dir + TABS.length) % TABS.length].key;
    setActiveTab(next);
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  };

  // Mirrors the in-app FAQ (dashboard → Help & Learning Center → FAQ) so the
  // landing page and product stay consistent. Do not invent generic SaaS FAQs.
  // Written as direct, extractable answers to the questions founders actually
  // ask before buying — which is also what answer engines quote. Each answer
  // leads with the fact, then the detail. Mirrored into FAQPage JSON-LD below.
  const faqs = [
    {
      q: "Does EVE work with my Shopify store?",
      a: "Yes. Export your products from Shopify admin and upload the CSV unchanged — EVE reads Shopify's native export format, including grouped variant rows, size and colour options, and cost-per-item. You do not need to rename a single column. A direct Shopify app integration is on the roadmap; today the import takes about 60 seconds.",
    },
    {
      q: "How long until I see something useful?",
      a: "Under two minutes for most catalogues. After upload, EVE shows your stockout risk list ranked by revenue exposure, your dead stock with the capital tied up in it, and reorder quantities per variant.",
    },
    {
      q: "How is EVE different from Stocky or Inventory Planner?",
      a: "EVE is built specifically for fashion, so it forecasts at variant level — size and colour — rather than treating a style as one SKU. That is the difference between 'the tee is selling' and 'you are about to run out of mediums and will be sitting on XLs in March'. EVE also explains every recommendation with the data behind it.",
    },
    {
      q: "What does EVE cost?",
      a: "Plans start at $79/month for up to 500 SKUs, $199/month for growing brands with variant-level forecasting and the AI assistant, and $449/month for unlimited SKUs. Every plan includes a 14-day free trial with no credit card required.",
    },
    {
      q: "Is my inventory data safe?",
      a: "Yes. EVE's AI has read-only access — it analyses your data and never writes back to your store. Files are stored in encrypted buckets, and every database query is scoped to your workspace boundary so no other tenant can reach your data.",
    },
    {
      q: "What kind of brand is EVE built for?",
      a: "Founder-led D2C fashion and apparel brands on Shopify, typically between $250k and $20M in annual revenue, managing anywhere from 50 to several thousand variants across sizes and colours.",
    },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* FAQPage schema — lets answer engines quote these directly. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Skip link for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* 1. Header Navigation */}
      <header className="w-full border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 rounded-xl" aria-label="EVE home">
            <div className="h-9 w-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-md shadow-violet-600/25">
              EVE
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-1.5">
                EVE
                
              </span>
              <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">Inventory Intelligence for Shopify Fashion Brands</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav aria-label="Primary" className="hidden md:flex items-center gap-8 text-xs font-semibold text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">What it does</a>
            <a href="#traceability" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#workflow" className="hover:text-foreground transition-colors">Setup</a>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>

          {/* Action Triggers */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold px-4 py-2 rounded-lg text-foreground hover:text-[color:var(--eve-accent)] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow-md"
            >
              Start free trial
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            id="mobile-menu"
            aria-label="Mobile"
            className="md:hidden border-b border-border bg-card p-6 flex flex-col gap-4 animate-fade-in"
          >
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">What it does</a>
            <a href="#traceability" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">How it works</a>
            <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">Setup</a>
            <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">Pricing</Link>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">FAQ</a>
            <div className="pt-4 border-t border-border flex flex-col gap-2.5">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full text-center text-xs font-semibold py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors">Sign In</Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="w-full text-center text-xs font-bold bg-primary text-primary-foreground py-2.5 rounded-xl shadow-sm">Start free trial</Link>
            </div>
          </nav>
        )}
      </header>

      <main id="main">

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 flex flex-col items-center text-center px-4 sm:px-6">
        {/* Decorative ambient accent glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-[-12%] h-[440px] w-[860px] max-w-[96vw] -translate-x-1/2 rounded-full blur-3xl opacity-70"
            style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(124,58,237,0.18), rgba(99,102,241,0.10) 45%, transparent 72%)" }}
          />
        </div>

        <div className="max-w-4xl space-y-6 sm:space-y-8 relative z-10">

          {/* Category pill — states the entity, not a scarcity claim */}
          <Link
            href="/demo"
            className="chip-accent inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold shadow-sm max-w-full hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition-transform"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="text-left">See what EVE finds in a real fashion catalogue</span>
            <ArrowRight className="h-3 w-3 shrink-0" aria-hidden />
          </Link>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] text-foreground">
            Know what to reorder. <br />
            <span className="eve-gradient-text">Before you sell out.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            EVE is the inventory intelligence platform for Shopify fashion brands. Upload your
            Shopify export and see, in under two minutes, which sizes are about to stock out,
            how much cash is trapped in dead stock, and exactly what to reorder.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 w-full max-w-md mx-auto sm:max-w-none">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
            >
              Start free trial
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
            <BookDemoButton
              variant="secondary"
              location="landing_hero"
              className="w-full sm:w-auto px-8 py-3.5 text-sm"
            />
          </div>

          <p className="text-xs text-muted-foreground font-medium">
            14-day free trial • No credit card • Works with your native Shopify CSV export
          </p>
        </div>
      </section>

      {/* 3. Proof strip — claims a founder can verify in the product itself.
          Deliberately no invented customer counts or fake logos. */}
      <section aria-label="What EVE does" className="border-y border-border/60 bg-muted/30 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: "Under 2 min", l: "From Shopify export to first insight" },
            { v: "Size & colour", l: "Variant-level velocity, not just SKU totals" },
            { v: "Read-only AI", l: "Never writes back to your store" },
            { v: "Every number", l: "Traceable to the data behind it" },
          ].map((m) => (
            <div key={m.l} className="space-y-1">
              <div className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">{m.v}</div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{m.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3b. Founder trust block — with no customers yet, a named human is the
          strongest credibility signal available, and it costs nothing. */}
      <section aria-label="Who builds EVE" className="px-4 sm:px-6 py-12">
        <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xl font-extrabold shadow-md">
              DK
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-extrabold text-foreground">Devottam Kumar</div>
                <div className="text-xs text-muted-foreground font-medium">Founder, EVE</div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                I&apos;m building EVE with a small group of fashion founders, one catalogue at a
                time. If you upload your data and EVE tells you something useless, I want to hear
                it directly — I answer every email myself.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <a
                  href={`mailto:${POSITIONING.supportEmail}`}
                  className="text-xs font-bold text-[color:var(--eve-accent)] hover:underline"
                >
                  {POSITIONING.supportEmail}
                </a>
                <a
                  href={POSITIONING.linkedIn}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-[color:var(--eve-accent)] hover:underline"
                >
                  LinkedIn
                </a>
                <BookDemoButton
                  variant="ghost"
                  location="landing_founder_block"
                  label="Book 15 minutes with me"
                  className="text-xs px-0"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Interactive Live Product Preview Shell */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider t-accent">Interactive Application Preview</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Experience EVE Before You Sign Up
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Switch between modules to inspect how EVE optimizes inventory, delivers operational commands, and audits decision reasoning.
          </p>
          <div className="inline-block px-3 py-1 rounded-full bg-muted border border-border text-[10px] text-muted-foreground font-medium">
            * Interactive interface displaying sample e-commerce brand dataset
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center">
          <div role="tablist" aria-label="Product preview modules" className="inline-flex flex-wrap justify-center p-1.5 rounded-xl bg-muted/60 border border-border gap-1">
            {TABS.map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  id={`tab-${t.key}`}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${t.key}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setActiveTab(t.key)}
                  onKeyDown={onTabKeyDown}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-card text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span aria-hidden>{t.emoji}</span> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Window Mockup */}
        <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
          {/* OS Window Header */}
          <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block shrink-0" aria-hidden />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block shrink-0" aria-hidden />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block shrink-0" aria-hidden />
              <span className="text-xs font-mono text-muted-foreground ml-2 truncate">app.eveinventory.in/dashboard/{activeTab}</span>
            </div>
            {/* Honest label. This panel is a static preview, not a live
                session — claiming otherwise contradicts /demo and is the kind
                of detail a skeptical founder checks. */}
            <span className="chip px-2.5 py-0.5 text-[10px] font-semibold shrink-0 text-muted-foreground border border-border">
              <Activity size={10} aria-hidden /> Demo brand — Luma &amp; Co.
            </span>
          </div>

          {/* Tab Content Display */}
          <div className="p-6 sm:p-8 space-y-6">
            {activeTab === "inventory" && (
              <div id="panel-inventory" role="tabpanel" aria-labelledby="tab-inventory" tabIndex={0} className="space-y-6 animate-fade-in focus:outline-none">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-xl bg-muted/40 border border-border space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inventory Valuation (COGS)</span>
                    {/* These figures are the ACTUAL seeded Luma & Co. values
                        (backend/app/commands/seed_scenarios.py), matching
                        /demo. A visitor who clicks through must see the same
                        numbers. */}
                    <div className="text-2xl sm:text-3xl font-extrabold text-foreground">$112,402</div>
                    <span className="text-[11px] text-muted-foreground font-semibold">18 SKUs across sizes &amp; colours</span>
                  </div>
                  <div className="panel-danger p-5 rounded-xl border space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider t-danger">Stockout Risk SKUs</span>
                    <div className="text-2xl sm:text-3xl font-extrabold t-danger">3 SKUs</div>
                    <span className="text-[11px] t-danger font-semibold">Depleting within 6 days</span>
                  </div>
                  <div className="panel-warning p-5 rounded-xl border space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider t-warning">Revenue At Risk</span>
                    <div className="text-2xl sm:text-3xl font-extrabold t-warning">$7,600</div>
                    <span className="text-[11px] t-warning font-semibold">If hero SKUs stock out</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex justify-between items-center mb-3 gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Variant Replenishment Suggestions</h3>
                    <span className="text-[10px] text-muted-foreground shrink-0">Sample output</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[550px]">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground font-semibold">
                          <th scope="col" className="py-2.5 px-3">Variant SKU</th>
                          <th scope="col" className="py-2.5 px-3 text-right">Current Units</th>
                          <th scope="col" className="py-2.5 px-3 text-right">Daily Velocity</th>
                          <th scope="col" className="py-2.5 px-3 text-right">Status</th>
                          <th scope="col" className="py-2.5 px-3 text-right">Suggested Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 text-foreground">
                        {/* Real Luma & Co. SKUs, matching /demo and the seeded
                            workspace a visitor lands in. */}
                        <tr>
                          <td className="py-3 px-3 font-medium">Silk Wrap Dress — Emerald / M</td>
                          <td className="py-3 px-3 text-right font-mono">0 units</td>
                          <td className="py-3 px-3 text-right font-mono">1.9 / day</td>
                          <td className="py-3 px-3 text-right"><span className="chip chip-danger px-2 py-0.5 text-[10px] font-semibold">Out of stock</span></td>
                          <td className="py-3 px-3 text-right font-bold t-accent">Reorder now — 14d lead time</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-3 font-medium">Ribbed Merino Turtleneck — Ivory</td>
                          <td className="py-3 px-3 text-right font-mono">7 units</td>
                          <td className="py-3 px-3 text-right font-mono">2.0 / day</td>
                          <td className="py-3 px-3 text-right"><span className="chip chip-danger px-2 py-0.5 text-[10px] font-semibold">3.5 days left</span></td>
                          <td className="py-3 px-3 text-right font-bold t-accent">Reorder this week</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-3 font-medium">Cashmere Crew Sweater — Oatmeal</td>
                          <td className="py-3 px-3 text-right font-mono">191 units</td>
                          <td className="py-3 px-3 text-right font-mono">2.0 / day</td>
                          <td className="py-3 px-3 text-right"><span className="chip chip-warning px-2 py-0.5 text-[10px] font-semibold">95 days cover</span></td>
                          <td className="py-3 px-3 text-right font-bold t-warning">Hold PO / Clearance</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "overview" && (
              <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" tabIndex={0} className="space-y-6 animate-fade-in focus:outline-none">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">Portfolio Clients</span>
                    <div className="text-2xl font-bold text-foreground">24 Active</div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">Active Projects</span>
                    <div className="text-2xl font-bold text-foreground">12 In Flight</div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">Task Velocity</span>
                    <div className="text-2xl font-bold t-success">92% Delivered</div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">Net Profit Margin</span>
                    <div className="text-2xl font-bold t-success">$34,800</div>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-muted/40 border border-border space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Today&apos;s Founder Operational Priorities</h3>
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
              <div id="panel-traceability" role="tabpanel" aria-labelledby="tab-traceability" tabIndex={0} className="space-y-6 animate-fade-in focus:outline-none">
                <div className="panel-accent p-5 rounded-xl border space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs font-bold t-accent uppercase tracking-wider">Decision Governance Record #REC-8942</span>
                    <span className="chip chip-success px-2.5 py-0.5 text-[10px] font-bold">VALIDATED</span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Reorder 150 units of Classic Cotton Tee (Black / M)</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Stock level evaluated below 5-day safety threshold. Projected depletion on July 27th with supplier lead time of 7 days.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-2.5 bg-card rounded-lg border border-border text-xs">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Confidence Score</span>
                      <span className="font-bold t-success mt-0.5 block">98% High Confidence</span>
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
                      <span className="font-bold text-foreground mt-0.5 block">Sales History CSV + Factory PO</span>
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
            <div className="text-xs font-bold uppercase tracking-wider t-danger">The Problem</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Why Standard Inventory Planning Fails Brands
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              How stockouts, overstock, and manual spreadsheets quietly drain margins and lock up working capital.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              <div className="tile-danger h-10 w-10 rounded-xl flex items-center justify-center">
                <AlertTriangle size={20} aria-hidden />
              </div>
              <h3 className="text-base font-bold text-foreground">Unplanned Bestseller Stockouts</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When demand surges unexpectedly and suppliers have 30-day lead times, you lose revenue and customer trust. EVE predicts depletion dates weeks in advance.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              <div className="tile-warning h-10 w-10 rounded-xl flex items-center justify-center">
                <DollarSign size={20} aria-hidden />
              </div>
              <h3 className="text-base font-bold text-foreground">Trapped Cash in Overstock</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tying up tens of thousands of dollars in slow-moving variant sizes. EVE isolates dead stock and suggests liquidation promos or order deferrals.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              <div className="tile-accent h-10 w-10 rounded-xl flex items-center justify-center">
                <Layers size={20} aria-hidden />
              </div>
              <h3 className="text-base font-bold text-foreground">Spreadsheet Inaccuracy &amp; Math Errors</h3>
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
          <div className="text-xs font-bold uppercase tracking-wider t-accent">Core Capabilities</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Everything Required to Master Your Cash Flow
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            From automated replenishment sheets to AI strategic advice, EVE handles the heavy lifting of inventory management.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { tile: "tile-danger", Icon: AlertTriangle, t: "Predictive Stockout Alerts", d: "Monitors variant-level sales velocity daily and alerts you before popular sizes deplete, matching supplier lead times." },
            { tile: "tile-warning", Icon: DollarSign, t: "Dead Stock Capital Isolation", d: "Scans warehouses for non-moving variants, providing exact dollar figures for trapped working capital and liquidation strategies." },
            { tile: "tile-accent", Icon: Package, t: "Automated Supplier Planning", d: "Generates size-level purchase order suggestions aligned with supplier minimum order quantities (MOQs) and lead times." },
            { tile: "tile-success", Icon: ShieldCheck, t: "Decision Traceability", d: "Full audit trail into evidence datasets, confidence scores, and business math behind every AI recommendation.", id: "traceability" },
            { tile: "tile-info", Icon: FileText, t: "Document Ingestion Vault", d: "Upload supplier invoices, packing lists, and CSV ledgers. EVE classifies and integrates them into operational memory instantly." },
            { tile: "tile-accent", Icon: Brain, t: "EVE AI CEO Strategic Assistant", d: "Command deep business audits using plain text. Ask questions regarding margins, dead stock, or project delivery pacing." },
          ].map(({ tile, Icon, t, d, id }) => (
            <div
              key={t}
              id={id}
              className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-3 hover:border-[color:var(--eve-accent)]/40 hover:-translate-y-1 hover:shadow-lg motion-reduce:hover:translate-y-0 transition-all duration-200 group"
            >
              <div className={`${tile} p-2.5 rounded-xl w-fit group-hover:scale-105 motion-reduce:group-hover:scale-100 transition-transform`}>
                <Icon size={18} aria-hidden />
              </div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-[color:var(--eve-accent)] transition-colors">{t}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Workflow Step-by-Step */}
      <section id="workflow" className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/20 border-y border-border/60">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider t-accent">Simple 3-Step Setup</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              From Raw Data to Execution in 2 Minutes
            </h2>
          </div>

          <ol className="grid md:grid-cols-3 gap-8 text-center list-none">
            {[
              { n: 1, t: "Upload Your Inventory CSV", d: "Drag and drop your master variant stock CSV. EVE parses the columns and reconciles SKU quantities automatically." },
              { n: 2, t: "EVE Scans Health & Velocity", d: "EVE calculates sales velocity per variant size, evaluates lead times, and flags stockout risk dates." },
              { n: 3, t: "Review & Execute Purchase Orders", d: "Receive exact reorder suggestions and audit evidence behind every recommendation." },
            ].map((s) => (
              <li key={s.n} className="p-6 rounded-2xl border border-border bg-card space-y-3">
                <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center mx-auto shadow-sm">{s.n}</div>
                <h3 className="text-sm font-bold text-foreground">{s.t}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 9. Interactive FAQ Accordion */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/20 border-y border-border/60">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider t-accent">Frequently Asked Questions</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Everything You Need to Know
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const open = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-border bg-card overflow-hidden transition-colors duration-200 hover:border-[color:var(--eve-accent)]/30"
                >
                  <h3>
                    <button
                      id={`faq-btn-${index}`}
                      onClick={() => toggleFaq(index)}
                      aria-expanded={open}
                      aria-controls={`faq-panel-${index}`}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer group"
                    >
                      <span className="text-sm font-bold text-foreground group-hover:text-[color:var(--eve-accent)] transition-colors">{faq.q}</span>
                      <span className={`p-1 rounded-full transition-all duration-200 ${open ? "rotate-180 tile-accent" : "text-muted-foreground bg-muted"}`}>
                        <ChevronDown size={16} aria-hidden />
                      </span>
                    </button>
                  </h3>
                  {open && (
                    <div
                      id={`faq-panel-${index}`}
                      role="region"
                      aria-labelledby={`faq-btn-${index}`}
                      className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-3.5 animate-fade-in"
                    >
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 10. High-Impact Bottom CTA */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 text-center bg-card border-b border-border relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 bottom-[-40%] h-[420px] w-[820px] max-w-[96vw] -translate-x-1/2 rounded-full blur-3xl opacity-60"
            style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(124,58,237,0.16), rgba(99,102,241,0.08) 45%, transparent 72%)" }}
          />
        </div>
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
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
            >
              Start free trial
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/demo"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border hover:border-[color:var(--eve-accent)]/40 rounded-xl transition-all"
            >
              Explore Live Demo
            </Link>
          </div>
        </div>
      </section>

      </main>

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
              The Inventory Intelligence for Shopify Fashion Brands for e-commerce founders, D2C brands, and retail operators. Autonomous inventory forecasting, decision traceability, and capital recovery.
            </p>
          </div>

          <div className="space-y-3">
            <span className="font-bold text-foreground uppercase tracking-wider block">Product</span>
            <ul className="space-y-2 text-muted-foreground font-medium">
              <li><a href="#features" className="hover:text-foreground transition-colors">What it does</a></li>
              <li><a href="#traceability" className="hover:text-foreground transition-colors">How it works</a></li>
              <li><a href="#workflow" className="hover:text-foreground transition-colors">Setup</a></li>
              <li><Link href="/demo" className="hover:text-foreground transition-colors">Interactive Demo</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <span className="font-bold text-foreground uppercase tracking-wider block">Company</span>
            <ul className="space-y-2 text-muted-foreground font-medium">
              <li><Link href="/signup" className="hover:text-foreground transition-colors">Start free trial</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
              <li><Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <span className="font-bold text-foreground uppercase tracking-wider block">Legal &amp; Privacy</span>
            <ul className="space-y-2 text-muted-foreground font-medium">
              <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
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
