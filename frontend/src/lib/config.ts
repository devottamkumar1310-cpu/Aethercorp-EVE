/**
 * EVE — single source of truth for go-to-market configuration.
 *
 * Pricing, positioning, and booking links live here so copy changes never
 * require touching component code. If you change a price, change it once here.
 */

/** The one-sentence identity. Used in metadata, schema.org, and page copy. */
export const POSITIONING = {
  name: "EVE",
  legalName: "EVE Inc.",
  category: "Inventory Intelligence",
  audience: "Shopify and D2C fashion brands",
  /** The canonical sentence. Every surface must reinforce this exact claim. */
  oneLiner:
    "EVE is the AI Inventory Intelligence platform for Shopify and D2C fashion brands.",
  tagline: "AI Inventory Intelligence for Shopify & D2C Brands",
  description:
    "EVE turns your Shopify inventory data into executive decisions — predict stockouts before they happen, surface cash trapped in dead stock, and get variant-level reorder recommendations across every size and colour.",
  domain: "https://eveinventory.in",
  supportEmail: "support@eveinventory.in",
  linkedIn: "https://www.linkedin.com/company/135245277/",
} as const;

/**
 * Founder call booking. Set NEXT_PUBLIC_BOOKING_URL to your real Cal.com/
 * Calendly link — it can be changed in Vercel without a deploy.
 *
 * SECONDARY PATH ONLY. EVE is product-led: the primary journey is landing →
 * free trial → Google sign-in → demo workspace → upload CSV → first insight,
 * and nothing on a marketing surface should compete with it. A founder call is
 * the escape hatch for someone who is stuck or wants a deeper conversation
 * after trying the product — never the headline action, never a primary button.
 *
 * There is deliberately NO placeholder fallback. A hardcoded default shipped a
 * link that 404'd on every page, which is worse than no button at all. When
 * unset, BookDemoButton falls back to a mailto so the link still reaches a human.
 */
export const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || "";

/** Deliberately assistance-shaped, not sales-shaped. */
export const BOOKING_CTA = "Book 15 minutes with the founder";

/**
 * Pricing page copy.
 *
 * Numeric truth (prices, limits, feature flags) is NOT duplicated here — it
 * is served by GET /api/billing/plans, sourced from backend/app/core/plans.py.
 * Changing a price means changing it in exactly one place, backend-side; a
 * second copy here would drift the moment either side changed alone.
 *
 * This object holds only marketing copy the backend has no business owning.
 */
export const PRICING = {
  headline: "Simple pricing for founders who need real answers.",
  subheadline:
    "Every plan includes EVE's full inventory intelligence — the difference is store count, catalogue size, and how you reach EVE.",
  trialCopy: "14-day free trial. No credit card required to start.",
} as const;

/** Marketing copy per plan, keyed to the `key` field GET /api/billing/plans returns. */
export const PLAN_MARKETING: Record<
  string,
  { tagline: string; forWhom: string; popular?: boolean }
> = {
  operator: {
    tagline: "Run your store with EVE.",
    forWhom: "Solo founder, one store, growing past spreadsheets.",
  },
  command: {
    tagline: "Make EVE your business command center.",
    forWhom: "Established brand where stockouts cost real revenue.",
    popular: true,
  },
  chief: {
    tagline: "Run your business with an executive operating system.",
    forWhom: "Multi-store operator who wants EVE in the loop daily.",
  },
};

export const REVENUE_RANGES = [
  "Pre-launch",
  "Under $250k/yr",
  "$250k – $1M/yr",
  "$1M – $5M/yr",
  "$5M – $20M/yr",
  "Over $20M/yr",
] as const;
