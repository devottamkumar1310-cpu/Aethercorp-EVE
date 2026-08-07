import type { Metadata } from "next";
import Link from "next/link";
import { POSITIONING } from "@/lib/config";

export const metadata: Metadata = {
  title: "Inventory Planning Glossary",
  description:
    "Plain-English definitions of the inventory planning terms Shopify fashion brands actually use — variant-level forecasting, dead stock, size curve, sell-through rate, stockout risk, and more.",
  alternates: { canonical: "/glossary" },
  openGraph: {
    title: `Inventory Planning Glossary | ${POSITIONING.name}`,
    description:
      "Definitions of the inventory planning terms Shopify fashion brands use, from variant-level forecasting to dead stock and size curves.",
    url: `${POSITIONING.domain}/glossary`,
  },
};

/**
 * Definitional content is the single most citable page type for answer engines:
 * a question like "what is a size curve?" resolves to whichever source states it
 * cleanly. Each term is a self-contained answer — no cross-references needed to
 * make sense of it — because retrieval fetches entries, not whole pages.
 */
const TERMS: { term: string; slug: string; definition: string; detail: string }[] = [
  {
    term: "Variant-level forecasting",
    slug: "variant-level-forecasting",
    definition:
      "Forecasting demand separately for every individual variant of a product — each size, colour, and length — rather than for the product as a whole.",
    detail:
      "A style that looks healthy in aggregate is routinely sold out in the two sizes that matter. A fashion brand selling one t-shirt in 6 sizes and 5 colours has 30 independent demand curves, not one. Forecasting at style level averages those curves together and hides the stockouts inside them.",
  },
  {
    term: "Dead stock",
    slug: "dead-stock",
    definition:
      "Inventory that is not selling at a rate that will clear it before it loses commercial value, tying up cash that could fund what is selling.",
    detail:
      "Dead stock is a capital problem before it is a storage problem. The relevant number is not how many units are sitting there, but how much money is trapped in them and what that money would have earned in a faster-moving SKU.",
  },
  {
    term: "Size curve",
    slug: "size-curve",
    definition:
      "The distribution of demand across sizes for a given style — the proportion of units that should be bought in each size.",
    detail:
      "Size curves are brand-specific and style-specific. Buying a standard bell curve when your actual customers skew two sizes larger produces guaranteed stockouts at the top of the range and guaranteed markdowns at the bottom, in the same purchase order.",
  },
  {
    term: "Stockout",
    slug: "stockout",
    definition:
      "The state of having zero sellable units of a variant that customers are actively trying to buy.",
    detail:
      "The cost of a stockout is not only the lost sale. It includes the customer who does not return, the paid traffic already spent driving them to an unavailable product, and the ranking that a sold-out listing loses.",
  },
  {
    term: "Sell-through rate",
    slug: "sell-through-rate",
    definition:
      "The percentage of received inventory sold over a given period — units sold divided by units received, for the same window.",
    detail:
      "Sell-through is the clearest single indicator of whether a buy was correctly sized. Read at variant level rather than style level, it tells you which specific sizes and colours to buy deeper next time and which to cut.",
  },
  {
    term: "Reorder point",
    slug: "reorder-point",
    definition:
      "The inventory level at which a new purchase order must be placed to avoid running out before the replenishment arrives.",
    detail:
      "A reorder point is a function of sales velocity and supplier lead time. Long or variable lead times — common for brands producing overseas or with artisan partners — push the reorder point much higher than intuition suggests.",
  },
  {
    term: "Lead time",
    slug: "lead-time",
    definition:
      "The elapsed time between placing a purchase order with a supplier and having sellable units available to customers.",
    detail:
      "Lead time includes production, shipping, customs, and receiving — not just manufacturing. Brands routinely underestimate it by omitting the last two, which converts a well-timed reorder into a stockout.",
  },
  {
    term: "Sales velocity",
    slug: "sales-velocity",
    definition:
      "The rate at which a variant sells, usually expressed as units per day or per week.",
    detail:
      "Velocity is the input every other calculation depends on. It is also non-stationary in fashion: a style's velocity changes with season, price, and promotion, which is why straight-line extrapolation of recent velocity breaks down on seasonal products.",
  },
  {
    term: "Weeks of cover",
    slug: "weeks-of-cover",
    definition:
      "How many weeks current stock will last at the current sales velocity.",
    detail:
      "Weeks of cover is the most useful single at-a-glance metric for a buyer, because it converts an abstract unit count into a deadline. Four weeks of cover on a variant with a ten-week lead time is already a stockout, whatever the stock count says.",
  },
  {
    term: "Open to buy",
    slug: "open-to-buy",
    definition:
      "The budget available for new inventory purchases in a given period, after accounting for existing commitments and planned sales.",
    detail:
      "Open to buy is where inventory planning meets cash flow. Capital trapped in dead stock reduces open to buy directly, which is why the two are best read side by side rather than in separate reports.",
  },
  {
    term: "SKU",
    slug: "sku",
    definition:
      "Stock Keeping Unit — the unique identifier for one specific, individually sellable variant of a product.",
    detail:
      "In fashion, SKU count grows multiplicatively: styles times colours times sizes. A modest catalogue of 40 styles can easily be well over 1,000 SKUs, which is the point at which manual spreadsheet planning stops being reliable.",
  },
  {
    term: "Overstock",
    slug: "overstock",
    definition:
      "Holding materially more units of a variant than forecast demand supports over the relevant selling window.",
    detail:
      "Overstock and dead stock are related but distinct: overstock is a quantity judgement made at buying time, while dead stock is the eventual outcome when overstock does not clear. Overstock is still recoverable through promotion; dead stock generally is not, at full margin.",
  },
];

