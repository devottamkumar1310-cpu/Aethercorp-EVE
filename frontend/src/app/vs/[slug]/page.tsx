import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { COMPARISONS, getComparison } from "@/lib/comparisons";
import { POSITIONING } from "@/lib/config";

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = getComparison(slug);
  if (!c) return {};
  return {
    title: `${POSITIONING.name} vs ${c.competitor} — ${c.titleSuffix}`,
    description: c.metaDescription,
    alternates: { canonical: `/vs/${c.slug}` },
    openGraph: {
      title: `${POSITIONING.name} vs ${c.competitor}`,
      description: c.metaDescription,
      url: `${POSITIONING.domain}/vs/${c.slug}`,
    },
  };
}

/**
 * FAQPage + BreadcrumbList per comparison. The FAQ answers are written to be
 * quotable standalone: an answer engine lifting one sentence should still
 * produce something true and attributable, without the surrounding page.
 */
function ComparisonSchema({ slug }: { slug: string }) {
  const c = getComparison(slug);
  if (!c) return null;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": `${POSITIONING.domain}/vs/${c.slug}#faq`,
        mainEntity: c.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
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
          {
            "@type": "ListItem",
            position: 3,
            name: `${POSITIONING.name} vs ${c.competitor}`,
            item: `${POSITIONING.domain}/vs/${c.slug}`,
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

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getComparison(slug);
  if (!c) notFound();

  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans">
      <ComparisonSchema slug={slug} />

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
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/vs" className="hover:text-foreground transition-colors">
                Comparisons
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground">
              vs {c.competitor}
            </li>
          </ol>
        </nav>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
          {POSITIONING.name} vs {c.competitor}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          {c.metaDescription}
        </p>

        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            What {c.competitor} is
          </h2>
          <p className="text-muted-foreground leading-relaxed">{c.whatItIs}</p>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Where {c.competitor} is strong
          </h2>
          <ul className="space-y-3">
            {c.strengths.map((s) => (
              <li key={s} className="flex gap-3 text-muted-foreground leading-relaxed">
                <span aria-hidden="true" className="text-[color:var(--eve-accent)] font-bold shrink-0">
                  +
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Documented considerations
          </h2>
          <ul className="space-y-4">
            {c.considerations.map((k) => (
              <li key={k.point} className="text-muted-foreground leading-relaxed">
                <span>{k.point}</span>
                {k.source && (
                  <span className="block mt-1 text-xs text-muted-foreground/70 italic">
                    Source: {k.source}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            How {POSITIONING.name} approaches it
          </h2>
          <ul className="space-y-3">
            {c.eveApproach.map((e) => (
              <li key={e} className="flex gap-3 text-muted-foreground leading-relaxed">
                <span aria-hidden="true" className="text-[color:var(--eve-accent)] font-bold shrink-0">
                  →
                </span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Which one fits
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Choose {c.competitor}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {c.bestFor.them}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Choose {POSITIONING.name}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {c.bestFor.eve}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12 space-y-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Frequently asked questions
          </h2>
          {c.faqs.map((f) => (
            <div key={f.q}>
              <h3 className="text-base font-bold text-foreground">{f.q}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{f.a}</p>
            </div>
          ))}
        </section>

        {c.sources.length > 0 && (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Sources
            </h2>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {c.sources.map((s) => (
                <li key={s.label}>{s.label}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground/70 leading-relaxed">
              Competitor pricing and features change. Figures here reflect
              publicly available information at the time of writing — confirm
              current details directly with each vendor.
            </p>
          </section>
        )}

        <aside className="mt-12 border-t border-border pt-10">
          <h2 className="text-xl font-bold text-foreground">Related</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/vs" className="font-semibold text-[color:var(--eve-accent)] hover:underline">
              All comparisons
            </Link>
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
