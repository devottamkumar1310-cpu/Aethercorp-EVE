"use client";

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900/80 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <header className="w-full bg-slate-100 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-slate-900 dark:text-slate-100 dark:text-white font-bold tracking-tighter">
            EVE
          </div>
          <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 dark:text-white">Privacy Policy</span>
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
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 dark:text-white tracking-tight">Privacy Policy</h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Effective Date: June 23, 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">1. Introduction</h2>
              <p>
                Enterprise Virtual Executive ("EVE", "we", "us", or "our") values your privacy. This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our platform, services, and website. By accessing or using EVE, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">2. Information We Collect</h2>
              <p className="font-medium text-slate-800 dark:text-slate-200">a. Personal Information</p>
              <p>
                When you sign up or interact with EVE, we collect personal details including, but not limited to, your name, email address, company name, billing information, and authentication credentials managed via Supabase.
              </p>
              <p className="font-medium text-slate-800 dark:text-slate-200">b. Business and Inventory Data</p>
              <p>
                To provide our AI-generated business recommendations, deterministic forecasting, and COO workflows, we process documents, financial records, inventory tables, and transaction logs that you upload or integrate into EVE.
              </p>
              <p className="font-medium text-slate-800 dark:text-slate-200">c. Usage Data & Cookies</p>
              <p>
                We automatically collect usage metrics, IP addresses, browser information, and session data. We use essential authentication cookies (via Supabase) to maintain your login session.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">3. Third-Party Services & AI Processing</h2>
              <p>
                EVE utilizes advanced large language models (specifically Google Gemini APIs) to power the EVE AI Command Center, generate strategic advice, and analyze business documents.
              </p>
              <div className="bg-slate-50 dark:bg-slate-900/80 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-indigo-400">Notice on Data Processing:</span> We transmit context from your uploaded business documents and conversation threads to Google Gemini API services. We do not permit Google to use your business data or sensitive documents to train their public models.
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">4. Data Retention & Deletion</h2>
              <p>
                We store your profile data, chat history, and uploaded documents for as long as your account remains active. You can delete your account at any time via the Settings page. Account deletion permanently removes all associated data from our systems and cannot be undone.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">5. Security</h2>
              <p>
                We implement industry-standard encryption protocols and secure database designs (including Supabase authentication and row-level security policy checks) to safeguard your data. However, no database or transmission channel is completely secure. Always verify recommendations and secure authorization before processing financial or operational data.
              </p>
            </section>

            <section className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 dark:text-white">6. Contact Us</h2>
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us at:
              </p>
              <p className="text-indigo-400">aethercorp.support@gmail.com</p>
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
