import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock, ArrowRight } from "lucide-react";
import { ARTICLES } from "@/lib/resources";
import { POSITIONING } from "@/lib/config";

export const metadata: Metadata = {
  title: "Inventory Intelligence Resource Center & Guides",
  description:
    "Educational guides and resources for Shopify fashion and D2C brand founders — stockout forecasting, size curve calculations, reorder point formulas, and dead stock recovery.",
  alternates: { canonical: "/resources" },
  openGraph: {
    title: `Inventory Intelligence Resource Center | ${POSITIONING.name}`,
    description:
      "Guides on stockout forecasting, size curve calculations, reorder formulas, and dead stock recovery for Shopify & D2C brands.",
    url: `${POSITIONING.domain}/resources`,
  },
};

function ResourcesSchema() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${POSITIONING.domain}/resources#page`,
        url: `${POSITIONING.domain}/resources`,
        name: "Inventory Intelligence Resource Center & Guides",
        publisher: { "@id": `${POSITIONING.domain}/#organization` },
        hasPart: ARTICLES.map((a) => ({
          "@type": "Article",
          "@id": `${POSITIONING.domain}/resources/${a.slug}`,
          url: `${POSITIONING.domain}/resources/${a.slug}`,
          headline: a.title,
          description: a.metaDescription,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: POSITIONING.domain },
          { "@type": "ListItem", position: 2, name: "Resources", item: `${POSITIONING.domain}/resources` },
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

export default function ResourcesHubPage() {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans">
      <ResourcesSchema />

      <header className="w-full bg-card backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold tracking-tighter">
            EVE
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">
            {POSITIONING.name}
          </span>
        </Link>
        <Link
          href="/signup"
          className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
        >
          Start free
        </Link>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 space-y-12">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground font-medium">
              Resources
            </li>
          </ol>
        </nav>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 text-xs font-semibold uppercase tracking-wider">
            <BookOpen size={14} /> E-Commerce &amp; Inventory Guides
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
            Inventory Intelligence Resource Center
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Educational guides, formulas, and tactical playbooks for Shopify &amp; D2C brand founders navigating stockouts, size curves, and working capital optimization.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ARTICLES.map((article) => (
            <Link
              key={article.slug}
              href={`/resources/${article.slug}`}
              className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between hover:border-indigo-500 hover:shadow-md transition-all group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {article.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {article.readTime}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-foreground group-hover:text-indigo-600 transition-colors leading-snug">
                  {article.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {article.summary}
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <span>Read Guide</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <section className="rounded-2xl bg-muted/40 border border-border p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-foreground">
            Looking for Automated Inventory Intelligence?
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Instead of manually computing formulas in Excel, EVE analyzes your native Shopify export CSV in 60 seconds.
          </p>
          <div className="pt-2">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors"
            >
              Try EVE Free for 14 Days <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
