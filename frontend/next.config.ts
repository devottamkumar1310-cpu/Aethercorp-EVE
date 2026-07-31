import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The backend already sends these on its own responses, but the app pages
 * themselves were served with nothing but Vercel's default HSTS — so any site
 * could frame the dashboard and run a UI-redress attack against a signed-in
 * founder.
 *
 * A full Content-Security-Policy is deliberately NOT set here. The root layout
 * relies on an inline theme script (it has to run before paint to avoid a flash
 * of the wrong theme) alongside Next's own inline bootstrap, so a meaningful
 * `script-src` needs nonce plumbing through the layout. Shipping
 * `script-src 'unsafe-inline'` instead would read as protection while providing
 * almost none. Only the framing directive is set below, which needs no nonces.
 * Full CSP is tracked in the security audit and should go out report-only first.
 */
const securityHeaders = [
  // Clickjacking. The app is never meant to be embedded anywhere.
  { key: "X-Frame-Options", value: "DENY" },
  // The modern equivalent of the above, for browsers that prefer CSP framing.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Stop MIME sniffing turning an uploaded file into an executable script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak workspace ids or query strings to third parties via Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No part of EVE uses these capabilities; deny by default.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework version to scanners.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
