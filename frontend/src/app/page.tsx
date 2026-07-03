import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900/80 flex flex-col font-sans">
      <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-slate-900 dark:text-slate-100 dark:text-white font-bold tracking-tighter">
            EVE
          </div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-200 tracking-tight">Enterprise Virtual Executive</h1>
        </div>
        <div className="space-x-4">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-100 transition-colors">
            Sign In
          </Link>
          <Link 
            href="/signup" 
            className="text-sm font-medium bg-indigo-600 text-slate-900 dark:text-slate-100 dark:text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="max-w-3xl space-y-8">
          <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm text-indigo-800">
            <Sparkles className="mr-2 h-4 w-4" />
            The AI COO for D2C Fashion Brands
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-slate-900 dark:text-slate-100 leading-tight">
            Stop Guessing. <br /> Start Forecasting.
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            EVE analyzes your inventory, predicts stockouts, and simulates pricing strategies so you can scale your fashion brand with deterministic confidence.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link 
              href="/signup" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-slate-900 dark:text-slate-100 dark:text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
