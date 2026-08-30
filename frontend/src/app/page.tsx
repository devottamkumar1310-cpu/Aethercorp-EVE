import type { Metadata } from "next";
import { POSITIONING } from "@/lib/config";
import LandingPageClient from "@/components/marketing/LandingPageClient";

export const metadata: Metadata = {
  title: `${POSITIONING.name} — ${POSITIONING.tagline}`,
  description:
    "EVE is the AI inventory intelligence platform for Shopify & D2C fashion brands. Predict stockouts before they happen, surface cash trapped in dead stock, and get size and colour reorder recommendations.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${POSITIONING.name} — ${POSITIONING.tagline}`,
    description:
      "EVE is the AI inventory intelligence platform for Shopify & D2C fashion brands. Predict stockouts before they happen, surface cash trapped in dead stock, and get size and colour reorder recommendations.",
    url: POSITIONING.domain,
    siteName: POSITIONING.name,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${POSITIONING.name} — ${POSITIONING.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${POSITIONING.name} — ${POSITIONING.tagline}`,
    description:
      "EVE is the AI inventory intelligence platform for Shopify & D2C fashion brands. Predict stockouts before they happen, surface cash trapped in dead stock, and get size and colour reorder recommendations.",
    images: ["/opengraph-image"],
  },
};

export default function LandingPage() {
  return <LandingPageClient />;
}
