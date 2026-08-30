import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLES } from "@/lib/resources";
import { POSITIONING } from "@/lib/config";
import { ArrowRight, CheckCircle2, Clock, Calendar, User } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return ARTICLES.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) return {};

  return {
    title: `${article.title} | ${POSITIONING.name} Resources`,
    description: article.metaDescription,
    alternates: { canonical: `/resources/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.metaDescription,
      url: `${POSITIONING.domain}/resources/${article.slug}`,
      siteName: POSITIONING.name,
      type: "article",
      publishedTime: article.publishedDate,
      authors: [article.author],
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.metaDescription,
      images: ["/opengraph-image"],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${POSITIONING.domain}/resources/${article.slug}#article`,
        url: `${POSITIONING.domain}/resources/${article.slug}`,
        headline: article.title,
        description: article.metaDescription,
        datePublished: article.publishedDate,
        author: {
          "@type": "Person",
          name: article.author,
          url: `${POSITIONING.domain}/founder`,
        },
        publisher: { "@id": `${POSITIONING.domain}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: POSITIONING.domain },
          { "@type": "ListItem", position: 2, name: "Resources", item: `${POSITIONING.domain}/resources` },
          { "@type": "ListItem", position: 3, name: article.title, item: `${POSITIONING.domain}/resources/${article.slug}` },
        ],
      },
    ],
  };

  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
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
        <Link
          href="/signup"
          className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
        >
          Start free
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 space-y-8">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/resources" className="hover:text-foreground transition-colors">
                Resources
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground font-medium truncate">
              {article.title}
            </li>
          </ol>
        </nav>

        {/* Article Header */}
        <div className="space-y-4 border-b border-border pb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            {article.category}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2">
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <User size={14} /> {article.author}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={14} /> {article.publishedDate}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} /> {article.readTime}
            </span>
          </div>
        </div>

        {/* Summary Lead Box */}
        <div className="p-6 rounded-2xl bg-muted/40 border border-border text-base text-foreground leading-relaxed font-medium">
          {article.summary}
        </div>

        {/* Article Sections */}
        <div className="space-y-8 pt-4">
          {article.sections.map((sec, idx) => (
            <section key={idx} className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {sec.h2}
              </h2>
              <p className="text-muted-foreground leading-relaxed text-base">
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

        {/* Target Topic Callout */}
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-6 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            How EVE Automates This
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Instead of manually building spreadsheet models for {article.title.toLowerCase()}, EVE processes your native Shopify export CSV in 60 seconds.
          </p>
          <Link
            href={`/${article.targetTopicSlug}`}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:underline pt-1"
          >
            Learn more about {article.targetTopicAnchor} →
          </Link>
        </div>

        {/* Glossary Terms Link */}
        {article.relatedGlossarySlugs && article.relatedGlossarySlugs.length > 0 && (
          <section className="border-t border-border pt-6 space-y-3">
            <h3 className="text-sm font-bold text-foreground">Related Glossary Terms:</h3>
            <div className="flex flex-wrap gap-2">
              {article.relatedGlossarySlugs.map((gSlug) => (
                <Link
                  key={gSlug}
                  href={`/glossary#${gSlug}`}
                  className="px-3 py-1 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:border-indigo-500 hover:text-indigo-600 transition-colors"
                >
                  {gSlug.replace(/-/g, " ")}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Bottom CTA */}
        <section className="rounded-2xl bg-gradient-to-r from-violet-900 to-indigo-900 text-white p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold">Automate Your Store&apos;s Inventory Today</h2>
          <p className="text-violet-200 text-sm max-w-md mx-auto">
            14-day free trial. One-click Google sign-in. No credit card required.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-6 py-3 bg-white text-indigo-950 font-bold rounded-xl text-sm hover:bg-violet-100 transition-colors inline-flex items-center justify-center gap-2"
            >
              Start Free Trial <ArrowRight size={16} />
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
