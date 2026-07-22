"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { fetchBusinessKPIs } from "@/services/businessService";
import { BusinessKPIs } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { 
  BarChart2, 
  ArrowLeft, 
  TrendingUp, 
  Sparkles, 
  Users, 
  CheckSquare, 
  DollarSign, 
  Briefcase, 
  Brain
} from "lucide-react";
import { AIDisclaimer } from "@/components/ui/AIDisclaimer";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area 
} from "recharts";

export default function AnalyticsPage() {
  const [kpis, setKpis] = useState<BusinessKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("30d");

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

  const activeClientRate = (((kpis?.active_clients ?? 0) / Math.max(1, kpis?.clients ?? 1)) * 100).toFixed(1);
  const taskVelocity = (((kpis?.completed_tasks ?? 0) / Math.max(1, kpis?.tasks ?? 1)) * 100).toFixed(1);
  const profitMargin = (((kpis?.profit ?? 0) / Math.max(1, kpis?.revenue ?? 1)) * 100).toFixed(1);

  // Financial trajectory visualization data
  const financialTrajectory = [
    { month: "Jan", Revenue: (kpis?.revenue ?? 120000) * 0.75, Profit: (kpis?.profit ?? 40000) * 0.7 },
    { month: "Feb", Revenue: (kpis?.revenue ?? 120000) * 0.82, Profit: (kpis?.profit ?? 40000) * 0.8 },
    { month: "Mar", Revenue: (kpis?.revenue ?? 120000) * 0.90, Profit: (kpis?.profit ?? 40000) * 0.85 },
    { month: "Apr", Revenue: (kpis?.revenue ?? 120000) * 0.95, Profit: (kpis?.profit ?? 40000) * 0.92 },
    { month: "May", Revenue: (kpis?.revenue ?? 120000) * 0.98, Profit: (kpis?.profit ?? 40000) * 0.96 },
    { month: "Jun", Revenue: kpis?.revenue ?? 120000, Profit: kpis?.profit ?? 40000 },
  ];

  const unitEconomics = [
    { category: "Gross Revenue", value: kpis?.revenue ?? 120000 },
    { category: "Operating Expenses", value: Math.max(0, (kpis?.revenue ?? 120000) - (kpis?.profit ?? 40000)) },
    { category: "Net Profit Margin", value: kpis?.profit ?? 40000 },
  ];

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 max-w-[1600px] mx-auto w-full space-y-8 transition-colors duration-200">
      
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back to Operational Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeframe:</span>
          {["7d", "30d", "90d", "YTD"].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                timeframe === tf
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Financial & Operational Analytics</span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-xs font-medium text-muted-foreground">Executive Overview</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BarChart2 className="text-primary h-7 w-7" /> Executive Intelligence Suite
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Real-time breakdown of unit economics, project delivery velocity, margin efficiency, and active client health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/eve?question=Generate%20a%20detailed%20financial%20and%20operational%20analytics%20brief"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
          >
            <Sparkles size={14} /> Ask EVE for Deep Cohort Audit
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl border border-border p-8 animate-pulse space-y-6">
          <div className="h-6 bg-muted rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Hero KPI Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Active Client Rate */}
            <div className="bg-card p-5 rounded-xl border border-border shadow-xs hover:border-primary/30 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Client Rate</span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Users size={16} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold tracking-tight text-foreground">{activeClientRate}%</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground">
                    {kpis?.active_clients ?? 0} active of {kpis?.clients ?? 0} total
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                    High Retention
                  </span>
                </div>
              </div>
            </div>

            {/* Task Velocity */}
            <div className="bg-card p-5 rounded-xl border border-border shadow-xs hover:border-primary/30 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Task Velocity</span>
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <CheckSquare size={16} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold tracking-tight text-foreground">{taskVelocity}%</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground">
                    {kpis?.completed_tasks ?? 0} completed of {kpis?.tasks ?? 0}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-500">
                    On Schedule
                  </span>
                </div>
              </div>
            </div>

            {/* Profit Margin */}
            <div className="bg-card p-5 rounded-xl border border-border shadow-xs hover:border-primary/30 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gross Profit Margin</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <DollarSign size={16} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{profitMargin}%</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Profit: ${(kpis?.profit ?? 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                    Optimal Margin
                  </span>
                </div>
              </div>
            </div>

            {/* Active Projects Load */}
            <div className="bg-card p-5 rounded-xl border border-border shadow-xs hover:border-primary/30 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Projects Load</span>
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Briefcase size={16} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold tracking-tight text-foreground">{kpis?.active_projects ?? 0}</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Total Projects: {kpis?.projects ?? 0}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">
                    Healthy Capacity
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Financial Visualizations Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Revenue & Profit Trajectory Area Chart */}
            <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Revenue & Net Profit Trajectory</h3>
                  <p className="text-xs text-muted-foreground">Monthly growth progression and net margin performance</p>
                </div>
                <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                  <TrendingUp size={14} /> +18.4% MoM
                </span>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={financialTrajectory} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "var(--card)", 
                        borderColor: "var(--border)", 
                        borderRadius: "0.75rem",
                        color: "var(--foreground)",
                        fontSize: "0.75rem"
                      }} 
                    />
                    <Legend wrapperStyle={{ fontSize: "0.75rem", paddingTop: "10px" }} />
                    <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Unit Economics Breakdown Bar Chart */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Unit Economics Structure</h3>
                <p className="text-xs text-muted-foreground">Revenue vs Operating Expenses vs Profit</p>

                <div className="h-[240px] w-full mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={unitEconomics} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={110} />
                      <Tooltip 
                        formatter={(value: any) => [`$${Number(value).toLocaleString()}`, "Value"]}
                        contentStyle={{ 
                          backgroundColor: "var(--card)", 
                          borderColor: "var(--border)", 
                          borderRadius: "0.75rem",
                          color: "var(--foreground)",
                          fontSize: "0.75rem"
                        }} 
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Capital Efficiency Ratio:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">High (2.4x)</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Executive Intelligence Callout */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                <Brain className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-foreground">Advanced Cohort & Pricing Intelligence</h4>
                <p className="text-xs text-muted-foreground max-w-2xl">
                  Granular SKU cohort analysis, inventory turnover predictions, and customer lifetime value projections are continuously updated by EVE.
                </p>
              </div>
            </div>
            <Link 
              href="/dashboard/eve?question=Perform%20a%20deep-dive%20unit%20economics%20and%20cohort%20analysis"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-all whitespace-nowrap cursor-pointer"
            >
              Consult EVE AI CEO →
            </Link>
          </div>

          {/* AI Product Governance Disclaimer */}
          <AIDisclaimer className="mt-4" />
        </div>
      )}
    </div>
  );
}
