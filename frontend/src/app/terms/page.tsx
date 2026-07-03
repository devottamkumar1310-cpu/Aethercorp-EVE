"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900/80 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <header className="w-full bg-slate-100 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-slate-900 dark:text-slate-100 dark:text-white font-bold tracking-tighter">
            EVE
          </div>
          <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 dark:text-white">Terms of Service</span>
        </div>
        <Link 
          href="/signup" 
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 dark:text-white flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Signup
        </Link>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12">
        <div className="bg-slate-100 dark:bg-slate-900/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-lg">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 dark:text-white tracking-tight">Terms of Service</h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Effective Date: June 23, 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">1. Agreement to Terms</h2>
              <p>
                By creating an account, accessing, or using the Enterprise Virtual Executive ("EVE") platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access or use the services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">2. Purpose and Scope of Services</h2>
              <p>
                EVE provides AI-driven analytical tools, data visualization, business intelligence dashboards, and command workflows designed for D2C fashion and inventory operations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">3. User Responsibilities & Data Authorization</h2>
              <p>
                You represent and warrant that you own or have obtained all necessary licenses, consents, and permissions to upload, process, and store any business documents, financial records, or operational data you supply to the platform.
              </p>
              <div className="bg-slate-50 dark:bg-slate-900/80 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-amber-500">Document Upload Disclaimer:</span> You must only upload business documents that you are authorized to process. EVE reserves the right to reject unsupported or unauthorized documents.
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">4. AI-Generated Recommendations Disclaimer</h2>
              <p>
                EVE provides AI-generated business recommendations, forecasts, risk profiles, and operational insights. These recommendations are based on statistical inferences, historical patterns, and natural language models.
              </p>
              <p className="font-medium text-slate-800 dark:text-slate-200">
                EVE provides AI-generated business recommendations. Always verify information before making financial or operational decisions.
              </p>
              <p>
                We make no warranties, express or implied, regarding the accuracy, completeness, or reliability of AI outputs or automated computations. You accept full responsibility for any actions taken or decisions made based on platform recommendations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">5. Account Termination & Deletion</h2>
              <p>
                We reserve the right to suspend or terminate your account at our sole discretion. You may delete your account at any time. Please note: Deleting your account permanently removes all associated data and cannot be undone.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">6. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Aethercorp and its affiliates shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, use, goodwill, or other intangible losses arising out of or related to your use of EVE.
              </p>
            </section>

            <section className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">7. Governing Law</h2>
              <p>
                These terms are governed by and construed in accordance with the laws of the jurisdiction of our incorporation, without regard to conflict of law principles.
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/80 dark:bg-slate-950">
        &copy; {new Date().getFullYear()} Aethercorp EVE. All rights reserved.
      </footer>
    </div>
  );
}
