import Link from "next/link";
import type { Metadata } from "next";
import { Mail, ArrowRight, ArrowUpRight } from "lucide-react";
import { BookDemoButton } from "@/components/marketing/BookDemoButton";

export const metadata: Metadata = {
  title: "Contact EVE",
  description: "Get in touch with the EVE team by email or on LinkedIn.",
};

// LinkedIn brand mark (lucide dropped brand icons); inherits currentColor.
function LinkedInIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

const SUPPORT_EMAIL = "support@eveinventory.in";
const LINKEDIN_URL = "https://www.linkedin.com/company/135245277/";

export default function ContactPage() {
  return (
    <div className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Skip link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Header */}
      <header className="w-full border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 rounded-xl" aria-label="EVE home">
            <div className="h-9 w-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-md shadow-violet-600/25">
              EVE
            </div>
            <span className="text-base font-extrabold tracking-tight text-foreground">EVE</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold px-4 py-2 rounded-lg text-foreground hover:text-[color:var(--eve-accent)] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow-md"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main id="main" className="flex-1 flex items-center justify-center px-4 sm:px-6 py-16 sm:py-24">
        <div className="w-full max-w-2xl space-y-10">
          <div className="text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider t-accent">Contact</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Get in touch with EVE
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Questions about whether EVE fits your catalogue? Book 15 minutes and we&apos;ll
              look at your inventory together — or just email, and a human replies.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Support Email */}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="group p-6 rounded-2xl border border-border bg-card shadow-sm space-y-3 hover:border-[color:var(--eve-accent)]/40 hover:-translate-y-1 hover:shadow-lg motion-reduce:hover:translate-y-0 transition-all duration-200"
            >
              <div className="tile-accent h-11 w-11 rounded-xl flex items-center justify-center">
                <Mail size={20} aria-hidden />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold text-foreground">Support Email</div>
                <div className="text-xs text-muted-foreground break-all group-hover:text-foreground transition-colors">
                  {SUPPORT_EMAIL}
                </div>
              </div>
            </a>

            {/* LinkedIn */}
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="EVE on LinkedIn (opens in a new tab)"
              className="group p-6 rounded-2xl border border-border bg-card shadow-sm space-y-3 hover:border-[color:var(--eve-accent)]/40 hover:-translate-y-1 hover:shadow-lg motion-reduce:hover:translate-y-0 transition-all duration-200"
            >
              <div className="tile-accent h-11 w-11 rounded-xl flex items-center justify-center">
                <LinkedInIcon size={20} />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold text-foreground inline-flex items-center gap-1">
                  LinkedIn <ArrowUpRight size={13} className="text-muted-foreground" aria-hidden />
                </div>
                <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  Follow EVE for updates
                </div>
              </div>
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <BookDemoButton
              variant="primary"
              location="contact_main"
              className="w-full sm:w-auto px-6 py-3 text-sm"
            />
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border hover:border-[color:var(--eve-accent)]/40 rounded-xl transition-all"
            >
              Start free trial
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-background border-t border-border px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} EVE Inc. All rights reserved.</div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground transition-colors">{SUPPORT_EMAIL}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
