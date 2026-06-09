"use client";

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
        console.error(err);
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
        log.description?.toLowerCase().includes(lowerQuery)
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
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4 text-slate-500 mb-4">
        <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><ArrowLeft size={16}/> Back to Dashboard</Link>
      </div>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2"><Activity className="text-blue-600"/> System Activity Log</h1>
      </div>
      
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search activity description or action..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-slate-400" size={18} />
          <select 
            className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]"
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
          >
            <option value="all">All Entities</option>
            {getUniqueEntities().map(entity => (
              <option key={entity} value={entity}>{entity}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading activity feed...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 space-y-6 flex-1">
            {currentLogs.map(log => (
              <div key={log.id} className="flex gap-4 items-start pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0 text-blue-500 shadow-sm border border-slate-200">
                  <Activity size={18}/>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-800">[{log.entity_type}]</span>
                    <span className="text-slate-700 font-medium">{log.action}</span>
                  </div>
                  <p className="text-slate-600 text-sm">{log.description}</p>
                  <p className="text-slate-400 text-xs mt-2">{new Date(log.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {currentLogs.length === 0 && (
              <div className="text-center py-10 text-slate-500">
                {logs.length === 0 ? "No activity logged yet." : "No results match your search criteria."}
              </div>
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-600">Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLogs.length)} of {filteredLogs.length} entries</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-slate-300 rounded bg-white text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-slate-300 rounded bg-white text-sm hover:bg-slate-50 disabled:opacity-50"
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
