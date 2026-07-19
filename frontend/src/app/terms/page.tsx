"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="w-full bg-card backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center !text-white [&_svg]:!text-white [&_svg]:!stroke-white font-bold tracking-tighter">
            EVE
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">Terms of Service</span>
        </div>
        <Link 
          href="/signup" 
          className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Signup
        </Link>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl space-y-8">
          <div className="flex items-center gap-3 border-b border-border pb-6">
            <div className="p-3 bg-indigo-600/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white rounded-lg">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Terms of Service</h1>
              <p className="text-muted-foreground text-sm mt-1">Effective Date: June 23, 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">1. Agreement to Terms</h2>
              <p>
                By creating an account, accessing, or using the EVE platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access or use the services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">2. Purpose and Scope of Services</h2>
              <p>
                EVE provides AI-driven analytical tools, data visualization, business intelligence dashboards, and command workflows designed for D2C and ecommerce inventory operations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">3. User Responsibilities & Data Authorization</h2>
              <p>
                You represent and warrant that you own or have obtained all necessary licenses, consents, and permissions to upload, process, and store any business documents, financial records, or operational data you supply to the platform.
              </p>
              <div className="bg-background border border-border rounded-lg p-4 text-sm text-muted-foreground">
                <span className="font-semibold text-amber-500">Document Upload Disclaimer:</span> You must only upload business documents that you are authorized to process. EVE reserves the right to reject unsupported or unauthorized documents.
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">4. AI-Generated Recommendations Disclaimer</h2>
              <p>
                EVE provides AI-generated business recommendations, forecasts, risk profiles, and operational insights. These recommendations are based on statistical inferences, historical patterns, and natural language models.
              </p>
              <p className="font-medium text-foreground">
                EVE provides AI-generated business recommendations. Always verify information before making financial or operational decisions.
              </p>
              <p>
                We make no warranties, express or implied, regarding the accuracy, completeness, or reliability of AI outputs or automated computations. You accept full responsibility for any actions taken or decisions made based on platform recommendations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">5. Account Termination & Deletion</h2>
              <p>
                We reserve the right to suspend or terminate your account at our sole discretion. You may delete your account at any time. Please note: Deleting your account permanently removes all associated data and cannot be undone.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">6. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, EVE and its affiliates shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, use, goodwill, or other intangible losses arising out of or related to your use of EVE.
              </p>
            </section>

            <section className="space-y-3 border-t border-border pt-6">
              <h2 className="text-xl font-semibold text-foreground">7. Governing Law</h2>
              <p>
                These terms are governed by and construed in accordance with the laws of the jurisdiction of our incorporation, without regard to conflict of law principles.
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground bg-background">
        &copy; {new Date().getFullYear()} EVE. All rights reserved.
      </footer>
    </div>
  );
}
