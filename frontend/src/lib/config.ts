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
  audience: "Shopify fashion brands",
  /** The canonical sentence. Every surface must reinforce this exact claim. */
  oneLiner:
    "EVE is the Inventory Intelligence platform for Shopify fashion brands.",
  tagline: "Inventory Intelligence for Shopify Fashion Brands",
  description:
    "EVE turns your Shopify inventory data into executive decisions — predict stockouts before they happen, surface the cash trapped in dead stock, and know exactly what to reorder, at variant level, across every size and colour.",
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
 * Pricing.
 *
 * These are placeholder numbers chosen to be defensible for a founder-led
 * D2C brand doing $500k–$5M/yr. Change them — but do NOT ship a pricing page
 * without numbers on it. Ambiguous pricing costs more conversions than
 * mispricing does.
 */
export const PRICING = {
  /** Shown as a scarcity anchor on the pricing page. Set to null to hide. */
  foundingSpotsTotal: 20,
  currency: "$",
  trialDays: 14,
  plans: [
    {
      id: "starter",
      name: "Starter",
      price: 79,
      cadence: "/mo",
      blurb: "For brands under $500k/yr finding their first inventory rhythm.",
      features: [
        "Up to 500 SKUs",
        "Stockout risk prediction",
        "Dead stock capital analysis",
        "Reorder recommendations",
        "CSV + Shopify export import",
        "Email support",
      ],
      cta: "Start free trial",
      highlighted: false,
    },
    {
      id: "growth",
      name: "Growth",
      price: 199,
      cadence: "/mo",
      blurb: "For scaling fashion brands managing real variant complexity.",
      features: [
        "Up to 5,000 SKUs",
        "Everything in Starter",
        "Variant-level size & colour velocity",
        "AI Executive Assistant",
        "Document intelligence (invoices, POs)",
        "Decision traceability audit trail",
        "Priority support",
      ],
      cta: "Start free trial",
      highlighted: true,
    },
    {
      id: "operator",
      name: "Operator",
      price: 449,
      cadence: "/mo",
      blurb: "For multi-collection brands with a real ops function.",
      features: [
        "Unlimited SKUs",
        "Everything in Growth",
        "Multi-workspace support",
        "Supplier & lead-time intelligence",
        "Custom onboarding & data migration",
        "Direct founder Slack channel",
      ],
      // Every plan self-serves. Gating the top tier behind "Talk to us" made
      // the most valuable visitor the only one who couldn't try the product.
      cta: "Start free trial",
      highlighted: false,
    },
  ],
} as const;

/** Founding-customer offer shown while we onboard our first cohort. */
export const FOUNDING_OFFER = {
  enabled: true,
  headline: "Founding customer pricing",
  detail:
    "The first 20 brands lock these rates for 12 months, get onboarding done with us directly, and shape the roadmap.",
} as const;

export const REVENUE_RANGES = [
  "Pre-launch",
  "Under $250k/yr",
  "$250k – $1M/yr",
  "$1M – $5M/yr",
  "$5M – $20M/yr",
  "Over $20M/yr",
] as const;
