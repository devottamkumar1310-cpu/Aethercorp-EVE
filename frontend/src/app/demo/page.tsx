"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  AlertTriangle,
  Package,
  Loader2,
  TrendingDown,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { POSITIONING } from "@/lib/config";
import { track } from "@/lib/analytics";
import { BookDemoButton } from "@/components/marketing/BookDemoButton";
import { StartFreeTrialButton } from "@/components/marketing/StartFreeTrialButton";

/**
 * The numbers below are the ACTUAL seeded figures for the Luma & Co. demo
 * workspace (backend/app/commands/seed_scenarios.py). They are not
 * illustrative placeholders — a founder who opens the live workspace sees
 * exactly these values. Keep them in sync with the seed, or delete them: a
 * preview that disagrees with the product is worse than no preview at all.
 */
const LUMA = {
  brand: "Luma & Co.",
  segment: "Premium womenswear",
  skus: 18,
  inventoryValue: 112402,
  atRiskRevenue: 7600,
  criticalSkus: [
    {
      sku: "LM-1002",
      name: "Silk Wrap Dress — Emerald",
      daysOfSupply: 0,
      note: "Out of stock · 14-day lead time · demand up 85% in 90 days",
    },
    {
      sku: "LM-1003",
      name: "Ribbed Merino Turtleneck — Ivory",
      daysOfSupply: 3.5,
      note: "Sells out in under 4 days at current velocity",
    },
    {
      sku: "LM-1001",
      name: "Sculpted Blazer — Navy",
      daysOfSupply: 5.6,
      note: "Highest-margin outerwear · reorder window closing",
    },
  ],
  slowMovers: [
    { sku: "LM-2002", name: "Cashmere Crew Sweater — Oatmeal", daysOfSupply: 95.5 },
    { sku: "LM-2005", name: "Structured Trench Coat — Stone", daysOfSupply: 86.7 },
    { sku: "LM-2008", name: "Cropped Leather Jacket — Black", daysOfSupply: 86.4 },
  ],
};

const currency = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function DemoPage() {
  const [opening, setOpening] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await createClient().auth.getSession();
      if (!cancelled) {
        setSignedIn(Boolean(data.session));
        setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * One click into the real product. Signed-in users go straight to the
   * workspace; everyone else authenticates with Google and lands in the same
   * place — no password, no form, no "request access".
   */
  const openLiveWorkspace = async () => {
    setOpening(true);

    if (signedIn) {
      // The workspace itself is created in /onboarding, which fires
      // demo_workspace_created — tracking it here too would double-count.
      router.push("/onboarding?demo=luma");
      return;
    }

    track("signup_started", { method: "google", source: "demo_page", demo_company: "luma" });

    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding?demo=luma")}`,
      },
    });
    if (error) {
      // Fall back to the signup page rather than stranding them on an error.
      router.push("/signup");
    }
  };

  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="w-full border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 rounded-xl" aria-label="EVE home">
            <div className="h-9 w-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md shadow-violet-600/25">
              EVE
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-foreground">EVE</span>
              <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
                {POSITIONING.tagline}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="hidden sm:inline text-xs font-semibold px-3 py-2 rounded-lg text-foreground hover:text-[color:var(--eve-accent)] transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/signup"
              className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-14">
        {/* Hero */}
        <section className="text-center space-y-5 max-w-3xl mx-auto">
          <div className="chip-accent inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold shadow-sm">
            <Package className="h-3.5 w-3.5" aria-hidden />
            Real workspace · real data · no sales call
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.15] text-foreground">
            See what EVE finds in a{" "}
            <span className="eve-gradient-text">real fashion catalogue</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Below is what EVE actually surfaces for {LUMA.brand}, a {LUMA.segment.toLowerCase()} brand
            with {LUMA.skus} SKUs and {currency(LUMA.inventoryValue)} of inventory. Open it live and
            click through every number yourself.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={openLiveWorkspace}
              disabled={opening || checkingSession}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
            >
              {opening ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Opening workspace…
                </>
              ) : (
                <>
                  Open the live workspace
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          </div>
          {/* A single primary action. The booking link that used to sit beside
              it competed with the one thing this page exists to make happen. */}
          <p className="text-xs text-muted-foreground">
            {signedIn
              ? "You're signed in — this opens instantly."
              : "One click with Google. No password, no credit card, no sales call."}
          </p>
        </section>

        {/* Stockout risk */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">
                Stocking out inside 6 days
              </h2>
              <p className="text-xs text-muted-foreground">
                About {currency(LUMA.atRiskRevenue)} of revenue at risk across three hero SKUs.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {LUMA.criticalSkus.map((item) => (
              <div
                key={item.sku}
                className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.04] p-5 space-y-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {item.sku}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 whitespace-nowrap">
                    <Clock size={12} aria-hidden />
                    {item.daysOfSupply === 0 ? "Out of stock" : `${item.daysOfSupply} days left`}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-foreground leading-snug">{item.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Dead stock */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <TrendingDown size={18} aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">
                Sitting on three months of cover
              </h2>
              <p className="text-xs text-muted-foreground">
                Capital that could be funding the SKUs above instead.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[480px]">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      SKU
                    </th>
                    <th scope="col" className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Product
                    </th>
                    <th scope="col" className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                      Days of cover
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {LUMA.slowMovers.map((item) => (
                    <tr key={item.sku} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3.5 text-xs font-semibold text-muted-foreground">{item.sku}</td>
                      <td className="px-5 py-3.5 text-xs font-medium text-foreground">{item.name}</td>
                      <td className="px-5 py-3.5 text-xs font-bold text-amber-600 text-right">
                        {item.daysOfSupply}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-border bg-muted/20 p-6 sm:p-8 text-center space-y-5">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            Now run it on your own catalogue
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Export your products from Shopify and upload the file as-is — EVE reads Shopify&apos;s
            native export format, variant rows included. Most brands see their first stockout
            and dead-stock list within two minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <StartFreeTrialButton
              location="demo_bottom_cta"
              className="w-full sm:w-auto px-7 py-3.5 text-sm"
            />
            <Link
              href="/pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border rounded-xl transition-all"
            >
              See pricing
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Want a second pair of eyes on your catalogue?{" "}
            <BookDemoButton
              variant="ghost"
              location="demo_bottom_cta"
              label="Book 15 minutes with the founder"
              showIcon={false}
              className="text-xs underline underline-offset-2"
            />
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
            EVE&apos;s AI has read-only access. It analyses your data; it never writes back to your store.
          </div>
        </section>
      </main>

      <footer className="w-full bg-background border-t border-border px-4 sm:px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} {POSITIONING.legalName} All rights reserved.</div>
          <div className="flex flex-wrap justify-center gap-6 font-medium">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
