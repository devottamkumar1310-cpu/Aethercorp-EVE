"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Brain,
  DollarSign,
  Clock,
  X,
  FileSpreadsheet,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { updateRecommendationStatusAPI } from "@/services/businessService";

export interface ReorderRecommendation {
  sku: string;
  productName: string;
  currentStock: number;
  daysRemaining: number | null;
  supplier: string | null;
  leadTimeDays: number | null;
  recommendedQty: number;
  avgDailySales: number;
  estimatedRevenueProtected: number;
  cashRequired: number;
  priority: "HIGH" | "MEDIUM" | "CRITICAL" | "LOW";
  confidenceScore: number | null; // null = no traceability record yet for this SKU
  decisionTraceId?: string;
  why: string;
  riskIfIgnored: string;
  expectedImpact: string;
  status?: "PENDING" | "ORDERED" | "IGNORED";
}

interface LowStockItem {
  sku: string;
  name: string;
  category?: string;
  stock_on_hand: number;
  reorder_point?: number;
  shortage?: number;
  avg_daily_sales?: number;
  days_of_supply?: number | null;
  lead_time_days?: number | null;
  revenue_at_risk?: number | null;
  unit_cost?: number;
  supplier_name?: string | null;
  recommended_order_qty?: number;
}

interface ReorderCenterProps {
  lowStockItems?: LowStockItem[];
  /** Real confidence scores keyed by SKU, sourced from Decision Traceability records. Absent = not yet evaluated. */
  confidenceBySku?: Record<string, { score: number; traceId: string }>;
  /** Controlled by the parent so KPI tiles elsewhere on the page stay in sync with actions taken here. */
  statusBySku?: Record<string, "ORDERED" | "IGNORED">;
  onStatusChange?: (sku: string, status: "ORDERED" | "IGNORED") => void;
  /** Session token — required to persist Mark as Ordered / Ignore to the backend and Activity Log. */
  token?: string;
}

