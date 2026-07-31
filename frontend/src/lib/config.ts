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
 * Pricing — Coming Soon configuration.
 */
export const PRICING = {
  headline: "Pricing Coming Soon",
  subheadline:
    "We're working closely with our first group of fashion brands to finalize pricing based on real customer feedback.",
  supportingCopy:
    "Join the waitlist to get early access, founding customer benefits, and be the first to know when pricing is announced.",
  primaryCTA: "Join the Waitlist",
  secondaryText: "No credit card required.",
} as const;

/** Founding-customer offer. */
export const FOUNDING_OFFER = {
  enabled: false,
  headline: "",
  detail: "",
} as const;

export const REVENUE_RANGES = [
  "Pre-launch",
  "Under $250k/yr",
  "$250k – $1M/yr",
  "$1M – $5M/yr",
  "$5M – $20M/yr",
  "Over $20M/yr",
] as const;
