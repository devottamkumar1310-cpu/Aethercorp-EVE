import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { POSITIONING } from "@/lib/config";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale:1 was removed deliberately — blocking pinch-zoom is an
  // accessibility failure and a mobile-usability penalty. Founders read this
  // on phones; let them zoom.
  themeColor: "#4f46e5",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Entity consistency: title, description, Open Graph, Twitter and the JSON-LD
 * below all assert the same sentence. Answer engines resolve "what is EVE?"
 * from the agreement between these surfaces, so they must not drift apart.
 * Change POSITIONING in lib/config.ts, never the strings here.
 */
export const metadata: Metadata = {
  metadataBase: new URL(POSITIONING.domain),
  title: {
    default: `${POSITIONING.name} — ${POSITIONING.tagline}`,
    template: `%s | ${POSITIONING.name}`,
  },
  description: POSITIONING.description,
  applicationName: POSITIONING.name,
  keywords: [
    "Shopify inventory management",
    "fashion inventory planning",
    "inventory forecasting Shopify",
    "dead stock analysis",
    "stockout prevention",
    "reorder planning",
    "size curve planning",
    "D2C inventory intelligence",
  ],
  authors: [{ name: POSITIONING.legalName, url: POSITIONING.domain }],
  creator: POSITIONING.legalName,
  publisher: POSITIONING.legalName,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: POSITIONING.name,
    title: `${POSITIONING.name} — ${POSITIONING.tagline}`,
    description: POSITIONING.description,
    url: POSITIONING.domain,
    locale: "en_US",
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
    description: POSITIONING.description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

/**
 * Organization + WebSite + SoftwareApplication JSON-LD.
 *
 * The machine-readable version of the positioning sentence. This is what lets
 * an answer engine state the category ("inventory intelligence"), the audience
 * ("Shopify fashion brands") and the price without inferring them.
 */
function StructuredData() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${POSITIONING.domain}/#organization`,
        name: POSITIONING.name,
        legalName: POSITIONING.legalName,
        url: POSITIONING.domain,
        description: POSITIONING.oneLiner,
        email: POSITIONING.supportEmail,
        sameAs: [POSITIONING.linkedIn],
      },
      {
        "@type": "WebSite",
        "@id": `${POSITIONING.domain}/#website`,
        url: POSITIONING.domain,
        name: POSITIONING.name,
        description: POSITIONING.description,
        publisher: { "@id": `${POSITIONING.domain}/#organization` },
        inLanguage: "en-US",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${POSITIONING.domain}/#software`,
        name: POSITIONING.name,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Inventory Management Software",
        operatingSystem: "Web",
        description: POSITIONING.description,
        url: POSITIONING.domain,
        publisher: { "@id": `${POSITIONING.domain}/#organization` },
        audience: {
          "@type": "BusinessAudience",
          audienceType: POSITIONING.audience,
        },
        featureList: [
          "Stockout risk prediction",
          "Dead stock capital analysis",
          "Variant-level size and colour velocity",
          "Reorder recommendations",
          "Shopify CSV import",
          "AI executive assistant",
        ],
        offers: {
          "@type": "Offer",
          name: "Early Access Waitlist",
          url: `${POSITIONING.domain}/pricing`,
        },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="executive-light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <StructuredData />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme') || 'executive-light';
                  var active = stored;
                  if (stored === 'system') {
                    active = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'executive-light';
                  }
                  document.documentElement.setAttribute('data-theme', active);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AnalyticsProvider />
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
