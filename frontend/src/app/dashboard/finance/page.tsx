"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { fetchRevenues, fetchExpenses, fetchBusinessKPIs, fetchProjects, fetchInventoryDashboard, fetchInventoryAlerts } from "@/services/businessService";
import { Revenue, Expense, BusinessKPIs, Project } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { DollarSign, ArrowLeft, ArrowUpRight, ArrowDownRight, Plus } from "lucide-react";
import { RevenueModal } from "@/components/business/RevenueModal";
import { ExpenseModal } from "@/components/business/ExpenseModal";

export default function FinancePage() {
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [kpis, setKpis] = useState<BusinessKPIs | null>(null);
  const [inventoryDashboard, setInventoryDashboard] = useState<any>(null);
  const [inventoryAlerts, setInventoryAlerts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");

  const [isRevModalOpen, setIsRevModalOpen] = useState(false);
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);

  const loadData = async (token: string) => {
    try {
      const [revData, expData, kpiData, projData, invDashboard, invAlerts] = await Promise.all([
        fetchRevenues(token),
        fetchExpenses(token),
        fetchBusinessKPIs(token),
        fetchProjects(token),
        fetchInventoryDashboard(token).catch(() => null),
        fetchInventoryAlerts(token).catch(() => null),
      ]);
      setRevenues(revData);
      setExpenses(expData);
      setKpis(kpiData);
      setProjects(projData);
      setInventoryDashboard(invDashboard);
      setInventoryAlerts(invAlerts);
    } catch (err) {
      logger.error(err);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionToken(session.access_token);
          await loadData(session.access_token);
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  return (
    <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-8 transition-colors duration-200">
      <div className="flex items-center gap-4 text-muted-foreground mb-4">
        <Link href="/dashboard" className="hover:text-blue-600:text-blue-400 flex items-center gap-1"><ArrowLeft size={16}/> Back to Dashboard</Link>
      </div>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><DollarSign className="text-green-600"/> Financial Overview</h1>
      </div>
      
      {loading ? (
        <div className="space-y-8 animate-pulse">
          {/* Quick Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col justify-center items-center h-28 space-y-3">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-8 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Table Skeletons */}
            {[...Array(2)].map((_, tableIdx) => (
              <div key={tableIdx} className="bg-card rounded-xl shadow-sm border border-border overflow-hidden flex flex-col p-6 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-border">
                  <div className="h-5 bg-muted rounded w-1/4" />
                  <div className="h-8 bg-muted rounded w-24" />
                </div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center py-2">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-4 bg-muted rounded w-12" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Inventory-Centric Financial Intelligence Grid — sourced from the same
              /api/inventory/dashboard and /api/inventory/alerts data as Inventory
              Intelligence, so these figures can never disagree with that page. */}
          {(() => {
            const totalInventoryValue = inventoryDashboard?.total_inventory_value ?? null;
            const deadStockCount = inventoryAlerts?.dead_stock_count ?? 0;
            const deadStockCapital = inventoryAlerts?.total_capital_locked ?? 0;
            const monthlyCarryingCost = totalInventoryValue !== null ? Math.round(totalInventoryValue * 0.03) : null;
            const potentialRecovery = Math.round(deadStockCapital * 0.8);
            const gmroiValues = (inventoryDashboard?.product_metrics || [])
              .map((p: any) => p.gmroi)
              .filter((v: any) => typeof v === "number" && v > 0);
            const avgGmroi = gmroiValues.length > 0
              ? gmroiValues.reduce((a: number, b: number) => a + b, 0) / gmroiValues.length
              : null;

            return (
              <div className="eve-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Executive Capital Allocation
                    </span>
                    <h2 className="text-xl font-bold text-foreground mt-0.5">
                      Inventory Financial Intelligence
                    </h2>
                  </div>
                  <Link
                    href="/dashboard/inventory"
                    className="text-xs font-semibold text-primary hover:underline transition-colors flex items-center gap-1"
                  >
                    Go to Reorder Center →
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Inventory Carrying Cost
                    </span>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {monthlyCarryingCost !== null ? `$${monthlyCarryingCost.toLocaleString()} / mo` : "—"}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Estimated at 3%/mo of inventory value on hand — the same rate used for dead-stock carrying cost.
                    </p>
                  </div>

                  <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Cash Locked in Inventory
                    </span>
                    <div className="text-2xl font-bold text-foreground">
                      {totalInventoryValue !== null ? `$${totalInventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Total cost of stock on hand — matches Inventory Intelligence.
                    </p>
                  </div>

                  <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Dead Stock Cost
                    </span>
                    <div className={`text-2xl font-bold ${deadStockCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      ${deadStockCapital.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {deadStockCount > 0
                        ? `Capital locked in ${deadStockCount} SKU${deadStockCount > 1 ? "s" : ""} unsold for over 30 days.`
                        : "No SKUs currently unsold for over 30 days."}
                    </p>
                  </div>

                  <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Potential Recovery
                    </span>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      ${potentialRecovery.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Est. at 80% of dead-stock value via bundle or markdown liquidation.
                    </p>
                  </div>

                  <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Inventory ROI (GMROI)
                    </span>
                    <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                      {avgGmroi !== null ? `${avgGmroi.toFixed(1)}x` : "—"}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Average gross margin return on investment across SKUs with sales history.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Connected Originating Decisions & Strategic Initiatives */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider block">Connected Decision Traceability</span>
              <h3 className="text-sm font-bold text-foreground mt-0.5">Which inventory decisions are driving financial performance?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {(() => {
                  const revenueAtRisk = inventoryAlerts?.total_revenue_at_risk ?? 0;
                  const deadStockCapital = inventoryAlerts?.total_capital_locked ?? 0;
                  if (!revenueAtRisk && !deadStockCapital) return "No active reorder or dead-stock recommendations right now.";
                  const parts: string[] = [];
                  if (revenueAtRisk) parts.push(`Open reorder recommendations protect $${revenueAtRisk.toLocaleString()} in revenue`);
                  if (deadStockCapital) parts.push(`${parts.length ? "and" : "Reorder recommendations flag"} $${deadStockCapital.toLocaleString()} in dead stock for liquidation`);
                  return parts.join(" ") + ".";
                })()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/inventory" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
                Review Reorders →
              </Link>
              <Link href="/dashboard/projects" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-foreground hover:bg-muted transition-all border border-border">
                Active Initiatives →
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col justify-center items-center">
              <div className="flex items-center gap-2 text-green-600 font-medium mb-2"><ArrowUpRight size={20}/> Total Revenue</div>
              <div className="text-4xl font-bold text-foreground">${kpis?.revenue?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col justify-center items-center">
              <div className="flex items-center gap-2 text-red-600 font-medium mb-2"><ArrowDownRight size={20}/> Total Expenses</div>
              <div className="text-4xl font-bold text-foreground">${kpis?.expenses?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-blue-600 p-6 rounded-xl border border-blue-700 shadow-md flex flex-col justify-center items-center text-foreground">
              <div className="font-medium mb-2 opacity-90">Net Operating Profit</div>
              <div className="text-4xl font-bold">${kpis?.profit?.toLocaleString() || 0}</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Revenue Table */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
              <div className="bg-background px-6 py-4 border-b border-border font-bold text-foreground flex justify-between items-center">
                Revenue Entries
                <button onClick={() => setIsRevModalOpen(true)} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100:bg-green-900/30 rounded-md text-sm transition-colors border border-green-200 cursor-pointer">
                  <Plus size={16}/> Add Revenue
                </button>
              </div>
              <div className="overflow-x-auto flex-1 scrollbar-thin">
                <table className="w-full text-left text-sm">
                  <thead className="bg-card border-b border-border text-muted-foreground">
                    <tr><th className="px-6 py-3 font-medium">Amount</th><th className="px-6 py-3 font-medium">Description</th><th className="px-6 py-3 font-medium">Date</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {revenues.map(r => (
                      <tr key={r.id} className="hover:bg-muted/40">
                        <td className="px-6 py-4 font-bold text-green-600">+${r.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-foreground">{r.description || '-'}</td>
                        <td className="px-6 py-4 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {revenues.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">No revenue found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expense Table */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
              <div className="bg-background px-6 py-4 border-b border-border font-bold text-foreground flex justify-between items-center">
                Expense Entries
                <button onClick={() => setIsExpModalOpen(true)} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100:bg-red-900/30 rounded-md text-sm transition-colors border border-red-200 cursor-pointer">
                  <Plus size={16}/> Add Expense
                </button>
              </div>
              <div className="overflow-x-auto flex-1 scrollbar-thin">
                <table className="w-full text-left text-sm">
                  <thead className="bg-card border-b border-border text-muted-foreground">
                    <tr><th className="px-6 py-3 font-medium">Amount</th><th className="px-6 py-3 font-medium">Category</th><th className="px-6 py-3 font-medium">Date</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map(e => (
                      <tr key={e.id} className="hover:bg-muted/40">
                        <td className="px-6 py-4 font-bold text-red-600">-${e.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-foreground">{e.category}</td>
                        <td className="px-6 py-4 text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {expenses.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-muted-foreground">No expenses found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <RevenueModal 
        isOpen={isRevModalOpen} 
        onClose={() => setIsRevModalOpen(false)} 
        token={sessionToken} 
        projects={projects} 
        onSuccess={() => loadData(sessionToken)} 
      />
      <ExpenseModal 
        isOpen={isExpModalOpen} 
        onClose={() => setIsExpModalOpen(false)} 
        token={sessionToken} 
        onSuccess={() => loadData(sessionToken)} 
      />
    </div>
  );
}
