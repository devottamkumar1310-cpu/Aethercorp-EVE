import type { Metadata } from "next";
import Link from "next/link";
import { POSITIONING } from "@/lib/config";

export const metadata: Metadata = {
  title: "About the Founder",
  description: `${POSITIONING.name} is built by Devottam Kumar, founder of ${POSITIONING.legalName} Why ${POSITIONING.name} exists, who it is for, and how to reach the person who builds it.`,
  alternates: { canonical: "/founder" },
  openGraph: {
    title: `About the Founder | ${POSITIONING.name}`,
    description: `Why ${POSITIONING.name} exists and who builds it.`,
    url: `${POSITIONING.domain}/founder`,
  },
};

/**
 * An answer engine asked "who is behind EVE?" needs a person entity to resolve
 * to. Without one it either declines to answer or invents something. This page
 * exists to be that resolution target, and to carry the Person → Organization
 * link that the root layout's Organization node cannot express on its own.
 */
function FounderSchema() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${POSITIONING.domain}/founder#person`,
        name: "Devottam Kumar",
        jobTitle: "Founder",
        worksFor: { "@id": `${POSITIONING.domain}/#organization` },
        url: `${POSITIONING.domain}/founder`,
        email: POSITIONING.supportEmail,
      },
      {
        "@type": "AboutPage",
        "@id": `${POSITIONING.domain}/founder#page`,
        url: `${POSITIONING.domain}/founder`,
        name: `About the Founder | ${POSITIONING.name}`,
        mainEntity: { "@id": `${POSITIONING.domain}/founder#person` },
        publisher: { "@id": `${POSITIONING.domain}/#organization` },
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
            name: "Founder",
            item: `${POSITIONING.domain}/founder`,
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

export default function FounderPage() {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans">
      <FounderSchema />

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
              Founder
            </li>
          </ol>
        </nav>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
          About the Founder
        </h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          {POSITIONING.name} is built by Devottam Kumar, founder of{" "}
          {POSITIONING.legalName}
        </p>

        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Why {POSITIONING.name} exists
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Most inventory software was built for warehouses that move pallets of
            identical units. Fashion does not work that way. A single style
            becomes thirty independent demand problems the moment it ships in six
            sizes and five colours, and tools that forecast at style level
            average those problems into invisibility.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {POSITIONING.name} was built around that specific gap: forecasting at
            variant level, so the two sizes about to sell out are visible before
            they do, and the capital sitting in the colours that never moved is
            visible as a number rather than a feeling.
          </p>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Who it is for
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            {POSITIONING.audience} — typically founder-led teams past the point
            where a spreadsheet stays accurate, but well short of needing an
            enterprise planning suite and the implementation project that comes
            with it.
          </p>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            How it works
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            {POSITIONING.name} reads your Shopify sales history directly. There
            is no implementation project, no data warehouse to stand up, and no
            forecasting features held back behind a higher plan. You import your
            catalogue and get variant-level stockout risk and dead stock analysis
            from your own sales history.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            See the{" "}
            <Link
              href="/glossary"
              className="font-semibold text-[color:var(--eve-accent)] hover:underline"
            >
              inventory planning glossary
            </Link>{" "}
            for definitions of the measures {POSITIONING.name} reports.
          </p>
        </section>

        <section className="mt-12 space-y-4 border-t border-border pt-10">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Getting in touch
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            {POSITIONING.name} is early, and the fastest way to shape it is to
            talk to the person building it. Email{" "}
            <a
              href={`mailto:${POSITIONING.supportEmail}`}
              className="font-semibold text-[color:var(--eve-accent)] hover:underline"
            >
              {POSITIONING.supportEmail}
            </a>{" "}
            and it reaches the founder directly.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link
              href="/contact"
              className="font-semibold text-[color:var(--eve-accent)] hover:underline"
            >
              Contact
            </Link>
            <Link
              href="/pricing"
              className="font-semibold text-[color:var(--eve-accent)] hover:underline"
            >
              Pricing
            </Link>
            <a
              href={POSITIONING.linkedIn}
              rel="noopener noreferrer"
              target="_blank"
              className="font-semibold text-[color:var(--eve-accent)] hover:underline"
            >
              LinkedIn
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