export function ReorderCenter({ lowStockItems = [], confidenceBySku = {}, statusBySku = {}, onStatusChange, token }: ReorderCenterProps) {
  const recommendationsFromData: ReorderRecommendation[] = lowStockItems.map((item) => {
    const avgDaily = item.avg_daily_sales ?? 0;
    const daysRem = item.days_of_supply ?? null;
    const lead = item.lead_time_days ?? null;
    const recQty = item.recommended_order_qty ?? Math.max(0, item.shortage ?? 0);
    const cost = item.unit_cost || 0;
    const cashNeeded = Math.round(recQty * cost);
    const revProtected = item.revenue_at_risk ?? 0;
    const priority: ReorderRecommendation["priority"] =
      daysRem !== null && daysRem <= 5 ? "CRITICAL" : daysRem !== null && daysRem <= 10 ? "HIGH" : "MEDIUM";
    const trace = confidenceBySku[item.sku];

    const daysText = daysRem !== null ? `${daysRem} day${daysRem === 1 ? "" : "s"}` : "an unknown number of days";
    const leadText = lead !== null ? `${lead}-day` : "unspecified";

    return {
      sku: item.sku,
      productName: item.name,
      currentStock: item.stock_on_hand,
      daysRemaining: daysRem,
      supplier: item.supplier_name || null,
      leadTimeDays: lead,
      recommendedQty: recQty,
      avgDailySales: avgDaily,
      estimatedRevenueProtected: revProtected,
      cashRequired: cashNeeded,
      priority,
      confidenceScore: trace ? Math.round(trace.score * (trace.score <= 1 ? 100 : 1)) : null,
      decisionTraceId: trace?.traceId,
      why: `Current stock of ${item.stock_on_hand} units covers ${daysText} at the observed ${avgDaily.toLocaleString()}/day sales velocity, against a ${leadText} supplier lead time.`,
      riskIfIgnored: revProtected > 0
        ? `Projected revenue exposure of $${revProtected.toLocaleString()} if this SKU stocks out before the next delivery.`
        : `Stock is projected to run below the reorder point before the next delivery window.`,
      expectedImpact: `Reordering ${recQty.toLocaleString()} units commits $${cashNeeded.toLocaleString()} of working capital${revProtected > 0 ? ` to protect $${revProtected.toLocaleString()} of at-risk revenue` : ""}.`,
      status: "PENDING",
    };
  });

  const recommendations: ReorderRecommendation[] = recommendationsFromData.map((r) => ({
    ...r,
    status: statusBySku[r.sku] || r.status || "PENDING",
  }));
  const [selectedReasoning, setSelectedReasoning] = useState<ReorderRecommendation | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "ORDERED" | "IGNORED">("ALL");
  const [pendingSku, setPendingSku] = useState<string | null>(null);

  const filtered = recommendations.filter((r) => {
    if (statusFilter === "ALL") return true;
    return (r.status || "PENDING") === statusFilter;
  });

  const persistStatus = async (item: ReorderRecommendation, uiStatus: "ORDERED" | "IGNORED") => {
    if (!item.decisionTraceId) {
      toast.error(`No Decision Traceability record exists yet for ${item.sku} — can't persist this action.`);
      return;
    }
    if (!token) {
      toast.error("Sign-in session not ready. Please retry in a moment.");
      return;
    }
    setPendingSku(item.sku);
    try {
      await updateRecommendationStatusAPI(token, item.decisionTraceId, uiStatus === "ORDERED" ? "Completed" : "Dismissed");
      onStatusChange?.(item.sku, uiStatus);
      toast.success(
        uiStatus === "ORDERED"
          ? `${item.sku} marked as ordered — logged to Activity and Decision Traceability.`
          : `${item.sku} marked as ignored — logged to Activity and Decision Traceability.`
      );
    } catch (err: any) {
      toast.error(err?.message || `Couldn't save this action for ${item.sku}. Please try again.`);
    } finally {
      setPendingSku(null);
    }
  };

  const handleMarkOrdered = (item: ReorderRecommendation) => persistStatus(item, "ORDERED");
  const handleIgnore = (item: ReorderRecommendation) => persistStatus(item, "IGNORED");

  const handleExportCSV = () => {
    const headers = [
      "SKU",
      "Product",
      "Current Stock",
      "Days Remaining",
      "Supplier",
      "Lead Time Days",
      "Recommended Qty",
      "Estimated Revenue Protected ($)",
      "Cash Required ($)",
      "Priority",
      "Confidence (%)",
      "Status",
    ];
    const rows = recommendations.map((r) => [
      r.sku,
      `"${r.productName.replace(/"/g, '""')}"`,
      r.currentStock,
      r.daysRemaining ?? "",
      `"${r.supplier || "Not on file"}"`,
      r.leadTimeDays ?? "",
      r.recommendedQty,
      r.estimatedRevenueProtected,
      r.cashRequired,
      r.priority,
      r.confidenceScore ?? "Not yet evaluated",
      r.status || "PENDING",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `eve_reorder_recommendations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Reorder recommendations exported to CSV successfully.");
  };

  // Aggregates
  const totalRevenueProtected = recommendations
    .filter((r) => r.status !== "IGNORED")
    .reduce((acc, r) => acc + r.estimatedRevenueProtected, 0);
  const totalCashRequired = recommendations
    .filter((r) => r.status !== "IGNORED")
    .reduce((acc, r) => acc + r.cashRequired, 0);
  const pendingCount = recommendations.filter((r) => (r.status || "PENDING") === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Header Banner & Summary */}
      <div className="rounded-xl border border-border eve-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> Executive Decision Workspace
              </span>
              <span className="text-xs text-muted-foreground">Not an ERP — Powered by Decision Intelligence</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Reorder Center
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Replenishment recommendations calculated from current stock, sales velocity, lead times, and revenue at risk for SKUs at or below their reorder point.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-border bg-secondary hover:bg-muted text-secondary-foreground transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Executive Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
          <div className="bg-muted/40 rounded-lg p-3.5 border border-border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Est. Revenue Protected
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              ${totalRevenueProtected.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Top-line revenue safeguarded</p>
          </div>

          <div className="bg-muted/40 rounded-lg p-3.5 border border-border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Working Capital Required
            </div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              ${totalCashRequired.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Required inventory outlay</p>
          </div>

          <div className="bg-muted/40 rounded-lg p-3.5 border border-border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Pending Founder Actions
            </div>
            <div className="text-xl font-bold text-foreground">
              {pendingCount} SKU Recommendations
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Requiring review or order dispatch</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          {(["ALL", "PENDING", "ORDERED", "IGNORED"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {st === "ALL" ? "All Recommendations" : st.charAt(0) + st.slice(1).toLowerCase()}
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-background/60 text-muted-foreground border border-border/70">
                {st === "ALL"
                  ? recommendations.length
                  : recommendations.filter((r) => (r.status || "PENDING") === st).length}
              </span>
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Showing {filtered.length} of {recommendations.length} items
        </span>
      </div>

      {/* Reorder Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="py-3.5 px-4">SKU</th>
                <th className="py-3.5 px-4 min-w-[200px]">Product</th>
                <th className="py-3.5 px-3 text-center">Current Stock</th>
                <th className="py-3.5 px-3 text-center">Days Rem.</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-3 text-center">Lead Time</th>
                <th className="py-3.5 px-3 text-right">Rec. Qty</th>
                <th className="py-3.5 px-4 text-right">Est. Rev Protected</th>
                <th className="py-3.5 px-4 text-right">Cash Required</th>
                <th className="py-3.5 px-3 text-center">Priority</th>
                <th className="py-3.5 px-3 text-center">Confidence</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {lowStockItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground">
                    <PackageCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                    No SKUs are currently below their reorder point. Stock coverage is healthy.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-muted-foreground">
                    <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                    No reorder recommendations match the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isOrdered = item.status === "ORDERED";
                  const isIgnored = item.status === "IGNORED";

                  return (
                    <tr
                      key={item.sku}
                      className={`hover:bg-muted/40 transition-colors ${
                        isOrdered ? "opacity-70 bg-emerald-500/5" : isIgnored ? "opacity-60" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                        {item.sku}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        {item.productName}
                        {isOrdered && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-500/30">
                            Ordered
                          </span>
                        )}
                        {isIgnored && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded border border-border">
                            Ignored
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-semibold">
                        <span className={item.currentStock < 20 ? "text-amber-600 dark:text-amber-400 font-bold" : ""}>
                          {item.currentStock}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {item.daysRemaining !== null ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              item.daysRemaining <= 5
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold"
                                : item.daysRemaining <= 10
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {item.daysRemaining} days
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground truncate max-w-[160px]" title={item.supplier || "Not on file"}>
                        {item.supplier || "Not on file"}
                      </td>
                      <td className="py-3.5 px-3 text-center text-muted-foreground">
                        {item.leadTimeDays !== null ? `${item.leadTimeDays}d` : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-foreground">
                        +{item.recommendedQty.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        ${item.estimatedRevenueProtected.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-amber-600 dark:text-amber-400">
                        ${item.cashRequired.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.priority === "CRITICAL"
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                              : item.priority === "HIGH"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {item.confidenceScore !== null ? (
                          <div className="flex items-center justify-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                            <Sparkles className="w-3 h-3" />
                            {item.confidenceScore}%
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground" title="No Decision Traceability record exists yet for this SKU">
                            Not yet evaluated
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedReasoning(item)}
                            className="px-2.5 py-1 text-[11px] font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 rounded border border-indigo-500/25 transition-colors flex items-center gap-1"
                            title="View reasoning behind this recommendation"
                          >
                            <Brain className="w-3 h-3" />
                            Reasoning
                          </button>

                          <Link
                            href={item.decisionTraceId
                              ? `/dashboard/traceability?type=reorder&sku=${item.sku}&traceId=${item.decisionTraceId}`
                              : `/dashboard/traceability?type=reorder&sku=${item.sku}`}
                            className="p-1 text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-muted rounded transition-colors"
                            title="Open Decision Traceability"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>

                          {!isOrdered && !isIgnored && (
                            <>
                              <button
                                onClick={() => handleMarkOrdered(item)}
                                disabled={pendingSku === item.sku}
                                className="p-1 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-muted rounded transition-colors disabled:opacity-40 disabled:cursor-wait"
                                title="Mark as Ordered"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleIgnore(item)}
                                disabled={pendingSku === item.sku}
                                className="p-1 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-muted rounded transition-colors disabled:opacity-40 disabled:cursor-wait"
                                title="Ignore Recommendation"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {lowStockItems.length > 0 && (
          <p className="px-4 py-2.5 text-[11px] text-muted-foreground border-t border-border bg-muted/20">
            Mark as Ordered / Ignore is logged to the Business Activity Log and the recommendation's Decision Traceability record. It does not yet issue a purchase order to a supplier system.
          </p>
        )}
      </div>

      {/* AI Reasoning Modal / Drawer */}
      {selectedReasoning && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSelectedReasoning(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">
                  Reorder Recommendation
                </span>
                <h3 className="text-lg font-bold text-foreground">
                  {selectedReasoning.productName}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  SKU: {selectedReasoning.sku} • Confidence: {selectedReasoning.confidenceScore !== null ? `${selectedReasoning.confidenceScore}%` : "Not yet evaluated"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/40 p-3.5 rounded-lg border border-border">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold block mb-1">Current Signal</span>
                <p className="text-xs text-foreground">
                  {selectedReasoning.avgDailySales > 0
                    ? `Selling ${selectedReasoning.avgDailySales.toLocaleString()} units/day on average.`
                    : "No recent sales velocity recorded for this SKU."}
                </p>
              </div>

              <div className="bg-muted/40 p-3.5 rounded-lg border border-border">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold block mb-1">Why Reorder Now?</span>
                <p className="text-xs text-foreground">{selectedReasoning.why}</p>
              </div>

              <div className="bg-rose-500/5 p-3.5 rounded-lg border border-rose-500/20 col-span-1 sm:col-span-2">
                <span className="text-[11px] text-rose-700 dark:text-rose-400 uppercase font-semibold block mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Risk If Ignored
                </span>
                <p className="text-xs text-rose-700 dark:text-rose-200">{selectedReasoning.riskIfIgnored}</p>
              </div>

              <div className="bg-emerald-500/5 p-3.5 rounded-lg border border-emerald-500/20 col-span-1 sm:col-span-2">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold block mb-1 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Expected Business Impact
                </span>
                <p className="text-xs text-emerald-700 dark:text-emerald-200">{selectedReasoning.expectedImpact}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Link
                  href={selectedReasoning.decisionTraceId
                    ? `/dashboard/traceability?type=reorder&sku=${selectedReasoning.sku}&traceId=${selectedReasoning.decisionTraceId}`
                    : `/dashboard/traceability?type=reorder&sku=${selectedReasoning.sku}`}
                  onClick={() => setSelectedReasoning(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors shadow-xs"
                >
                  <Sparkles className="w-4 h-4" /> Open Full Decision Traceability
                </Link>
                <Link
                  href="/dashboard/tasks"
                  onClick={() => setSelectedReasoning(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-semibold transition-colors"
                >
                  Add to Tasks →
                </Link>
              </div>
              <button
                onClick={() => setSelectedReasoning(null)}
                className="px-4 py-2 rounded-lg border border-border bg-secondary text-secondary-foreground hover:bg-muted text-xs font-medium transition-colors"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
