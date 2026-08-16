"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

/**
 * Terms of Service.
 *
 * Written against what EVE actually does. Plan names, prices, limits and the
 * trial length match app/core/plans.py, which is the single source of truth the
 * pricing page also reads from. Billing is described as not yet enabled because
 * no payment processing is live.
 *
 * Governing law, the operating legal entity, and any arbitration or venue terms
 * are NOT asserted — those require a decision from the owner and a lawyer, and
 * are flagged as outstanding rather than invented.
 */
export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="w-full bg-card backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold tracking-tighter">
            EVE
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">Terms of Service</span>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to EVE
        </Link>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl space-y-8">
          <div className="flex items-center gap-3 border-b border-border pb-6">
            <div className="p-3 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Terms of Service</h1>
              <p className="text-muted-foreground text-sm mt-1">Last updated: August 16, 2026</p>
            </div>
          </div>

          <div className="space-y-8 text-muted-foreground leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">1. Agreement</h2>
              <p>
                By creating an account or using EVE you agree to these terms. If
                you do not agree, do not use the service. If you are using EVE on
                behalf of a business, you confirm you are authorised to accept
                these terms for that business.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">2. What EVE does</h2>
              <p>
                EVE is inventory intelligence for Shopify fashion brands. You
                upload a product export or connect a Shopify store, and EVE
                analyses stock levels and sales history to show stockout risk,
                dead stock and suggested reorder quantities, with an explanation
                of the data behind each figure. You can reach the same analysis
                from the dashboard or from a linked Telegram account.
              </p>
              <p>
                EVE reads from your connected store. It does not place orders,
                change stock levels, or write anything back to Shopify.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">3. Your account</h2>
              <p>
                You are responsible for the security of your sign-in method and
                for activity that happens under your account. Workspace owners
                and admins can invite members and connect integrations, and those
                actions affect everyone in the workspace. Tell us promptly if you
                believe an account has been compromised.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">4. Your data and your rights to it</h2>
              <p>
                Your inventory data stays yours. By using EVE you grant us the
                permission needed to store and process that data in order to run
                the service for you — including sending relevant figures to our
                AI provider as described in the{" "}
                <Link href="/privacy" className="font-medium text-[color:var(--eve-accent)] hover:underline">
                  Privacy Policy
                </Link>
                . You confirm you are entitled to supply the data you upload or
                connect.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">5. Acceptable use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>access a workspace, store or account you have not been granted access to, or attempt to defeat EVE&apos;s tenant separation;</li>
                <li>probe, scan or attack the service, or bypass rate limits, plan limits or authentication;</li>
                <li>upload malware, or content you have no right to supply;</li>
                <li>use EVE to build a competing product, or resell access without agreement;</li>
                <li>submit prompts intended to make EVE disclose another workspace&apos;s data or ignore its instructions;</li>
                <li>use EVE for anything unlawful.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">6. Integrations</h2>
              <p>
                Connecting Shopify or Telegram is your choice, and each is
                governed by that provider&apos;s own terms. You are responsible for
                having authority to connect a store. We are not responsible for a
                third-party service changing, failing, or ending access — if that
                happens, the affected EVE feature may stop working.
              </p>
              <p>
                A Shopify store can be connected to one EVE workspace at a time.
                Disconnecting a store, or uninstalling the app from Shopify, stops
                the sync and removes the stored access token.
              </p>
            </section>

            <section className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
              <h2 className="text-xl font-semibold text-foreground">7. AI output is decision support, not advice</h2>
              <p>
                This is the most important term in this document.
              </p>
              <p>
                EVE&apos;s recommendations are generated from statistical
                calculations over the data you provide, with written explanation
                produced by an AI model. They are decision support for a human
                operator. They are{" "}
                <span className="font-medium text-foreground">not</span> financial,
                investment, accounting, tax or legal advice, and they are not a
                guarantee of any commercial outcome.
              </p>
              <p>
                Forecasts can be wrong. Incomplete or inaccurate source data will
                produce inaccurate output, and AI models can produce confident
                but incorrect text.{" "}
                <span className="font-medium text-foreground">
                  You remain responsible for verifying any figure before acting on
                  it
                </span>{" "}
                — particularly before committing money to a purchase order,
                markdown or liquidation. EVE shows the data behind each
                recommendation precisely so you can check it.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">8. Plans, trials and limits</h2>
              <p>
                EVE is offered on three plans — Operator ($49/month or
                $490/year), Command ($149/month or $1,490/year) and Chief
                ($399/month or $3,990/year). Plans differ in how many Shopify
                stores you may connect, how many SKUs EVE will analyse, and which
                channels you can use. Current details are on the{" "}
                <Link href="/pricing" className="font-medium text-[color:var(--eve-accent)] hover:underline">
                  pricing page
                </Link>
                , which reads its figures directly from the service.
              </p>
              <p>
                New workspaces start with a 14-day trial. Plan limits are enforced
                by the service itself: if you exceed the stores or SKUs your plan
                allows, or use a channel your plan does not include, the action is
                refused until you upgrade.
              </p>
              <p>
                Chief includes a fair-use allowance on AI interactions per month.
                This exists to prevent runaway automated usage; normal day-to-day
                use is not expected to reach it.
              </p>
              <div className="bg-background border border-border rounded-lg p-4 text-sm">
                <span className="font-semibold text-foreground">Billing is not enabled yet.</span> EVE
                is not currently taking payments, and no payment details are
                collected. Prices above are the published plan prices. Before any
                charging begins we will publish the payment, renewal, refund and
                cancellation terms and give existing account holders notice.
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">9. Availability</h2>
              <p>
                EVE is provided on an &quot;as available&quot; basis. We have not
                published a service level agreement and do not commit to a
                specific uptime figure. We may change, suspend or discontinue
                features. Where a change would materially reduce what you rely on,
                we will give reasonable notice.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">10. Intellectual property</h2>
              <p>
                EVE — its software, interface, branding and the analysis methods
                behind it — remains ours. These terms grant you a limited,
                non-exclusive, non-transferable right to use the service. You keep
                ownership of your data and of the reports EVE produces from it.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">11. Feedback</h2>
              <p>
                If you send us suggestions, we may use them to improve EVE without
                obligation or payment to you. You do not lose any rights to your
                own data by giving feedback.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">12. Suspension and termination</h2>
              <p>
                You may stop using EVE at any time and delete your account from
                Settings; deletion behaviour is described in the{" "}
                <Link href="/privacy" className="font-medium text-[color:var(--eve-accent)] hover:underline">
                  Privacy Policy
                </Link>
                . We may suspend or terminate an account that breaches these
                terms, or where we must do so to protect the service or other
                users. Where circumstances reasonably allow, we will tell you why.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">13. Disclaimers</h2>
              <p>
                To the fullest extent the law allows, EVE is provided
                &quot;as is&quot; and &quot;as available&quot;, without
                warranties of any kind, whether express or implied, including
                implied warranties of merchantability, fitness for a particular
                purpose, and non-infringement. We do not warrant that the service
                will be uninterrupted, error-free, or that any recommendation will
                produce a particular result.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">14. Limitation of liability</h2>
              <p>
                To the fullest extent the law allows, we are not liable for
                indirect, incidental, special, consequential or punitive damages,
                or for lost profits, lost revenue, lost goodwill, or loss or
                corruption of data, arising from your use of EVE — including
                decisions made in reliance on its output.
              </p>
              <p>
                Nothing in these terms excludes liability that cannot lawfully be
                excluded. Some jurisdictions do not allow certain exclusions, in
                which case the exclusions above apply only as far as permitted.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">15. Changes to these terms</h2>
              <p>
                We may update these terms. The date at the top of this page will
                change, and for material changes we will notify account holders by
                email. Continuing to use EVE after a change takes effect means you
                accept the updated terms.
              </p>
            </section>

            <section className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <h2 className="text-lg font-semibold text-foreground">Terms still to be finalised</h2>
              <p className="text-sm">
                EVE is operated by an independent founder and is early in its
                life. The following are intentionally not stated here because they
                require a business and legal decision, and stating them
                speculatively would be worse than leaving them open: the
                contracting legal entity and its registered address, the governing
                law and venue for disputes, any arbitration or class-action terms,
                a liability cap figure, and the full payment terms that will apply
                once billing is enabled. If you need any of these settled before
                you adopt EVE, contact us and we will deal with it directly.
              </p>
            </section>

            <section className="space-y-3 border-t border-border pt-6">
              <h2 className="text-xl font-semibold text-foreground">16. Contact</h2>
              <p>
                <a
                  href="mailto:support@eveinventory.in"
                  className="font-medium text-[color:var(--eve-accent)] hover:underline"
                >
                  support@eveinventory.in
                </a>
              </p>
            </section>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          See also our{" "}
          <Link href="/privacy" className="font-medium text-[color:var(--eve-accent)] hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground bg-background">
        &copy; {new Date().getFullYear()} EVE. All rights reserved.
      </footer>
    </div>
  );
}
