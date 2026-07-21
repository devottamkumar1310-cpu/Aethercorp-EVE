"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { fetchBusinessKPIs } from "@/services/businessService";
import { BusinessKPIs } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { BarChart2, ArrowLeft } from "lucide-react";

export default function AnalyticsPage() {
  const [kpis, setKpis] = useState<BusinessKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const data = await fetchBusinessKPIs(session.access_token);
          setKpis(data);
        }
      } catch (err) {
        logger.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 transition-colors duration-200">
      <div className="flex items-center gap-4 text-muted-foreground mb-4">
        <Link href="/dashboard" className="hover:text-blue-600:text-blue-400 flex items-center gap-1"><ArrowLeft size={16}/> Back to Dashboard</Link>
      </div>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><BarChart2 className="text-blue-600"/> Advanced Analytics</h1>
      </div>
      
      {loading ? (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden p-8 animate-pulse">
          <div className="h-6 bg-muted rounded w-1/4 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-6 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
          <div className="mt-8 pt-8 border-t border-border">
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden p-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Business Metrics Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                 <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Conversion Rate</p>
                    <p className="text-2xl font-bold text-foreground">
                        {(((kpis?.active_clients ?? 0) / Math.max(1, kpis?.clients ?? 1)) * 100).toFixed(1)}%
                    </p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground mb-1">Task Velocity</p>
                    <p className="text-2xl font-bold text-foreground">
                        {(((kpis?.completed_tasks ?? 0) / Math.max(1, kpis?.tasks ?? 1)) * 100).toFixed(1)}%
                    </p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground mb-1">Profit Margin</p>
                    <p className="text-2xl font-bold text-foreground">
                        {(((kpis?.profit ?? 0) / Math.max(1, kpis?.revenue ?? 1)) * 100).toFixed(1)}%
                    </p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground mb-1">Active Projects Load</p>
                    <p className="text-2xl font-bold text-foreground">{kpis?.active_projects ?? 0}</p>
                </div>
            </div>
            <div className="mt-8 pt-8 border-t border-border">
                <p className="text-muted-foreground text-sm">More advanced chart visualizations will be enabled in Phase 3 mapping to historical trends.</p>
            </div>
        </div>
      )}
    </div>
  );
}
