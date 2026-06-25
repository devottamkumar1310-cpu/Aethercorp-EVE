"use client";

import { useEffect, useState } from "react";
import { fetchRevenues, fetchExpenses, fetchBusinessKPIs, fetchProjects } from "@/services/businessService";
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
        fetchProjects(token)
      ]);
      setRevenues(revData);
      setExpenses(expData);
      setKpis(kpiData);
      setProjects(projData);
    } catch (err) {
      console.error(err);
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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4 text-slate-500 mb-4">
        <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><ArrowLeft size={16}/> Back to Dashboard</Link>
      </div>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2"><DollarSign className="text-green-600"/> Financial Overview</h1>
      </div>
      
      {loading ? (
        <div className="space-y-8 animate-pulse">
          {/* Quick Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center h-28 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-8 bg-slate-200 rounded w-1/2" />
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Table Skeletons */}
            {[...Array(2)].map((_, tableIdx) => (
              <div key={tableIdx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col p-6 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <div className="h-5 bg-slate-200 rounded w-1/4" />
                  <div className="h-8 bg-slate-200 rounded w-24" />
                </div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center py-2">
                      <div className="h-4 bg-slate-200 rounded w-1/3" />
                      <div className="h-4 bg-slate-200 rounded w-1/4" />
                      <div className="h-4 bg-slate-200 rounded w-12" />
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
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
              <div className="flex items-center gap-2 text-green-600 font-medium mb-2"><ArrowUpRight size={20}/> Total Revenue</div>
              <div className="text-4xl font-bold text-slate-800">${kpis?.revenue?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center">
              <div className="flex items-center gap-2 text-red-600 font-medium mb-2"><ArrowDownRight size={20}/> Total Expenses</div>
              <div className="text-4xl font-bold text-slate-800">${kpis?.expenses?.toLocaleString() || 0}</div>
            </div>
            <div className="bg-blue-600 p-6 rounded-xl border border-blue-700 shadow-md flex flex-col justify-center items-center text-white">
              <div className="font-medium mb-2 opacity-90">Net Profit</div>
              <div className="text-4xl font-bold">${kpis?.profit?.toLocaleString() || 0}</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Revenue Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 font-bold text-slate-800 flex justify-between items-center">
                Revenue Entries
                <button onClick={() => setIsRevModalOpen(true)} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md text-sm transition-colors border border-green-200">
                  <Plus size={16}/> Add Revenue
                </button>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b border-slate-100 text-slate-500">
                    <tr><th className="px-6 py-3 font-medium">Amount</th><th className="px-6 py-3 font-medium">Description</th><th className="px-6 py-3 font-medium">Date</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {revenues.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold text-green-600">+${r.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-700">{r.description || '-'}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {revenues.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-slate-500">No revenue found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expense Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 font-bold text-slate-800 flex justify-between items-center">
                Expense Entries
                <button onClick={() => setIsExpModalOpen(true)} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md text-sm transition-colors border border-red-200">
                  <Plus size={16}/> Add Expense
                </button>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b border-slate-100 text-slate-500">
                    <tr><th className="px-6 py-3 font-medium">Amount</th><th className="px-6 py-3 font-medium">Category</th><th className="px-6 py-3 font-medium">Date</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold text-red-600">-${e.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-700">{e.category}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(e.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {expenses.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-slate-500">No expenses found</td></tr>}
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
