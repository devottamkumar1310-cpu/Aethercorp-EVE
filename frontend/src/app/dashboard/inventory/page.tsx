"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  fetchInventoryDashboard,
  uploadMasterCSVAPI,
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
  ArrowRight,
  Plus,
  Search,
  ChevronUp,
  ChevronDown,
  Filter,
  Brain,
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
  gmroi?: number;
  sell_through_rate?: number;
  inventory_turnover?: number;
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
    avg_daily_sales?: number;
    days_of_supply?: number | null;
    lead_time_days?: number | null;
    revenue_at_risk?: number | null;
  }>;
  dead_stock: Array<{
    sku: string;
    name: string;
    category: string;
    stock_on_hand: number;
    estimated_value: number;
    monthly_carrying_cost?: number;
    days_since_last_sale?: number | null;
  }>;
  low_stock_count: number;
  dead_stock_count: number;
  total_revenue_at_risk?: number;
  total_capital_locked?: number;
}

type SortField = "stock_on_hand" | "qty_sold" | "revenue" | "margin_percent" | "profit";
type SortDir = "asc" | "desc";
type TabId = "all" | "reorder" | "dead";

export default function InventoryDashboardPage() {
  const [data, setData] = useState<InventoryDashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [uploadingMaster, setUploadingMaster] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showImportSummary, setShowImportSummary] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    status: "success" | "error";
    type: "inventory" | "sales" | "costs" | "master";
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    duplicate_rows: number;
    processed_count?: number;
    missing_columns: string[];
    errors: Array<{ row: number; column: string; value: any; message: string }>;
  } | null>(null);
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
    } catch {
      toast.error("Inventory synchronization in progress. Please wait.");
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) { toast.error("Only CSV files are supported."); return; }
    const toastId = toast.loading(`Uploading Master CSV...`);
    setUploadingMaster(true);
    try {
      const result = await uploadMasterCSVAPI(sessionToken, file);
      toast.success(`Master file processed!`, { id: toastId });
      setImportSummary({ ...result, type: "master" });
      setShowImportSummary(true);
      // Trigger proactive analysis banner
      const activeWorkspace = localStorage.getItem("active_workspace_id");
      if (activeWorkspace) {
        localStorage.setItem("eve_analysis_pending", "1");
        localStorage.setItem("eve_analysis_org_id", activeWorkspace);
        // Force layout to re-read localStorage by dispatching a storage event
        window.dispatchEvent(new Event("eve_analysis_started"));
      }
      await loadData(sessionToken);
    } catch (err: any) {
      let parsedSummary = null;
      try {
        parsedSummary = JSON.parse(err.message);
      } catch {}
      
      if (parsedSummary && parsedSummary.status === "error") {
        setImportSummary({ ...parsedSummary, type: "master" });
        setShowImportSummary(true);
        toast.dismiss(toastId);
      } else {
        toast.error("Data synchronization failed. Please review your CSV structure.", { id: toastId });
      }
    } finally {
      setUploadingMaster(false);
      e.target.value = "";
    }
  };

  const downloadTemplate = () => {
    const headers = "sku,name,category,stock_on_hand,lead_time_days,unit_cost,selling_price,date,sales_quantity\\nSKU-001,Premium Top,Tops,80,10,15.50,45.00,2026-06-01,2\\n";
    const filename = "master_template.csv";
    const blob = new Blob([headers], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    if (sortField !== field) return <ChevronDown size={12} className="text-muted-foreground opacity-40" />;
    return sortDir === "desc"
      ? <ChevronDown size={12} className="text-indigo-500" />
      : <ChevronUp size={12} className="text-indigo-500" />;
  };

  const activeWorkspace = typeof window !== "undefined" ? localStorage.getItem("active_workspace_id") : null;

  if (loading) {
    return (
      <main className="p-6 max-w-[1600px] mx-auto w-full space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2 w-full md:w-1/3">
            <div className="h-7 bg-slate-250 rounded w-3/4" />
            <div className="h-4 bg-secondary rounded w-1/2" />
          </div>
          <div className="h-10 bg-secondary rounded-lg w-32" />
        </div>

        {/* CSV Import Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card p-4 rounded-xl border border-border shadow-sm h-36 flex flex-col justify-between">
              <div className="h-8 w-8 bg-secondary rounded-lg" />
              <div className="h-4 bg-secondary rounded w-3/4" />
              <div className="h-8 bg-secondary border border-border rounded-lg w-full" />
            </div>
          ))}
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card p-5 rounded-xl border border-border shadow-sm h-28 flex items-center justify-between">
              <div className="space-y-3 w-1/2">
                <div className="h-3 bg-secondary rounded w-3/4" />
                <div className="h-8 bg-slate-300 rounded w-full" />
              </div>
              <div className="h-12 w-12 bg-secondary rounded-full" />
            </div>
          ))}
        </div>

        {/* Best & Worst Sellers Tables Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-60 bg-card rounded-xl border border-border shadow-sm" />
          <div className="h-60 bg-card rounded-xl border border-border shadow-sm" />
        </div>

        {/* Main Product Table Skeleton */}
        <div className="h-96 bg-card rounded-xl border border-border shadow-sm" />
      </main>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-6 mt-12 bg-card rounded-xl border border-border shadow-md">
        <div className="h-12 w-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-xl font-bold text-foreground">No Active Workspace</h2>
        <p className="text-muted-foreground text-sm">Please select or create a workspace first.</p>
      </div>
    );
  }

  const noData = !data || !data.product_metrics || data.product_metrics.length === 0;

  if (noData) {
    return (
      <main className="p-6 max-w-[1600px] mx-auto w-full space-y-8 transition-colors duration-200">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-foreground">Inventory Intelligence</h1>
            <p className="text-muted-foreground text-sm">Optimize safety stock, predict run-out periods, and protect margins.</p>
          </div>
        </div>

        {/* Empty Onboarding State */}
        <div className="bg-card/40 backdrop-blur-md rounded-3xl border border-border shadow-xl p-8 md:p-12 text-center max-w-4xl mx-auto space-y-8 relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex justify-center">
            <div className="h-16 w-16 bg-indigo-650/15 text-indigo-500 rounded-2xl flex items-center justify-center">
              <Package size={32} />
            </div>
          </div>

          <div className="space-y-3 max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground">Set Up Your Inventory Dashboard</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We need inventory data to track stock levels, calculate dead stock, and suggest safety reorders. Start by uploading a master CSV or explore with a preloaded demo workspace.
            </p>
          </div>

          {/* Three-step visual onboarding guide */}
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto pt-4 text-left">
            <div className="p-5 bg-card border border-border rounded-2xl space-y-2">
              <div className="h-8 w-8 bg-indigo-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white rounded-lg flex items-center justify-center font-bold text-sm">1</div>
              <h4 className="font-bold text-foreground text-sm">Upload Stock Data</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Export your products from Shopify or download our template, and upload the CSV here.
              </p>
            </div>
            <div className="p-5 bg-card border border-border rounded-2xl space-y-2">
              <div className="h-8 w-8 bg-violet-500/10 text-violet-400 rounded-lg flex items-center justify-center font-bold text-sm">2</div>
              <h4 className="font-bold text-foreground text-sm">Get Live Insights</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                See stockout risks, capital tied up in dead stock, best sellers, and gross margins instantly.
              </p>
            </div>
            <div className="p-5 bg-card border border-border rounded-2xl space-y-2">
              <div className="h-8 w-8 bg-emerald-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white rounded-lg flex items-center justify-center font-bold text-sm">3</div>
              <h4 className="font-bold text-foreground text-sm">Take Smart Action</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Let EVE generate restocking purchase orders, price adjustments, and supplier requests.
              </p>
            </div>
          </div>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 max-w-md mx-auto">
            <label className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 border border-dashed border-indigo-550/40 hover:border-indigo-500 bg-indigo-500/5 hover:bg-indigo-550/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white hover:text-indigo-300 rounded-xl text-sm font-semibold cursor-pointer transition-all text-center">
              {uploadingMaster ? <Loader2 className="animate-spin h-4 w-4" /> : <Upload size={16} />}
              <span>{uploadingMaster ? "Uploading..." : "Upload Master CSV"}</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                disabled={uploadingMaster}
                onChange={(e) => handleFileUpload(e)}
              />
            </label>
            <button
              onClick={downloadTemplate}
              className="w-full py-3 px-4 border border-border hover:bg-secondary rounded-xl text-sm font-semibold transition-colors text-muted-foreground hover:text-foreground"
            >
              Download Template
            </button>
          </div>
        </div>
      </main>
    );
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "all", label: "All Products", count: data?.product_metrics?.length },
    { id: "reorder", label: "Reorder Alerts", count: alerts?.low_stock_count },
    { id: "dead", label: "Dead Stock", count: alerts?.dead_stock_count },
  ];
  const lowStockProducts = alerts?.low_stock || [];
  const deadStockProducts = alerts?.dead_stock || [];
  const shortageUnits = lowStockProducts.reduce((sum, item) => sum + Math.max(0, item.shortage), 0);
  const deadStockCapital = deadStockProducts.reduce((sum, item) => sum + item.estimated_value, 0);
  const topLowStockSkus = lowStockProducts.slice(0, 2).map((item) => item.sku).join(" and ");
  const topDeadStockSkus = deadStockProducts.slice(0, 3).map((item) => item.sku).join(", ");
  const totalRevenueAtRisk = alerts?.total_revenue_at_risk ?? lowStockProducts.reduce((s, i) => s + (i.revenue_at_risk ?? 0), 0);
  const criticalStockouts = lowStockProducts.filter((i) => i.days_of_supply !== null && i.days_of_supply !== undefined && i.days_of_supply < (i.lead_time_days ?? 14));
  const outOfStock = lowStockProducts.filter((i) => i.stock_on_hand === 0);

  const stockoutInsight = lowStockProducts.length > 0
    ? (() => {
        const parts: string[] = [];
        if (outOfStock.length > 0) {
          parts.push(`${outOfStock.length} SKU${outOfStock.length > 1 ? "s are" : " is"} already out of stock and generating zero revenue right now.`);
        }
        if (criticalStockouts.length > 0) {
          parts.push(`${criticalStockouts.length} product${criticalStockouts.length > 1 ? "s" : ""} will run out before replenishment can arrive based on current lead times.`);
        }
        if (totalRevenueAtRisk > 0) {
          parts.push(`Projected revenue at risk: $${totalRevenueAtRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`);
        }
        parts.push(`Prioritize immediate purchase orders for ${topLowStockSkus || "the highest-risk SKUs"}.`);
        return parts.join(" ");
      })()
    : "Stock coverage is healthy. No products are below reorder point. Maintain current replenishment cadence.";

  const deadStockInsight = deadStockProducts.length > 0
    ? (() => {
        const monthlyCost = deadStockProducts.reduce((s, i) => s + (i.monthly_carrying_cost ?? 0), 0);
        const oldest = deadStockProducts.find((i) => i.days_since_last_sale != null);
        let insight = `${deadStockProducts.length} SKU${deadStockProducts.length > 1 ? "s have" : " has"} had no sales in the last 30 days, tying up $${deadStockCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })} in capital.`;
        if (monthlyCost > 0) insight += ` Carrying cost is approximately $${monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month.`;
        if (oldest) insight += ` ${oldest.name} has been unsold for ${oldest.days_since_last_sale}+ days.`;
        insight += ` Initiate markdown, bundle, or liquidation for ${topDeadStockSkus || "the oldest SKUs"} to recover cash and free warehouse capacity.`;
        return insight;
      })()
    : "No dead stock detected. All products have recent sales activity — capital is not trapped in non-moving inventory.";

  return (
    <main className="p-6 max-w-[1600px] mx-auto w-full space-y-6 transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-indigo-500 transition-colors flex items-center gap-1">
              <ArrowLeft size={14} /> Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Inventory Intelligence</h1>
          <p className="text-muted-foreground text-sm">Monitor stock levels, profitability, and demand performance.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 !text-white [&_svg]:!text-white [&_svg]:!stroke-white rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer add-product-btn"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Executive Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Inventory Value */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inventory Value (COGS)</p>
            <p className="text-2xl font-black text-foreground mt-1">
              ${(data?.total_inventory_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Total cost of stock on hand</p>
          </div>
          <div className="h-10 w-10 bg-emerald-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white rounded-xl flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Card 2: Low Stock SKUs */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Low Stock SKUs</p>
            <p className="text-2xl font-black text-foreground mt-1">
              {alerts?.low_stock_count || 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {(alerts?.low_stock_count || 0) > 0
                ? outOfStock.length > 0
                  ? `${outOfStock.length} SKU${outOfStock.length > 1 ? "s" : ""} already out of stock`
                  : `${criticalStockouts.length} will run out before supplier can deliver`
                : "All stock levels healthy"}
            </p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${(alerts?.low_stock_count || 0) > 0 ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}>
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Card 3: Revenue at Risk */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue at Risk</p>
            <p className="text-2xl font-black text-foreground mt-1">
              {totalRevenueAtRisk > 0
                ? `$${totalRevenueAtRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : alerts?.dead_stock_count && alerts.dead_stock_count > 0
                  ? `$${deadStockCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : "$0"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {totalRevenueAtRisk > 0
                ? "Projected from stockout gaps vs. lead time"
                : alerts?.dead_stock_count && alerts.dead_stock_count > 0
                  ? "Capital locked in non-moving inventory"
                  : "No immediate inventory risk"}
            </p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${totalRevenueAtRisk > 0 ? "bg-rose-500/15 text-rose-500" : "bg-muted text-muted-foreground"}`}>
            <Package size={20} />
          </div>
        </div>

        {/* Card 4: Reorder Recommendations */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reorder Recommendations</p>
            <p className="text-2xl font-black text-foreground mt-1">
              {alerts?.low_stock?.length || 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Purchase {shortageUnits.toLocaleString() || 0} units suggested
            </p>
          </div>
          <div className="h-10 w-10 bg-indigo-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white rounded-xl flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Executive Summary Cards & Data Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Summary Insights */}
        <div className="lg:col-span-2 bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Brain size={16} className="text-indigo-500" /> Executive Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3 bg-secondary/60 rounded-lg space-y-1 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    ⚠️ Stockout Risk
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    {stockoutInsight}
                  </p>
                </div>
                {(alerts?.low_stock_count || 0) > 0 && (
                  <Link href="/dashboard/traceability?type=low_stock" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-2">
                    View Decision Trace <ArrowRight size={10} />
                  </Link>
                )}
              </div>
              <div className="p-3 bg-secondary/60 rounded-lg space-y-1 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    ❄️ Capital Lockup & Dead Stock
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    {deadStockInsight}
                  </p>
                </div>
                {(alerts?.dead_stock_count || 0) > 0 && (
                  <Link href="/dashboard/traceability?type=dead_stock" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-2">
                    View Decision Trace <ArrowRight size={10} />
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-border flex items-center justify-between text-xs mt-4">
            <span className="text-muted-foreground">Ask EVE AI for detailed mitigation plans:</span>
            <Link href="/dashboard/eve" className="font-bold text-indigo-500 hover:text-indigo-400 flex items-center gap-1 transition-colors">
              Open Chat Assistant <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Right: Spreadsheet Integration */}
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Upload size={16} className="text-indigo-500" /> Spreadsheet Integration
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload your catalog, inventory ledger, or Shopify export sheet. EVE will dynamically reconcile columns and run quality checks.
            </p>
          </div>
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Shopify or custom CSV formats:</span>
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-indigo-500 font-bold hover:underline cursor-pointer outline-none"
              >
                Download Template
              </button>
            </div>
            <label className="flex items-center justify-center gap-2 w-full py-2.5 px-3 border border-dashed border-border hover:border-indigo-500 bg-secondary hover:bg-secondary/80 rounded-lg text-xs font-semibold text-muted-foreground cursor-pointer transition-all">
              {uploadingMaster
                ? <Loader2 className="animate-spin h-3.5 w-3.5 text-indigo-500" />
                : <Upload size={14} className="text-muted-foreground" />}
              <span>{uploadingMaster ? "Processing spreadsheet..." : "Upload Master CSV"}</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                disabled={uploadingMaster}
                onChange={(e) => handleFileUpload(e)}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Best & Worst Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Best Sellers */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="bg-background px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-700 text-sm font-semibold">
              <TrendingUp size={15} /> Best Sellers
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">By Units Sold</span>
          </div>
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-card border-b border-border text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2 text-left">SKU</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-right">Sold</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.best_sellers?.map((p) => (
                  <tr key={p.sku} className="hover:bg-secondary/40">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-foreground">{p.qty_sold.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-emerald-600">${p.revenue.toLocaleString()}</td>
                  </tr>
                ))}
                {!data?.best_sellers?.length && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">No sales data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Worst Sellers */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="bg-background px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-red-700 text-sm font-semibold">
              <TrendingDown size={15} /> Lowest Sellers
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">By Units Sold</span>
          </div>
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-card border-b border-border text-muted-foreground text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2 text-left">SKU</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-right">Sold</th>
                  <th className="px-4 py-2 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.worst_sellers?.map((p) => (
                  <tr key={p.sku} className="hover:bg-secondary/40">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-foreground">{p.qty_sold}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-foreground">{p.stock_on_hand.toLocaleString()}</td>
                  </tr>
                ))}
                {!data?.worst_sellers?.length && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">No products yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tabbed Product Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Tab Bar + Search */}
        <div className="border-b border-border px-4 pt-3">
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
 : "border-transparent text-muted-foreground hover:text-foreground"
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
 ? "bg-red-100 !text-red-900"
 : "bg-secondary text-muted-foreground"
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
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search SKU or name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-border bg-card rounded-lg text-sm text-foreground focus:outline-none focus:border-indigo-400 w-48"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Filter size={13} className="text-muted-foreground flex-shrink-0" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="pl-2 pr-6 py-1.5 border border-border bg-card rounded-lg text-sm text-foreground focus:outline-none focus:border-indigo-400"
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
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-border text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">SKU</th>
                  <th className="px-5 py-3 text-left">Product</th>
                  <th className="px-5 py-3 text-left">Category</th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer hover:text-indigo-500 select-none"
                    onClick={() => toggleSort("stock_on_hand")}
                  >
                    <span className="flex items-center justify-end gap-1">Stock <SortIcon field="stock_on_hand" /></span>
                  </th>
                  <th className="px-5 py-3 text-right">Cost</th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer hover:text-indigo-500 select-none"
                    onClick={() => toggleSort("qty_sold")}
                  >
                    <span className="flex items-center justify-end gap-1">Sold <SortIcon field="qty_sold" /></span>
                  </th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer hover:text-indigo-500 select-none"
                    onClick={() => toggleSort("revenue")}
                  >
                    <span className="flex items-center justify-end gap-1">Revenue <SortIcon field="revenue" /></span>
                  </th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer hover:text-indigo-500 select-none"
                    onClick={() => toggleSort("profit")}
                  >
                    <span className="flex items-center justify-end gap-1">Profit <SortIcon field="profit" /></span>
                  </th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer hover:text-indigo-500 select-none"
                    onClick={() => toggleSort("margin_percent")}
                  >
                    <span className="flex items-center justify-end gap-1">Margin <SortIcon field="margin_percent" /></span>
                  </th>
                  <th className="px-5 py-3 text-right">STR</th>
                  <th className="px-5 py-3 text-right">GMROI</th>
                  <th className="px-5 py-3 text-right">Turnover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAndSorted.map((p) => (
                  <tr key={p.sku} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-5 py-3 font-semibold text-foreground">{p.name}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground uppercase">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-foreground">{p.stock_on_hand.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">${p.unit_cost.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{p.qty_sold.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-bold text-foreground">
                      ${p.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-emerald-600">
                      ${p.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 bg-secondary rounded-full h-1.5 overflow-hidden">
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
                    <td className="px-5 py-3 text-right font-medium text-foreground">
                      {p.sell_through_rate !== undefined ? `${p.sell_through_rate.toFixed(1)}%` : "-"}
                    </td>
                    <td className={`px-5 py-3 text-right font-bold ${p.gmroi !== undefined && p.gmroi >= 1.5 ? "text-emerald-600" : "text-amber-600"}`}>
                      {p.gmroi !== undefined ? `${p.gmroi.toFixed(2)}x` : "-"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-muted-foreground">
                      {p.inventory_turnover !== undefined ? `${p.inventory_turnover.toFixed(1)}x` : "-"}
                    </td>
                  </tr>
                ))}
                {filteredAndSorted.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-5 py-12 text-center text-muted-foreground italic">
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
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/40 text-amber-800 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">SKU</th>
                  <th className="px-5 py-3 text-left">Product</th>
                  <th className="px-5 py-3 text-left">Category</th>
                  <th className="px-5 py-3 text-right">On Hand</th>
                  <th className="px-5 py-3 text-right">Days Left</th>
                  <th className="px-5 py-3 text-right">Lead Time</th>
                  <th className="px-5 py-3 text-right">Revenue Risk</th>
                  <th className="px-5 py-3 text-right">Shortage</th>
                  <th className="px-5 py-3 text-center">Trace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {alerts?.low_stock?.map((p) => {
                  const isCritical = p.days_of_supply !== null && p.days_of_supply !== undefined && p.days_of_supply < (p.lead_time_days ?? 14);
                  return (
                  <tr key={p.sku} className={`transition-colors ${isCritical ? "bg-red-50/40 dark:bg-red-950/10" : "hover:bg-secondary/40"}`}>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-5 py-3 font-semibold text-foreground">{p.name}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-secondary text-muted-foreground uppercase">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-amber-600">{p.stock_on_hand.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right">
                      {p.stock_on_hand === 0
                        ? <span className="text-xs font-bold text-red-600">OUT</span>
                        : p.days_of_supply != null
                          ? <span className={`text-xs font-bold ${isCritical ? "text-red-600" : "text-amber-600"}`}>{p.days_of_supply}d</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground text-xs">{p.lead_time_days != null ? `${p.lead_time_days}d` : "—"}</td>
                    <td className="px-5 py-3 text-right">
                      {p.revenue_at_risk != null && p.revenue_at_risk > 0
                        ? <span className="text-xs font-bold text-red-600">${p.revenue_at_risk.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                        <AlertTriangle size={10} /> -{p.shortage}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <Link href="/dashboard/traceability?type=low_stock" className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-400 uppercase tracking-wider transition-colors">
                        Trace <ArrowRight size={10} />
                      </Link>
                    </td>
                  </tr>
                  );
                })}
                {!alerts?.low_stock?.length && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground italic">
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
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/40 text-red-800 dark:text-red-400 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">SKU</th>
                  <th className="px-5 py-3 text-left">Product</th>
                  <th className="px-5 py-3 text-left">Category</th>
                  <th className="px-5 py-3 text-right">On Hand</th>
                  <th className="px-5 py-3 text-right">Days Unsold</th>
                  <th className="px-5 py-3 text-right">Capital Locked</th>
                  <th className="px-5 py-3 text-right">Carrying Cost/mo</th>
                  <th className="px-5 py-3 text-center">Trace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {alerts?.dead_stock?.map((p) => (
                  <tr key={p.sku} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-5 py-3 font-semibold text-foreground">{p.name}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-secondary text-muted-foreground uppercase">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">{p.stock_on_hand.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right">
                      {p.days_since_last_sale != null
                        ? <span className={`text-xs font-bold ${p.days_since_last_sale > 60 ? "text-red-600" : "text-amber-600"}`}>{p.days_since_last_sale}d</span>
                        : <span className="text-muted-foreground text-xs">30+d</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">
                      ${p.estimated_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p.monthly_carrying_cost != null && p.monthly_carrying_cost > 0
                        ? <span className="text-xs font-medium text-orange-600">${p.monthly_carrying_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <Link href="/dashboard/traceability?type=dead_stock" className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-400 uppercase tracking-wider transition-colors">
                        Trace <ArrowRight size={10} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!alerts?.dead_stock?.length && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground italic">
                      No dead stock detected. All products have recent sales activity. ✓
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSV Import Validation Summary Modal */}
      {showImportSummary && importSummary && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
 importSummary.status === "success" ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"
 }`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${
 importSummary.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
 }`}>
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    CSV Import Summary: {importSummary.type.toUpperCase()}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Data validation and Ingestion audit log report
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
 importSummary.status === "success"
 ? "bg-emerald-100 text-emerald-850 border-emerald-250"
 : "bg-rose-100 text-rose-850 border-rose-250"
 }`}>
                {importSummary.status === "success" ? "Success" : "Failed"}
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-foreground">
              {/* Counters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-secondary border border-border rounded-xl text-center">
                  <span className="block text-[9px] uppercase font-bold text-muted-foreground">Total Rows</span>
                  <span className="block text-lg font-black text-foreground mt-0.5">{importSummary.total_rows}</span>
                </div>
                <div className="p-3 bg-emerald-50/50 border border-emerald-100/55 rounded-xl text-center">
                  <span className="block text-[9px] uppercase font-bold text-emerald-600">Valid Rows</span>
                  <span className="block text-lg font-black text-emerald-700 mt-0.5">{importSummary.valid_rows}</span>
                </div>
                <div className="p-3 bg-rose-50/50 border border-rose-100/55 rounded-xl text-center">
                  <span className="block text-[9px] uppercase font-bold text-rose-600">Errors</span>
                  <span className="block text-lg font-black text-rose-700 mt-0.5">{importSummary.invalid_rows}</span>
                </div>
                <div className="p-3 bg-amber-50/50 border border-amber-100/55 rounded-xl text-center">
                  <span className="block text-[9px] uppercase font-bold text-amber-600">Duplicates</span>
                  <span className="block text-lg font-black text-amber-700 mt-0.5">{importSummary.duplicate_rows}</span>
                </div>
              </div>

              {/* Missing Columns warning */}
              {importSummary.missing_columns && importSummary.missing_columns.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-2.5 items-start">
                  <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={15} />
                  <div>
                    <span className="text-xs font-bold text-amber-800">Missing Required Columns</span>
                    <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">
                      The uploaded file is missing columns: <strong className="font-semibold">{importSummary.missing_columns.join(", ")}</strong>. Please update your CSV headers.
                    </p>
                  </div>
                </div>
              )}

              {/* Errors Breakdown table */}
              {importSummary.errors && importSummary.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                    Validation Violations Log
                  </h4>
                  <div className="border border-border rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-secondary border-b border-border font-semibold text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-center w-12">Row</th>
                          <th className="px-4 py-2 w-28">Column</th>
                          <th className="px-4 py-2 w-24">Value</th>
                          <th className="px-4 py-2">Failure Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-muted-foreground">
                        {importSummary.errors.map((err, idx) => (
                          <tr key={idx} className="hover:bg-secondary font-normal">
                            <td className="px-4 py-2 font-mono text-muted-foreground text-center">{err.row || "-"}</td>
                            <td className="px-4 py-2 font-semibold text-foreground">{err.column || "-"}</td>
                            <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground truncate max-w-[95px]">{err.value !== null ? String(err.value) : <span className="text-slate-350 italic">null</span>}</td>
                            <td className="px-4 py-2 text-rose-650">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Success message */}
              {importSummary.status === "success" && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center space-y-1">
                  <p className="text-xs font-bold text-emerald-800">
                    Import completed successfully!
                  </p>
                  <p className="text-[11px] text-emerald-650 font-normal">
                    All {importSummary.processed_count} records have been written to the database.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-secondary flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowImportSummary(false);
                  setImportSummary(null);
                }}
                className="px-4 py-2 bg-card hover:bg-secondary text-foreground rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

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
