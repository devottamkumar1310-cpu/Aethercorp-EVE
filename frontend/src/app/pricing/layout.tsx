import type { Metadata } from "next";
import { POSITIONING, PRICING } from "@/lib/config";

/**
 * The pricing page is a client component (it owns form state), so it cannot
 * export metadata itself. This layout supplies it — without this the page
 * inherits the root title and competes with the homepage for the same query.
 */
export const metadata: Metadata = {
  title: "Pricing",
  description: `${POSITIONING.name} pricing. ${PRICING.subheadline}`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: `Pricing | ${POSITIONING.name}`,
    description: PRICING.subheadline,
    url: `${POSITIONING.domain}/pricing`,
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