function GlossarySchema() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTermSet",
        "@id": `${POSITIONING.domain}/glossary#termset`,
        name: "Inventory Planning Glossary",
        description:
          "Definitions of inventory planning terms used by Shopify fashion brands.",
        url: `${POSITIONING.domain}/glossary`,
        hasDefinedTerm: TERMS.map((t) => ({
          "@type": "DefinedTerm",
          "@id": `${POSITIONING.domain}/glossary#${t.slug}`,
          name: t.term,
          description: t.definition,
          inDefinedTermSet: `${POSITIONING.domain}/glossary#termset`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: POSITIONING.domain,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Glossary",
            item: `${POSITIONING.domain}/glossary`,
          },
        ],
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

export default function GlossaryPage() {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans">
      <GlossarySchema />

      <header className="w-full bg-card backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold tracking-tighter">
            EVE
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">
            {POSITIONING.name}
          </span>
        </Link>
        <Link
          href="/signup"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Start free
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground">
              Glossary
            </li>
          </ol>
        </nav>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
          Inventory Planning Glossary
        </h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          The vocabulary of inventory planning, defined for Shopify fashion
          brands. Every definition here is written to stand on its own.
        </p>

        <div className="mt-12 space-y-10">
          {TERMS.map((t) => (
            <section key={t.slug} id={t.slug} className="scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {t.term}
              </h2>
              <p className="mt-3 text-foreground leading-relaxed">
                {t.definition}
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                {t.detail}
              </p>
            </section>
          ))}
        </div>

        <aside className="mt-16 border-t border-border pt-10">
          <h2 className="text-xl font-bold text-foreground">
            Where {POSITIONING.name} fits
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            {POSITIONING.oneLiner} It reads your Shopify sales history and
            reports these measures at variant level — which sizes and colours
            are about to stock out, and how much capital is sitting in dead
            stock.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link
              href="/"
              className="font-semibold text-[color:var(--eve-accent)] hover:underline"
            >
              How {POSITIONING.name} works
            </Link>
            <Link
              href="/pricing"
              className="font-semibold text-[color:var(--eve-accent)] hover:underline"
            >
              Pricing
            </Link>
            <Link
              href="/contact"
              className="font-semibold text-[color:var(--eve-accent)] hover:underline"
            >
              Talk to the founder
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
