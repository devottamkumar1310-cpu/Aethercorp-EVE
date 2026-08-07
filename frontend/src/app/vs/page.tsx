import type { Metadata } from "next";
import Link from "next/link";
import { COMPARISONS } from "@/lib/comparisons";
import { POSITIONING } from "@/lib/config";

export const metadata: Metadata = {
  title: "Shopify Inventory Software Comparisons",
  description:
    "Honest comparisons of Shopify inventory forecasting tools — Inventory Planner, Prediko, Assisty, Fabrikatör, Stocky, and spreadsheets — including what each does well.",
  alternates: { canonical: "/vs" },
  openGraph: {
    title: `Shopify Inventory Software Comparisons | ${POSITIONING.name}`,
    description:
      "How EVE compares to Inventory Planner, Prediko, Assisty, Fabrikatör, Stocky, and spreadsheets.",
    url: `${POSITIONING.domain}/vs`,
  },
};

function HubSchema() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${POSITIONING.domain}/vs#page`,
        url: `${POSITIONING.domain}/vs`,
        name: "Shopify Inventory Software Comparisons",
        publisher: { "@id": `${POSITIONING.domain}/#organization` },
        hasPart: COMPARISONS.map((c) => ({
          "@type": "WebPage",
          "@id": `${POSITIONING.domain}/vs/${c.slug}`,
          url: `${POSITIONING.domain}/vs/${c.slug}`,
          name: `${POSITIONING.name} vs ${c.competitor}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: POSITIONING.domain },
          {
            "@type": "ListItem",
            position: 2,
            name: "Comparisons",
            item: `${POSITIONING.domain}/vs`,
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

export default function ComparisonsHubPage() {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans">
      <HubSchema />

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
              Comparisons
            </li>
          </ol>
        </nav>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
          Shopify Inventory Software Comparisons
        </h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          Honest comparisons, including what each tool genuinely does well. Every
          factual claim about another product is sourced, and where a competitor
          is the better fit, these pages say so.
        </p>

        <div className="mt-12 space-y-4">
          {COMPARISONS.map((c) => (
            <Link
              key={c.slug}
              href={`/vs/${c.slug}`}
              className="block rounded-xl border border-border bg-card p-5 hover:border-[color:var(--eve-accent)] transition-colors"
            >
              <h2 className="text-lg font-bold text-foreground">
                {POSITIONING.name} vs {c.competitor}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {c.metaDescription}
              </p>
            </Link>
          ))}
        </div>

        <aside className="mt-16 border-t border-border pt-10">
          <h2 className="text-xl font-bold text-foreground">Related</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/glossary" className="font-semibold text-[color:var(--eve-accent)] hover:underline">
              Inventory glossary
            </Link>
            <Link href="/founder" className="font-semibold text-[color:var(--eve-accent)] hover:underline">
              About the founder
            </Link>
            <Link href="/pricing" className="font-semibold text-[color:var(--eve-accent)] hover:underline">
              Pricing
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}
