import Link from "next/link";
import { ArrowRight, CheckCircle2, HelpCircle } from "lucide-react";
import { POSITIONING } from "@/lib/config";
import type { TopicPageData } from "@/lib/topicPages";

export function generateTopicMetadata(topic: TopicPageData) {
  return {
    title: topic.title,
    description: topic.metaDescription,
    alternates: { canonical: `/${topic.slug}` },
    openGraph: {
      title: topic.title,
      description: topic.metaDescription,
      url: `${POSITIONING.domain}/${topic.slug}`,
      siteName: POSITIONING.name,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: `${topic.title} | ${POSITIONING.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: topic.title,
      description: topic.metaDescription,
      images: ["/opengraph-image"],
    },
  };
}

export default function TopicPageTemplate({ topic }: { topic: TopicPageData }) {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${POSITIONING.domain}/${topic.slug}#webpage`,
        url: `${POSITIONING.domain}/${topic.slug}`,
        name: topic.title,
        description: topic.metaDescription,
        publisher: { "@id": `${POSITIONING.domain}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: POSITIONING.domain },
          { "@type": "ListItem", position: 2, name: topic.h1, item: `${POSITIONING.domain}/${topic.slug}` },
        ],
      },
      ...(topic.faq && topic.faq.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: topic.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <header className="w-full bg-card backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold tracking-tighter">
            EVE
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">
            {POSITIONING.name}
          </span>
        </Link>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
            Pricing
          </Link>
          <Link
            href="/signup"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Start free trial
          </Link>
        </div>
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
            <li aria-current="page" className="text-foreground font-medium truncate">
              {topic.h1}
            </li>
          </ol>
        </nav>

        {/* Hero Area */}
        <div className="space-y-6">
          <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            {topic.badge}
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
            {topic.h1}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
            {topic.heroSubtitle}
          </p>
        </div>

        {/* Introductory Content */}
        <section className="prose dark:prose-invert max-w-none space-y-4">
          <p className="text-base text-foreground leading-relaxed bg-muted/30 p-6 rounded-2xl border border-border/60">
            {topic.introText}
          </p>
        </section>

        {/* Problem Breakdown */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {topic.problemTitle}
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            {topic.problemContent}
          </p>
        </section>

        {/* Detailed Feature Sections */}
        <div className="space-y-8">
          {topic.sections.map((sec, idx) => (
            <section key={idx} className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {sec.h2}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {sec.content}
              </p>
              {sec.highlights && sec.highlights.length > 0 && (
                <ul className="space-y-2 pt-2 list-none">
                  {sec.highlights.map((h, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-foreground">
                      <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Related Glossary Terms */}
        {topic.relatedGlossarySlugs && topic.relatedGlossarySlugs.length > 0 && (
          <section className="border-t border-border pt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              Key Concepts &amp; Definitions
            </h2>
            <div className="flex flex-wrap gap-2">
              {topic.relatedGlossarySlugs.map((gSlug) => (
                <Link
                  key={gSlug}
                  href={`/glossary#${gSlug}`}
                  className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:border-indigo-500 hover:text-indigo-600 transition-colors"
                >
                  {gSlug.replace(/-/g, " ")} →
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQ Section */}
        {topic.faq && topic.faq.length > 0 && (
          <section className="border-t border-border pt-8 space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <HelpCircle className="text-indigo-600" size={24} />
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {topic.faq.map((f, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
                  <h3 className="text-base font-bold text-foreground">{f.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related Topic Links */}
        {topic.relatedTopics && topic.relatedTopics.length > 0 && (
          <section className="border-t border-border pt-8 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Related EVE Solutions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {topic.relatedTopics.map((rt) => (
                <Link
                  key={rt.slug}
                  href={`/${rt.slug}`}
                  className="p-4 rounded-xl border border-border bg-card hover:border-indigo-500 transition-colors block space-y-1 group"
                >
                  <span className="text-sm font-bold text-foreground group-hover:text-indigo-600 transition-colors">
                    {rt.anchorText}
                  </span>
                  <span className="text-xs text-muted-foreground block">Learn more →</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA Block */}
        <section className="rounded-2xl bg-gradient-to-r from-violet-900 to-indigo-900 text-white p-8 text-center space-y-6">
          <h2 className="text-3xl font-extrabold tracking-tight">
            Ready to Optimize Your Store&apos;s Inventory?
          </h2>
          <p className="text-violet-200 text-sm max-w-xl mx-auto leading-relaxed">
            Upload your native Shopify product CSV and get your first inventory intelligence insights in under 2 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-6 py-3 bg-white text-indigo-950 font-bold rounded-xl text-sm hover:bg-violet-100 transition-colors inline-flex items-center justify-center gap-2"
            >
              Start 14-Day Free Trial <ArrowRight size={16} />
            </Link>
            <Link
              href="/demo"
              className="w-full sm:w-auto px-6 py-3 bg-violet-800/60 border border-violet-400/30 text-white font-semibold rounded-xl text-sm hover:bg-violet-800 transition-colors"
            >
              Explore Live Demo
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
