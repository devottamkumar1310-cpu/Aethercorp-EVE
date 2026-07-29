import type { MetadataRoute } from "next";
import { POSITIONING } from "@/lib/config";

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
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/signup", priority: 0.7, changeFrequency: "monthly" },
  { path: "/login", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${POSITIONING.domain}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
