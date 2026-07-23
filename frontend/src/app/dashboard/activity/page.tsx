"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { fetchActivityLogs } from "@/services/businessService";
import { ActivityLog } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Activity, ArrowLeft, Search, Filter } from "lucide-react";

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterEntity, setFilterEntity] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const getReadableEntity = (entity: string) => {
    const map: Record<string, string> = {
      "AIRecommendation": "AI Recommendation Generated",
      "RecommendationAccepted": "Recommendation Accepted",
      "RecommendationRejected": "Recommendation Rejected",
      "InventoryUpdate": "Inventory Updated",
      "SupplierUpdate": "Supplier Updated",
      "DeadStockRecovery": "Dead Stock Recovered",
      "RevenueProtection": "Revenue Protected",
      "Markdown": "Markdown Completed",
      "TaskCompletion": "Task Completed",
      "Client": "Supplier / Account",
      "Project": "Production Run",
      "Task": "Supply Chain Task",
      "Product": "Garment Product",
      "InventoryItem": "Stock Level",
      "SalesRecord": "Sales Transaction",
      "Revenue": "Inbound Revenue",
      "Expense": "Outbound Expense"
    };
    return map[entity] || entity;
  };

  const getReadableAction = (action: string, entity: string) => {
    const act = action.toUpperCase();
    if (act === "CREATE") return `New ${getReadableEntity(entity)} Action`;
    if (act === "UPDATE") return `${getReadableEntity(entity)} Status Updated`;
    if (act === "DELETE") return `${getReadableEntity(entity)} Archived`;
    if (act === "ACCEPT") return `Recommendation Accepted by Founder`;
    if (act === "REJECT") return `Recommendation Dismissed`;
    return action;
  };

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const data = await fetchActivityLogs(session.access_token);
          setLogs(data);
          setFilteredLogs(data);
        }
      } catch (err) {
        logger.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    let result = logs;
    
    if (filterEntity !== "all") {
      result = result.filter(log => log.entity_type === filterEntity);
    }
    
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(log => 
        log.action.toLowerCase().includes(lowerQuery) || 
        log.description?.toLowerCase().includes(lowerQuery) ||
        getReadableEntity(log.entity_type).toLowerCase().includes(lowerQuery)
      );
    }
    
    setFilteredLogs(result);
    setCurrentPage(1); // Reset to first page on filter
  }, [searchQuery, filterEntity, logs]);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const getUniqueEntities = () => {
    const entities = new Set(logs.map(l => l.entity_type));
    return Array.from(entities);
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-8 transition-colors duration-200">
      <div className="flex items-center gap-4 text-muted-foreground mb-4">
        <Link href="/dashboard" className="hover:text-blue-600:text-blue-400 flex items-center gap-1"><ArrowLeft size={16}/> Back to Dashboard</Link>
      </div>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Activity className="text-blue-600"/> Business Activity Log</h1>
      </div>
      
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input 
            type="text" 
            placeholder="Search activity description, action or type..." 
            className="w-full pl-10 pr-4 py-2 border border-border bg-card text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-muted-foreground" size={18} />
          <select 
            className="px-3 py-2 border border-border bg-card text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
          >
            <option value="all">All Event Types</option>
            {getUniqueEntities().map(entity => (
              <option key={entity} value={entity}>{getReadableEntity(entity)}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden flex flex-col p-6 space-y-6 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 items-start pb-6 border-b border-border last:border-0 last:pb-0">
              <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
              <div className="space-y-3 flex-1">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-1/6 mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="p-6 space-y-6 flex-1">
            {currentLogs.map(log => {
              const getModuleLink = (type: string) => {
                const t = type.toLowerCase();
                if (t.includes("inventory") || t.includes("product") || t.includes("stock") || t.includes("deadstock")) return { href: "/dashboard/inventory", label: "Inventory Intelligence →" };
                if (t.includes("recommendation") || t.includes("trace")) return { href: "/dashboard/traceability", label: "Decision Traceability →" };
                if (t.includes("revenue") || t.includes("expense") || t.includes("finance")) return { href: "/dashboard/finance", label: "Financial Intelligence →" };
                if (t.includes("task")) return { href: "/dashboard/tasks", label: "Task Execution →" };
                if (t.includes("project")) return { href: "/dashboard/projects", label: "Active Projects →" };
                if (t.includes("client")) return { href: "/dashboard/clients", label: "Clients →" };
                return { href: "/dashboard", label: "Operational Dashboard →" };
              };
              const moduleRef = getModuleLink(log.entity_type);

              return (
                <div key={log.id} className="flex gap-4 items-start pb-6 border-b border-border/60 last:border-0 last:pb-0 justify-between">
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center flex-shrink-0 text-indigo-500 shadow-sm border border-border">
                      <Activity size={18}/>
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full tracking-wider shadow-sm">
                          {getReadableEntity(log.entity_type)}
                        </span>
                        <span className="text-foreground font-bold text-sm">
                          {getReadableAction(log.action, log.entity_type)}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">{log.description}</p>
                      <p className="text-slate-450 text-[10px] mt-2 font-medium">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <Link
                    href={moduleRef.href}
                    className="text-xs font-semibold text-primary hover:underline whitespace-nowrap pt-1"
                  >
                    {moduleRef.label}
                  </Link>
                </div>
              );
            })}
            {currentLogs.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                {logs.length === 0 ? "No activity logged yet." : "No results match your search criteria."}
              </div>
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-background border-t border-border px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLogs.length)} of {filteredLogs.length} entries</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-border rounded-lg bg-card text-xs font-semibold hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer transition-all"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-border rounded-lg bg-card text-xs font-semibold hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
