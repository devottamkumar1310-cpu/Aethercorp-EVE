"use client";

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

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
          href="/signup" 
          className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Signup
        </Link>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl space-y-8">
          <div className="flex items-center gap-3 border-b border-border pb-6">
            <div className="p-3 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Privacy Policy</h1>
              <p className="text-muted-foreground text-sm mt-1">Effective Date: June 23, 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
              <p>
                EVE ("we", "us", or "our") values your privacy. This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our platform, services, and website. By accessing or using EVE, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
              <p className="font-medium text-foreground">a. Personal Information</p>
              <p>
                When you sign up or interact with EVE, we collect personal details including, but not limited to, your name, email address, company name, billing information, and authentication credentials managed via Supabase.
              </p>
              <p className="font-medium text-foreground">b. Business and Inventory Data</p>
              <p>
                To provide our AI-generated business recommendations, inventory forecasting, and planning workflows, we process documents, financial records, inventory tables, and transaction logs that you upload or integrate into EVE.
              </p>
              <p className="font-medium text-foreground">c. Usage Data & Cookies</p>
              <p>
                We automatically collect usage metrics, IP addresses, browser information, and session data. We use essential authentication cookies (via Supabase) to maintain your login session.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">3. Third-Party Services & AI Processing</h2>
              <p>
                EVE utilizes advanced large language models (specifically Google Gemini APIs) to power the EVE AI Command Center, generate strategic advice, and analyze business documents.
              </p>
              <div className="bg-background border border-border rounded-lg p-4 text-sm text-muted-foreground">
                <span className="font-semibold text-indigo-400">Notice on Data Processing:</span> We transmit context from your uploaded business documents and conversation threads to Google Gemini API services. We do not permit Google to use your business data or sensitive documents to train their public models.
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">4. Data Retention & Deletion</h2>
              <p>
                We store your profile data, chat history, and uploaded documents for as long as your account remains active. You can delete your account at any time via the Settings page. Account deletion permanently removes all associated data from our systems and cannot be undone.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">5. Security</h2>
              <p>
                We implement industry-standard encryption protocols and secure database designs (including Supabase authentication and row-level security policy checks) to safeguard your data. However, no database or transmission channel is completely secure. Always verify recommendations and secure authorization before processing financial or operational data.
              </p>
            </section>

            <section className="space-y-3 border-t border-border pt-6">
              <h2 className="text-xl font-semibold text-foreground">6. Contact Us</h2>
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us at:
              </p>
              <p className="text-indigo-400">support@eveinventory.in</p>
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
