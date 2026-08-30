import type { MetadataRoute } from "next";
import { POSITIONING } from "@/lib/config";
import { COMPARISONS } from "@/lib/comparisons";
import { TOPIC_PAGES } from "@/lib/topicPages";
import { ARTICLES } from "@/lib/resources";

/**
 * Only public, indexable marketing routes belong here. Adding authenticated
 * routes to a sitemap is a common own-goal: it tells Google to crawl pages
 * that return a login redirect, which suppresses crawl budget for the pages
 * that actually convert.
 */
const ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
  { path: "/demo", priority: 0.8, changeFrequency: "monthly" },
  { path: "/glossary", priority: 0.7, changeFrequency: "monthly" },
  { path: "/resources", priority: 0.8, changeFrequency: "weekly" },
  { path: "/founder", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/signup", priority: 0.7, changeFrequency: "monthly" },
  { path: "/login", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
];

/**
 * Comparison pages generated from COMPARISONS data module.
 */
const COMPARISON_ROUTES: typeof ROUTES = [
  { path: "/vs", priority: 0.8, changeFrequency: "monthly" },
  ...COMPARISONS.map((c) => ({
    path: `/vs/${c.slug}`,
    priority: 0.7,
    changeFrequency: "monthly" as const,
  })),
];

/**
 * High-value SEO topic pages generated from TOPIC_PAGES.
 */
const TOPIC_ROUTES: typeof ROUTES = Object.keys(TOPIC_PAGES).map((slug) => ({
  path: `/${slug}`,
  priority: 0.85,
  changeFrequency: "weekly" as const,
}));

/**
 * Educational resource articles generated from ARTICLES.
 */
const RESOURCE_ROUTES: typeof ROUTES = ARTICLES.map((a) => ({
  path: `/resources/${a.slug}`,
  priority: 0.75,
  changeFrequency: "monthly" as const,
}));

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [...ROUTES, ...TOPIC_ROUTES, ...RESOURCE_ROUTES, ...COMPARISON_ROUTES].map(
    ({ path, priority, changeFrequency }) => ({
      url: `${POSITIONING.domain}${path}`,
      lastModified,
      changeFrequency,
      priority,
    })
  );
}
