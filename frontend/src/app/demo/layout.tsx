import type { Metadata } from "next";
import { POSITIONING } from "@/lib/config";

export const metadata: Metadata = {
  title: "Live demo — see EVE on a real fashion catalogue",
  description:
    "Open a real EVE workspace built on a premium womenswear catalogue: stockout risk ranked by revenue exposure, dead stock with the capital tied up in it, and variant-level reorder calls. No sales call.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: `Live demo | ${POSITIONING.name}`,
    description:
      "See exactly what EVE surfaces for a real fashion catalogue — stockout risk, dead stock, and reorder quantities at size and colour level.",
    url: `${POSITIONING.domain}/demo`,
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
