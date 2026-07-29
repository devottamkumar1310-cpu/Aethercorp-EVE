import { ImageResponse } from "next/og";
import { POSITIONING } from "@/lib/config";

export const alt = `${POSITIONING.name} — ${POSITIONING.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Every cold email, LinkedIn DM and Slack paste of an EVE link renders this
 * card. It is the single most-viewed piece of design in a founder-led outbound
 * motion — a missing OG image reads as "unfinished product" before anyone
 * clicks. Kept text-only so it renders without remote font or image fetches.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0f0d1f 0%, #1e1b4b 55%, #312e81 100%)",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            EVE
          </div>
          <div
            style={{
              color: "#c7d2fe",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {POSITIONING.category}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              color: "white",
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              maxWidth: 940,
            }}
          >
            Know what to reorder. Before you sell out.
          </div>
          <div
            style={{
              color: "#a5b4fc",
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1.35,
              maxWidth: 900,
            }}
          >
            Inventory intelligence for Shopify fashion brands — stockout risk,
            dead stock, and size-level reorder calls.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(165,180,252,0.25)",
            paddingTop: "28px",
          }}
        >
          <div style={{ color: "#e0e7ff", fontSize: 24, fontWeight: 600 }}>
            eveinventory.in
          </div>
          <div style={{ color: "#818cf8", fontSize: 22, fontWeight: 500 }}>
            Import your Shopify export in 60 seconds
          </div>
        </div>
      </div>
    ),
    size
  );
}
