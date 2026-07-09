import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-secondary flex flex-col font-sans">
      <header className="w-full bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-foreground font-bold tracking-tighter">
            EVE
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Enterprise Virtual Executive</h1>
        </div>
        <div className="space-x-4">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </Link>
          <Link 
            href="/signup" 
            className="text-sm font-medium bg-indigo-600 text-foreground px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="max-w-3xl space-y-8">
          <div className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground">
            <Sparkles className="mr-2 h-4 w-4 text-indigo-400" />
            The Inventory Intelligence Platform for D2C Fashion Brands
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-foreground leading-tight">
            Stop Guessing. <br /> Start Forecasting.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            EVE analyzes your inventory, predicts stockouts, and simulates pricing strategies so you can scale your fashion brand with deterministic confidence.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link 
              href="/signup" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-foreground bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md"
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
