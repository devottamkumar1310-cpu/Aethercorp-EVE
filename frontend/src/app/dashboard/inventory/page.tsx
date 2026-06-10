"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  fetchInventoryDashboard, 
  uploadInventoryCSVAPI, 
  uploadSalesCSVAPI, 
  uploadCostsCSVAPI 
} from "@/services/businessService";
import { 
  Package, 
  DollarSign, 
  AlertTriangle, 
  Upload, 
  CheckCircle, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Layers,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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

export default function InventoryDashboardPage() {
  const [data, setData] = useState<InventoryDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");
  const router = useRouter();

  // Upload States
  const [uploadingInventory, setUploadingInventory] = useState(false);
  const [uploadingSales, setUploadingSales] = useState(false);
  const [uploadingCosts, setUploadingCosts] = useState(false);

  const loadData = async (token: string) => {
    try {
      const dbData = await fetchInventoryDashboard(token);
      setData(dbData);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load inventory metrics.");
    }
  };

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      setSessionToken(session.access_token);
      
      const activeWorkspace = localStorage.getItem("active_workspace_id");
      if (activeWorkspace) {
        await loadData(session.access_token);
      } else {
        toast.error("Please select or create a workspace first.");
      }
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

    // Verify CSV extension
    if (!file.name.endsWith(".csv")) {
      toast.error("Only CSV files are supported.");
      return;
    }

    const toastId = toast.loading(`Uploading ${type} CSV...`);

    if (type === "inventory") setUploadingInventory(true);
    if (type === "sales") setUploadingSales(true);
    if (type === "costs") setUploadingCosts(true);

    try {
      if (type === "inventory") {
        await uploadInventoryCSVAPI(sessionToken, file);
      } else if (type === "sales") {
        await uploadSalesCSVAPI(sessionToken, file);
      } else if (type === "costs") {
        await uploadCostsCSVAPI(sessionToken, file);
      }

      toast.success(`${type.toUpperCase()} file processed successfully!`, { id: toastId });
      // Reload page data
      await loadData(sessionToken);
    } catch (err: any) {
      toast.error(err.message || `Failed to process ${type} CSV.`, { id: toastId });
    } finally {
      if (type === "inventory") setUploadingInventory(false);
      if (type === "sales") setUploadingSales(false);
      if (type === "costs") setUploadingCosts(false);
      
      // Reset input element value to allow uploading same file again if needed
      e.target.value = "";
    }
  };

  const activeWorkspace = typeof window !== "undefined" ? localStorage.getItem("active_workspace_id") : null;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-slate-500 font-medium bg-slate-50">
        <Loader2 className="animate-spin mr-2 h-5 w-5 text-indigo-600" />
        Loading Inventory Intelligence...
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
        <p className="text-slate-500 text-sm">
          Please select or create a workspace using the header dropdown before configuring your inventory.
        </p>
      </div>
    );
  }

  return (
    <main className="p-6 max-w-[1600px] mx-auto w-full space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/dashboard" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
              <ArrowLeft size={14} /> Back to Hub
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inventory & Demand Intelligence</h1>
          <p className="text-slate-500 text-sm">
            Import catalogs, monitor cost structures, and track product profitability and sell-through.
          </p>
        </div>
      </div>

      {/* CSV Import Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Upload Inventory Catalog */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-colors">
          <div>
            <div className="h-9 w-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-3">
              <Layers size={20} />
            </div>
            <h3 className="font-semibold text-slate-900 text-sm">1. Import Inventory Stock</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Upload current warehouse counts and lead times. Required columns: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono text-[10px]">sku</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono text-[10px]">name</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono text-[10px]">quantity</code>.
            </p>
          </div>
          <label className="relative flex items-center justify-center gap-2 w-full py-2 px-3 border border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/10 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-all">
            {uploadingInventory ? (
              <Loader2 className="animate-spin h-4 w-4 text-indigo-600" />
            ) : (
              <Upload size={14} className="text-slate-400" />
            )}
            <span>{uploadingInventory ? "Processing..." : "Choose Inventory CSV"}</span>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              disabled={uploadingInventory}
              onChange={(e) => handleFileUpload(e, "inventory")} 
            />
          </label>
        </div>

        {/* Upload Costs */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-green-200 transition-colors">
          <div>
            <div className="h-9 w-9 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-3">
              <DollarSign size={20} />
            </div>
            <h3 className="font-semibold text-slate-900 text-sm">2. Import Product Costs (COGS)</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Configure cost structure. Required columns: <code className="bg-slate-100 px-1 py-0.5 rounded text-green-650 font-mono text-[10px]">sku</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-green-650 font-mono text-[10px]">cost</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-green-650 font-mono text-[10px]">price</code> (optional), <code className="bg-slate-100 px-1 py-0.5 rounded text-green-650 font-mono text-[10px]">supplier</code>.
            </p>
          </div>
          <label className="relative flex items-center justify-center gap-2 w-full py-2 px-3 border border-dashed border-slate-300 hover:border-green-400 bg-slate-50/50 hover:bg-green-50/10 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-all">
            {uploadingCosts ? (
              <Loader2 className="animate-spin h-4 w-4 text-green-600" />
            ) : (
              <Upload size={14} className="text-slate-400" />
            )}
            <span>{uploadingCosts ? "Processing..." : "Choose Costs CSV"}</span>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              disabled={uploadingCosts}
              onChange={(e) => handleFileUpload(e, "costs")} 
            />
          </label>
        </div>

        {/* Upload Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-200 transition-colors">
          <div>
            <div className="h-9 w-9 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-3">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-semibold text-slate-900 text-sm">3. Import Daily Sales Records</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Log historical sales. Required columns: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono text-[10px]">sku</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono text-[10px]">date</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono text-[10px]">quantity</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono text-[10px]">price</code>.
            </p>
          </div>
          <label className="relative flex items-center justify-center gap-2 w-full py-2 px-3 border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/10 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-all">
            {uploadingSales ? (
              <Loader2 className="animate-spin h-4 w-4 text-blue-600" />
            ) : (
              <Upload size={14} className="text-slate-400" />
            )}
            <span>{uploadingSales ? "Processing..." : "Choose Sales CSV"}</span>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              disabled={uploadingSales}
              onChange={(e) => handleFileUpload(e, "sales")} 
            />
          </label>
        </div>

      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KPI: Value */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Inventory Value (COGS)</span>
            <div className="text-3xl font-extrabold text-slate-900">
              ${(data?.total_inventory_value || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            <p className="text-[10px] text-slate-400">Value of stock currently held in warehouse</p>
          </div>
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <DollarSign size={24} />
          </div>
        </div>

        {/* KPI: Count */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Units Stocked</span>
            <div className="text-3xl font-extrabold text-slate-900">
              {(data?.total_items_count || 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-slate-400">Sum of quantities across all SKUs</p>
          </div>
          <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
            <Package size={24} />
          </div>
        </div>

        {/* KPI: Low Stock */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Low Stock Alert SKUs</span>
            <div className="text-3xl font-extrabold text-slate-950 flex items-center gap-2">
              {(data?.low_stock_count || 0).toLocaleString()}
              {data?.low_stock_count && data.low_stock_count > 0 ? (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 animate-pulse">Needs Reorder</span>
              ) : null}
            </div>
            <p className="text-[10px] text-slate-400">Units currently below reorder thresholds</p>
          </div>
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${data?.low_stock_count && data.low_stock_count > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle size={24} />
          </div>
        </div>

      </div>

      {/* Best & Worst Sellers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Best Sellers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-semibold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-700 text-sm">
              <TrendingUp size={16} /> Best Performing Products
            </span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">By Units Sold</span>
          </div>
          <div className="p-0 overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b border-slate-150 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 text-right">Units Sold</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data?.best_sellers?.map((p) => (
                  <tr key={p.sku} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{p.qty_sold.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">${p.revenue.toLocaleString()}</td>
                  </tr>
                ))}
                {(!data?.best_sellers || data.best_sellers.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">No sales transactions logged.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Worst Sellers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-semibold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-red-700 text-sm">
              <TrendingDown size={16} /> Lowest Performing Products
            </span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">By Units Sold</span>
          </div>
          <div className="p-0 overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b border-slate-150 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 text-right">Units Sold</th>
                  <th className="px-4 py-2 text-right">Stock Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data?.worst_sellers?.map((p) => (
                  <tr key={p.sku} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{p.qty_sold}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{p.stock_on_hand.toLocaleString()}</td>
                  </tr>
                ))}
                {(!data?.worst_sellers || data.worst_sellers.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">No products found in catalog.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Complete Product Metrics Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="bg-slate-50 px-4 py-3.5 border-b border-slate-200 font-bold text-slate-800 text-sm">
          Complete Inventory Profitability Ledger
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/30 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3 text-right">Stock</th>
                <th className="px-5 py-3 text-right">Cost</th>
                <th className="px-5 py-3 text-right">Qty Sold</th>
                <th className="px-5 py-3 text-right">Revenue</th>
                <th className="px-5 py-3 text-right">Profit</th>
                <th className="px-5 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-slate-700">
              {data?.product_metrics?.map((p) => (
                <tr key={p.sku} className="hover:bg-slate-55/30 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-900">{p.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                      {p.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-slate-800">{p.stock_on_hand.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right text-slate-600">${p.unit_cost.toFixed(2)}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-600">{p.qty_sold.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-slate-900">${p.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-emerald-600">${p.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="px-5 py-3.5 text-right font-medium">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      p.margin_percent >= 50 ? 'bg-emerald-50 text-emerald-700' :
                      p.margin_percent >= 25 ? 'bg-blue-50 text-blue-700' :
                      p.margin_percent > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {p.margin_percent.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {(!data?.product_metrics || data.product_metrics.length === 0) && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-500 italic">
                    No items in inventory. Please upload inventory, cost, and sales CSV files to calculate metrics.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
