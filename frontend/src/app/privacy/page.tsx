"use client";

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

/**
 * Privacy Policy.
 *
 * Every factual claim here was checked against the implementation. Where the
 * code does not support a claim, the claim is not made — notably:
 *  - EVE does NOT use Postgres row-level security. Tenant isolation is enforced
 *    in the application layer, and the text says exactly that.
 *  - No compliance certification (GDPR/CCPA/SOC 2/ISO 27001) is asserted.
 *  - No fixed retention period is asserted, because none is implemented.
 *  - Payment data is not described as collected, because billing is not enabled.
 *
 * Items that need a decision from the business owner or a lawyer (legal entity,
 * jurisdiction, formal DPA/subprocessor commitments) are called out in the
 * "Information still to be confirmed" section rather than invented.
 */
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="w-full bg-card backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold tracking-tighter">
            EVE
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">Privacy Policy</span>
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
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Privacy Policy</h1>
              <p className="text-muted-foreground text-sm mt-1">Last updated: August 16, 2026</p>
            </div>
          </div>

          <div className="space-y-8 text-muted-foreground leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">1. Scope</h2>
              <p>
                This policy explains what data EVE (&quot;we&quot;, &quot;us&quot;) handles when you use the
                EVE inventory intelligence platform, why we handle it, and what
                choices you have. It describes how the product actually works
                today. Where a capability is not yet enabled, we say so rather
                than describing an intended future state.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">2. Account and authentication data</h2>
              <p>
                Sign-in is handled by Supabase Auth, either with Google sign-in
                or with an email address and password. When you use Google
                sign-in, Google returns your email address, name and profile
                image URL to Supabase; we never see your Google password. When
                you use a password, it is stored and verified by Supabase, not by
                EVE.
              </p>
              <p>
                We store a profile record containing your email address, display
                name, optional avatar URL, timezone and language preference, plan
                type, and trial dates.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">3. Workspace data</h2>
              <p>
                EVE organises everything into workspaces. We store the workspace
                name and identifier, and the membership records that link
                accounts to workspaces along with their role (owner, admin or
                member). Every workspace is a separate tenant boundary.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">4. Business data you provide or import</h2>
              <p>
                EVE analyses inventory data that you upload as a file or import
                from a connected Shopify store: products and variants, SKUs,
                sizes and colours, unit cost, selling price, stock levels, lead
                times, supplier names, and sales history.
              </p>
              <div className="bg-background border border-border rounded-lg p-4 text-sm">
                <span className="font-semibold text-foreground">What EVE does not import from Shopify:</span>{" "}
                when EVE syncs orders, it stores only the product, date, quantity
                and unit price needed to compute sales velocity. It does not
                import or store your customers&apos; names, email addresses,
                shipping addresses, phone numbers or payment details.
              </div>
              <p>
                If you upload documents such as supplier invoices, the file and
                the values extracted from it are stored in your workspace.
                Uploads are limited to 10&nbsp;MB per file and are subject to a
                per-workspace storage quota.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">5. Connected store credentials</h2>
              <p>
                When you connect a Shopify store, Shopify issues EVE an access
                token. That token is encrypted before it is written to our
                database, using authenticated encryption with a key derived from
                a deployment secret held in Google Cloud Secret Manager. EVE
                requests read-only Shopify permissions
                (<code className="text-xs">read_products</code>,{" "}
                <code className="text-xs">read_inventory</code>,{" "}
                <code className="text-xs">read_orders</code>) and never writes
                back to your store. Disconnecting a store removes the stored
                token.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">6. AI processing</h2>
              <p>
                EVE uses Google&apos;s Gemini API to turn the results of its own
                calculations into written analysis. The prompts we send can
                include inventory figures from the workspace you are asking
                about — for example SKUs, stock levels, costs, prices and sales
                velocity. We do not send your account password, your Shopify
                access token, or any other credential to the model.
              </p>
              <p>
                Google processes this data as our service provider under the
                Google APIs Terms of Service and the Gemini API terms that apply
                to paid API usage. We do not control Google&apos;s own retention
                or processing practices; please refer to Google&apos;s
                documentation for those details.
              </p>
              <p>
                We record metadata about each AI call — the model used, token
                counts, latency and computed cost — so we can monitor spend and
                reliability.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">7. Recommendations and decision traces</h2>
              <p>
                When EVE produces a recommendation, it stores a trace of how that
                recommendation was reached: the figures used, the reasoning
                steps, confidence and validation status, the model and model
                version, and a snapshot of the prompt and response. This exists
                so you can audit any number EVE shows you. These traces live
                inside your workspace and are visible only to its members.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">8. Messaging channels</h2>
              <p className="font-medium text-foreground">Telegram</p>
              <p>
                If you link a Telegram account, EVE stores a salted one-way hash
                of your Telegram chat identifier, plus the identifier itself in
                encrypted form so it can send you replies. The text of a message
                you send is processed to answer your question. Linking uses a
                single-use, expiring code issued from inside your EVE workspace.
                You can unlink at any time from the Integrations page.
              </p>
              <p className="font-medium text-foreground">WhatsApp</p>
              <p>
                WhatsApp support is implemented in EVE but is{" "}
                <span className="font-medium text-foreground">not currently connected to Meta</span>, so no
                WhatsApp messages are being received or processed at this time.
                If that changes, this policy will be updated before the channel
                is enabled.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">9. Usage analytics</h2>
              <p>
                On our public website and in the product we use PostHog to
                understand which pages and features are used. Anonymous visitors
                do not have a profile created for them. Analytics are disabled
                entirely when the PostHog key is not configured. We do not send
                your inventory data to PostHog.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">10. Logs and security records</h2>
              <p>
                We keep application logs and an audit log of significant events —
                sign-in events, uploads, integration changes and AI runs —
                recording the event type, the workspace, the acting account and
                the originating IP address. These records support debugging,
                abuse investigation and billing accuracy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">11. Cookies and local storage</h2>
              <p>
                EVE uses cookies and browser storage that are necessary for the
                service: Supabase authentication tokens that keep you signed in,
                and a local theme preference. Analytics cookies are set by
                PostHog when analytics is enabled. We do not use advertising
                cookies and we do not sell personal information.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">12. Service providers</h2>
              <p>The following providers process data on our behalf:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><span className="text-foreground font-medium">Google Cloud Platform</span> — application hosting (Cloud Run), file storage, and secret management.</li>
                <li><span className="text-foreground font-medium">Google Gemini API</span> — AI analysis, as described above.</li>
                <li><span className="text-foreground font-medium">Supabase</span> — authentication and identity.</li>
                <li><span className="text-foreground font-medium">Vercel</span> — hosting and delivery of the web interface.</li>
                <li><span className="text-foreground font-medium">A managed PostgreSQL provider</span> — the application database.</li>
                <li><span className="text-foreground font-medium">PostHog</span> — product analytics.</li>
                <li><span className="text-foreground font-medium">Shopify</span> and <span className="text-foreground font-medium">Telegram</span> — only where you have connected them.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">13. Where data is processed</h2>
              <p>
                EVE&apos;s application servers run in Google Cloud&apos;s
                <span className="whitespace-nowrap"> us-central1</span> region in
                the United States. Our other providers may process data in the
                United States or in other countries. If you are located
                elsewhere, using EVE involves transferring your data across
                borders.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">14. Retention and deletion</h2>
              <p>
                We keep your data for as long as your account is active. We have
                not yet set fixed retention periods for logs and audit records;
                when we do, this policy will state them.
              </p>
              <p>
                You can delete your account from the Settings page. Deletion
                removes your profile, deletes every workspace that you solely
                own together with the inventory, sales, document and
                recommendation data inside it, deletes your uploaded files from
                storage, and deletes your authentication record. If you share a
                workspace with another owner, that workspace and its data
                continue to exist and only your membership is removed. Deletion
                is not reversible by you or by us through the product.
              </p>
              <p>
                We cannot guarantee immediate erasure from provider-side
                infrastructure such as database snapshots or backups held by our
                hosting providers, which are outside our direct control and
                expire on their own schedules.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">15. Access and export</h2>
              <p>
                Your inventory, recommendations and decision traces are visible
                to you in the product at any time. For a copy of your data, or a
                question about what we hold, contact us at the address below and
                we will respond directly.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">16. How we protect data</h2>
              <p>These are the measures actually implemented in EVE today:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Third-party access tokens are encrypted at rest with authenticated encryption.</li>
                <li>Messaging identifiers are stored as salted one-way hashes.</li>
                <li>Every request is scoped to a workspace in the application layer, and every sensitive endpoint checks authentication, workspace membership and role.</li>
                <li>Incoming webhooks are rejected unless they carry a valid signature or secret — Shopify HMAC, a Telegram secret token, and a Meta signature — and repeated deliveries are de-duplicated.</li>
                <li>Deployment secrets are held in Google Cloud Secret Manager, not in the codebase.</li>
                <li>Traffic to EVE is served over HTTPS by our hosting providers.</li>
              </ul>
              <p>
                To be precise about one point: EVE enforces tenant separation in
                its application code, not with PostgreSQL row-level security. No
                system is perfectly secure, and we do not claim to hold any
                security certification.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">17. Children</h2>
              <p>
                EVE is a business tool and is not directed at children. We do not
                knowingly collect data from anyone under 18.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">18. Changes to this policy</h2>
              <p>
                If we change this policy we will update the date at the top of
                this page. For changes that materially affect how we handle your
                data, we will notify account holders by email before the change
                takes effect.
              </p>
            </section>

            <section className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <h2 className="text-lg font-semibold text-foreground">Information still to be confirmed</h2>
              <p className="text-sm">
                EVE is operated by an independent founder and is early in its
                life. The following are deliberately not stated here because they
                require a business or legal decision rather than a technical one:
                the operating legal entity and registered address, the governing
                jurisdiction, formal data-processing agreements with the
                providers listed above, statutory rights processes under specific
                privacy regimes, and fixed retention periods. If you need any of
                these in writing, contact us and we will address it directly.
              </p>
            </section>

            <section className="space-y-3 border-t border-border pt-6">
              <h2 className="text-xl font-semibold text-foreground">19. Contact</h2>
              <p>
                Questions, data requests, or anything in this policy you think is
                wrong:
              </p>
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
          <Link href="/terms" className="font-medium text-[color:var(--eve-accent)] hover:underline">
            Terms of Service
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
