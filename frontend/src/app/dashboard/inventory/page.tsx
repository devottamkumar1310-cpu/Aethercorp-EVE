"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  fetchInventoryDashboard,
  uploadInventoryCSVAPI,
  uploadSalesCSVAPI,
  uploadCostsCSVAPI,
} from "@/services/businessService";
import {
  Package,
  DollarSign,
  AlertTriangle,
  Upload,
  Loader2,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowLeft,
  Plus,
  Search,
  ChevronUp,
  ChevronDown,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { AddProductModal } from "@/components/inventory/AddProductModal";
import { API_BASE_URL } from "@/lib/api";

interface ProductMetric {
  sku: string;
  name: string;
  category: string;
  stock_on_hand: number;
  unit_cost: number;
  qty_sold: number;
  revenue: number;
  profit: number;
  margin_percent: number;
}

interface InventoryDashboardData {
  total_inventory_value: number;
  total_items_count: number;
  low_stock_count: number;
  best_sellers: ProductMetric[];
  worst_sellers: ProductMetric[];
  product_metrics: ProductMetric[];
}

interface AlertData {
  low_stock: Array<{
    sku: string;
    name: string;
    category: string;
    stock_on_hand: number;
    reorder_point: number;
    shortage: number;
  }>;
  dead_stock: Array<{
    sku: string;
    name: string;
    category: string;
    stock_on_hand: number;
    estimated_value: number;
  }>;
  low_stock_count: number;
  dead_stock_count: number;
}

type SortField = "stock_on_hand" | "qty_sold" | "revenue" | "margin_percent" | "profit";
type SortDir = "asc" | "desc";
type TabId = "all" | "reorder" | "dead";

export default function InventoryDashboardPage() {
  const [data, setData] = useState<InventoryDashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [uploadingInventory, setUploadingInventory] = useState(false);
  const [uploadingSales, setUploadingSales] = useState(false);
  const [uploadingCosts, setUploadingCosts] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const router = useRouter();

  const loadData = async (token: string) => {
    try {
      const activeWorkspace = localStorage.getItem("active_workspace_id");
      const [dbData, alertRes] = await Promise.all([
        fetchInventoryDashboard(token),
        fetch(`${API_BASE_URL}/api/inventory/alerts`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Workspace-Id": activeWorkspace || "",
          },
        }),
      ]);
      setData(dbData);
      if (alertRes.ok) {
        const alertData = await alertRes.json();
        setAlerts(alertData);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load inventory metrics.");
    }
  };

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setSessionToken(session.access_token);
      const activeWorkspace = localStorage.getItem("active_workspace_id");
      if (activeWorkspace) await loadData(session.access_token);
      setLoading(false);
    }
    init();
  }, [router]);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "inventory" | "sales" | "costs"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) { toast.error("Only CSV files are supported."); return; }
    const toastId = toast.loading(`Uploading ${type} CSV...`);
    if (type === "inventory") setUploadingInventory(true);
    if (type === "sales") setUploadingSales(true);
    if (type === "costs") setUploadingCosts(true);
    try {
      if (type === "inventory") await uploadInventoryCSVAPI(sessionToken, file);
      else if (type === "sales") await uploadSalesCSVAPI(sessionToken, file);
      else if (type === "costs") await uploadCostsCSVAPI(sessionToken, file);
      toast.success(`${type.toUpperCase()} file processed!`, { id: toastId });
      await loadData(sessionToken);
    } catch (err: any) {
      toast.error(err.message || `Failed to process ${type} CSV.`, { id: toastId });
    } finally {
      if (type === "inventory") setUploadingInventory(false);
      if (type === "sales") setUploadingSales(false);
      if (type === "costs") setUploadingCosts(false);
      e.target.value = "";
    }
  };

  const categories = useMemo(() => {
    const cats = new Set((data?.product_metrics || []).map((p) => p.category));
    return ["All", ...Array.from(cats).sort()];
  }, [data]);

  const filteredAndSorted = useMemo(() => {
    let products = data?.product_metrics || [];
    if (search) {
      const q = search.toLowerCase();
      products = products.filter(
        (p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "All") {
      products = products.filter((p) => p.category === categoryFilter);
    }
    return [...products].sort((a, b) => {
      const dir = sortDir === "desc" ? -1 : 1;
      return (a[sortField] - b[sortField]) * dir;
    });
  }, [data, search, categoryFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown size={12} className="text-slate-400 opacity-40" />;
    return sortDir === "desc"
      ? <ChevronDown size={12} className="text-indigo-500" />
      : <ChevronUp size={12} className="text-indigo-500" />;
  };

  const activeWorkspace = typeof window !== "undefined" ? localStorage.getItem("active_workspace_id") : null;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-slate-500 font-medium">
        <Loader2 className="animate-spin mr-2 h-5 w-5 text-indigo-600" /> Loading Inventory Intelligence...
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-6 mt-12 bg-white rounded-xl border border-slate-200 shadow-md">
        <div className="h-12 w-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">No Active Workspace</h2>
        <p className="text-slate-500 text-sm">Please select or create a workspace first.</p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "all", label: "All Products", count: data?.product_metrics?.length },
    { id: "reorder", label: "Reorder Alerts", count: alerts?.low_stock_count },
    { id: "dead", label: "Dead Stock", count: alerts?.dead_stock_count },
  ];

  return (
    <main className="p-6 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/dashboard" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
              <ArrowLeft size={14} /> Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Intelligence</h1>
          <p className="text-slate-500 text-sm">Monitor stock levels, profitability, and demand performance.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* CSV Import Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            type: "inventory" as const,
            label: "1. Import Inventory Stock",
            icon: <Layers size={18} />,
            colorClass: "bg-indigo-50 text-indigo-600",
            borderClass: "hover:border-indigo-200",
            uploading: uploadingInventory,
            desc: "Required: sku, name, quantity",
          },
          {
            type: "costs" as const,
            label: "2. Import Product Costs",
            icon: <DollarSign size={18} />,
            colorClass: "bg-green-50 text-green-600",
            borderClass: "hover:border-green-200",
            uploading: uploadingCosts,
            desc: "Required: sku, cost, price",
          },
          {
            type: "sales" as const,
            label: "3. Import Sales Records",
            icon: <TrendingUp size={18} />,
            colorClass: "bg-blue-50 text-blue-600",
            borderClass: "hover:border-blue-200",
            uploading: uploadingSales,
            desc: "Required: sku, date, quantity, price",
          },
        ].map(({ type, label, icon, colorClass, borderClass, uploading, desc }) => (
          <div key={type} className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm ${borderClass} transition-colors`}>
            <div className={`h-8 w-8 ${colorClass} rounded-lg flex items-center justify-center mb-2`}>{icon}</div>
            <h3 className="font-semibold text-slate-900 text-sm">{label}</h3>
            <p className="text-xs text-slate-400 mt-1 mb-3">{desc}</p>
            <label className="flex items-center justify-center gap-2 w-full py-1.5 px-3 border border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer transition-all">
              {uploading
                ? <Loader2 className="animate-spin h-3.5 w-3.5 text-indigo-600" />
                : <Upload size={12} className="text-slate-400" />}
              <span>{uploading ? "Processing..." : `Choose ${type} CSV`}</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleFileUpload(e, type)}
              />
            </label>
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inventory Value (COGS)</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              ${(data?.total_inventory_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <DollarSign size={22} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Units Stocked</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              {(data?.total_items_count || 0).toLocaleString()}
            </p>
          </div>
          <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
            <Package size={22} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Low Stock SKUs</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-3xl font-extrabold text-slate-900">{alerts?.low_stock_count || 0}</p>
              {(alerts?.low_stock_count || 0) > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 animate-pulse">
                  Reorder
                </span>
              )}
            </div>
          </div>
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${(alerts?.low_stock_count || 0) > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"}`}>
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Best & Worst Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Best Sellers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-700 text-sm font-semibold">
              <TrendingUp size={15} /> Best Sellers
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">By Units Sold</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-2 text-left">SKU</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-right">Sold</th>
                <th className="px-4 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.best_sellers?.map((p) => (
                <tr key={p.sku} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-900">{p.qty_sold.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-emerald-600">${p.revenue.toLocaleString()}</td>
                </tr>
              ))}
              {!data?.best_sellers?.length && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">No sales data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Worst Sellers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-red-700 text-sm font-semibold">
              <TrendingDown size={15} /> Lowest Sellers
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">By Units Sold</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-2 text-left">SKU</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-right">Sold</th>
                <th className="px-4 py-2 text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.worst_sellers?.map((p) => (
                <tr key={p.sku} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{p.qty_sold}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">{p.stock_on_hand.toLocaleString()}</td>
                </tr>
              ))}
              {!data?.worst_sellers?.length && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">No products yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabbed Product Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab Bar + Search */}
        <div className="border-b border-slate-200 px-4 pt-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            {/* Tabs */}
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "border-indigo-500 text-indigo-700 bg-indigo-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.id
                        ? "bg-indigo-100 text-indigo-700"
                        : tab.id === "reorder" && (tab.count || 0) > 0
                        ? "bg-amber-100 text-amber-700"
                        : tab.id === "dead" && (tab.count || 0) > 0
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {tab.count ?? 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search & Filter (only for All tab) */}
            {activeTab === "all" && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search SKU or name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-indigo-400 w-48"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Filter size={13} className="text-slate-400 flex-shrink-0" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="pl-2 pr-6 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-indigo-400"
                  >
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab: All Products */}
        {activeTab === "all" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">SKU</th>
                  <th className="px-5 py-3 text-left">Product</th>
                  <th className="px-5 py-3 text-left">Category</th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer hover:text-indigo-600 select-none"
                    onClick={() => toggleSort("stock_on_hand")}
                  >
                    <span className="flex items-center justify-end gap-1">Stock <SortIcon field="stock_on_hand" /></span>
                  </th>
                  <th className="px-5 py-3 text-right">Cost</th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer hover:text-indigo-600 select-none"
                    onClick={() => toggleSort("qty_sold")}
                  >
                    <span className="flex items-center justify-end gap-1">Sold <SortIcon field="qty_sold" /></span>
                  </th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer hover:text-indigo-600 select-none"
                    onClick={() => toggleSort("revenue")}
                  >
                    <span className="flex items-center justify-end gap-1">Revenue <SortIcon field="revenue" /></span>
                  </th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer hover:text-indigo-600 select-none"
                    onClick={() => toggleSort("profit")}
                  >
                    <span className="flex items-center justify-end gap-1">Profit <SortIcon field="profit" /></span>
                  </th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer hover:text-indigo-600 select-none"
                    onClick={() => toggleSort("margin_percent")}
                  >
                    <span className="flex items-center justify-end gap-1">Margin <SortIcon field="margin_percent" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSorted.map((p) => (
                  <tr key={p.sku} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{p.name}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800">{p.stock_on_hand.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-slate-500">${p.unit_cost.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{p.qty_sold.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">
                      ${p.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-600">
                      ${p.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.margin_percent >= 50 ? "bg-emerald-500"
                              : p.margin_percent >= 25 ? "bg-blue-500"
                              : p.margin_percent > 0 ? "bg-amber-500"
                              : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, p.margin_percent))}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold ${
                          p.margin_percent >= 50 ? "text-emerald-700"
                          : p.margin_percent >= 25 ? "text-blue-700"
                          : p.margin_percent > 0 ? "text-amber-700"
                          : "text-red-700"
                        }`}>
                          {p.margin_percent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAndSorted.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-400 italic">
                      No products match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Reorder Alerts */}
        {activeTab === "reorder" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b border-amber-100 text-amber-800 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">SKU</th>
                  <th className="px-5 py-3 text-left">Product</th>
                  <th className="px-5 py-3 text-left">Category</th>
                  <th className="px-5 py-3 text-right">On Hand</th>
                  <th className="px-5 py-3 text-right">Reorder Point</th>
                  <th className="px-5 py-3 text-right">Shortage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {alerts?.low_stock?.map((p) => (
                  <tr key={p.sku} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{p.name}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-amber-700">{p.stock_on_hand.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{p.reorder_point.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        <AlertTriangle size={10} /> -{p.shortage}
                      </span>
                    </td>
                  </tr>
                ))}
                {!alerts?.low_stock?.length && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400 italic">
                      No reorder alerts. All stock levels are healthy. ✓
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Dead Stock */}
        {activeTab === "dead" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-red-50 border-b border-red-100 text-red-800 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">SKU</th>
                  <th className="px-5 py-3 text-left">Product</th>
                  <th className="px-5 py-3 text-left">Category</th>
                  <th className="px-5 py-3 text-right">Stock On Hand</th>
                  <th className="px-5 py-3 text-right">Estimated Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {alerts?.dead_stock?.map((p) => (
                  <tr key={p.sku} className="hover:bg-red-50/40 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{p.name}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-red-700">{p.stock_on_hand.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-700">
                      ${p.estimated_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {!alerts?.dead_stock?.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-400 italic">
                      No dead stock detected. All products have recent sales activity. ✓
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        token={sessionToken}
        onSuccess={() => loadData(sessionToken)}
      />
    </main>
  );
}
