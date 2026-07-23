"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { fetchRevenues, fetchExpenses, fetchBusinessKPIs, fetchProjects } from "@/services/businessService";
import { Revenue, Expense, BusinessKPIs, Project } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import { ArrowUpRight, ArrowDownRight, Plus } from "lucide-react";
import { RevenueModal } from "@/components/business/RevenueModal";
import { ExpenseModal } from "@/components/business/ExpenseModal";

export default function FinancePage() {
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [kpis, setKpis] = useState<BusinessKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");

  const [isRevModalOpen, setIsRevModalOpen] = useState(false);
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);

  const loadData = async (token: string) => {
    try {
      const [revData, expData, kpiData, projData] = await Promise.all([
        fetchRevenues(token),
        fetchExpenses(token),
        fetchBusinessKPIs(token),
        fetchProjects(token),
      ]);
      setRevenues(revData);
      setExpenses(expData);
      setKpis(kpiData);
      setProjects(projData);
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Finance</h1>
        <p className="text-sm text-muted-foreground mt-1">Revenue, expenses and operating profit.</p>
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
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col justify-center items-center">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium mb-2"><ArrowUpRight size={20}/> Total Revenue</div>
              <div className="text-4xl font-bold text-foreground">${kpis?.revenue?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col justify-center items-center">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-medium mb-2"><ArrowDownRight size={20}/> Total Expenses</div>
              <div className="text-4xl font-bold text-foreground">${kpis?.expenses?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col justify-center items-center">
              <div className="font-medium mb-2 text-muted-foreground">Net Operating Profit</div>
              <div className="text-4xl font-bold text-foreground">${kpis?.profit?.toLocaleString() || 0}</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Revenue Table */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
              <div className="bg-background px-6 py-4 border-b border-border font-bold text-foreground flex justify-between items-center">
                Revenue Entries
                <button onClick={() => setIsRevModalOpen(true)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-md text-sm transition-colors border border-emerald-500/20 cursor-pointer">
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
                <button onClick={() => setIsExpModalOpen(true)} className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 rounded-md text-sm transition-colors border border-rose-500/20 cursor-pointer">
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
