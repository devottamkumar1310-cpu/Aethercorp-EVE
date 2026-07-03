"use client";

import { useState } from "react";
import { X, Package, Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSuccess: () => void;
}

const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Accessories", "Footwear", "Other"];

export function AddProductModal({ isOpen, onClose, token, onSuccess }: AddProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    sku: "",
    name: "",
    category: "Tops",
    stock_on_hand: 0,
    unit_cost: 0,
    selling_price: 0,
    reorder_point: 10,
    supplier_name: "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const activeWorkspace = localStorage.getItem("active_workspace_id");
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/product`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Workspace-Id": activeWorkspace || "",
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create product");
      }
      toast.success(`Product '${form.name}' added to inventory.`);
      onSuccess();
      onClose();
      setForm({ sku: "", name: "", category: "Tops", stock_on_hand: 0, unit_cost: 0, selling_price: 0, reorder_point: 10, supplier_name: "" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form, label: string, type = "text", placeholder = "") => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
        required={["sku", "name"].includes(key)}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 dark:bg-slate-950/40">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="text-indigo-650 dark:text-indigo-400" size={20} /> Add Product
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-800 dark:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field("sku", "SKU *", "text", "e.g. TOP-001")}
            {field("name", "Product Name *", "text", "e.g. Classic White Tee")}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field("unit_cost", "Unit Cost (₹/$)", "number", "0.00")}
            {field("selling_price", "Selling Price (₹/$)", "number", "0.00")}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field("stock_on_hand", "Stock On Hand", "number", "0")}
            {field("reorder_point", "Reorder Point", "number", "10")}
          </div>
          {field("supplier_name", "Supplier Name (optional)", "text", "e.g. Textile Co.")}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 dark:border-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-900/80 dark:hover:bg-slate-200 dark:bg-slate-800 rounded-lg text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-slate-900 dark:text-slate-100 dark:text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
              {loading && <Loader2 className="animate-spin" size={14} />}
              {loading ? "Adding..." : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
