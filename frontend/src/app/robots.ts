import type { MetadataRoute } from "next";
import { POSITIONING } from "@/lib/config";

/**
 * Marketing surfaces are open to crawlers — including the AI crawlers, which
 * we explicitly welcome. Authenticated app routes are excluded: they are
 * per-tenant, never useful in an index, and /owner is internal-only.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/owner", "/auth/", "/api/", "/onboarding", "/verify-email", "/reset-password"],
      },
      // Answer engines. Listed explicitly so a future blanket disallow never
      // silently removes EVE from AI retrieval.
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "Claude-Web", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "Applebot-Extended", allow: "/" },
    ],
    sitemap: `${POSITIONING.domain}/sitemap.xml`,
    host: POSITIONING.domain,
  };
}
