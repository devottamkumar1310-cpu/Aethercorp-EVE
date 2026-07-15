"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Search, 
  Filter, 
  ArrowLeft,
  MessageSquare
} from "lucide-react";

interface Product {
  sku: string;
  name: string;
  category: string;
  stock: number;
  velocity: number;
  daysLeft: number;
  reorderSuggestion: string;
  status: "healthy" | "low_stock" | "dead_stock";
  trappedCapital: number;
}

const mockProducts: Product[] = [
  {
    sku: "TEE-BLK-M",
    name: "Classic Cotton Tee - Black / M",
    category: "Tops",
    stock: 12,
    velocity: 2.4,
    daysLeft: 5,
    reorderSuggestion: "150 units",
    status: "low_stock",
    trappedCapital: 0
  },
  {
    sku: "HD-GRY-L",
    name: "Heavyweight Hoodie - Gray / L",
    category: "Outerwear",
    stock: 8,
    velocity: 1.6,
    daysLeft: 3,
    reorderSuggestion: "100 units",
    status: "low_stock",
    trappedCapital: 0
  },
  {
    sku: "JOG-CAR-S",
    name: "Cargo Jogger - Olive / S",
    category: "Bottoms",
    stock: 180,
    velocity: 0.1,
    daysLeft: 1800,
    reorderSuggestion: "0 units (Suspend PO)",
    status: "dead_stock",
    trappedCapital: 5400
  },
  {
    sku: "JOG-CAR-M",
    name: "Cargo Jogger - Olive / M",
    category: "Bottoms",
    stock: 220,
    velocity: 0.05,
    daysLeft: 4400,
    reorderSuggestion: "0 units (Suspend PO)",
    status: "dead_stock",
    trappedCapital: 8800
  },
  {
    sku: "TEE-WHT-L",
    name: "Classic Cotton Tee - White / L",
    category: "Tops",
    stock: 145,
    velocity: 5.2,
    daysLeft: 27,
    reorderSuggestion: "300 units",
    status: "healthy",
    trappedCapital: 0
  },
  {
    sku: "JKT-DNM-M",
    name: "Denim Trucker Jacket - Indigo / M",
    category: "Outerwear",
    stock: 65,
    velocity: 2.1,
    daysLeft: 30,
    reorderSuggestion: "120 units",
    status: "healthy",
    trappedCapital: 0
  }
];

export default function DemoPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<"all" | "low_stock" | "dead_stock">("all");
  
  // AI assistant states
  const [aiQuery, setAiQuery] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ sender: "user" | "eve"; message: string }>>([
    { sender: "eve", message: "Hi! I am EVE, your inventory intelligence assistant. Ask me anything about this demo brand's inventory health, stockout risks, or trapped working capital." }
  ]);

  const handleQuickQuestion = (question: string) => {
    let response = "I'm analyzing the inventory dataset now...";
    if (question.includes("stockout")) {
      response = "Our highest stockout risks are: \n1. TEE-BLK-M (Classic Cotton Tee - Black / M) has only 12 units left, which will run out in 5 days based on velocity of 2.4/day. \n2. HD-GRY-L (Heavyweight Hoodie - Gray / L) has only 8 units left, which will run out in 3 days. \n\nI recommend ordering 150 units of Black/M Tee and 100 units of Gray/L Hoodie immediately to avoid stockouts.";
    } else if (question.includes("capital") || question.includes("trapped")) {
      response = "You have $14,200 in trapped working capital inside overstocked items: \n- Cargo Jogger (Olive/S, Olive/M) has excessive stock (180 and 220 units) with almost zero velocity. \n\nRecommended Action: Defer the next PO draft and run a targeted promo/discount to recover this capital.";
    } else if (question.includes("health")) {
      response = "The overall Inventory Health Score is 84/100, which is optimal but requires immediate reorders for two top-selling items to protect your velocity.";
    }

    setChatLog((prev) => [
      ...prev,
      { sender: "user", message: question },
      { sender: "eve", message: response }
    ]);
  };

  const handleSendQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    const userMsg = aiQuery;
    setAiQuery("");
    setChatLog((prev) => [...prev, { sender: "user", message: userMsg }]);
    
    setTimeout(() => {
      let response = "EVE is currently simulating this answer using local workspace metrics. Try one of the quick questions below for concrete inventory recommendations.";
      const queryLower = userMsg.toLowerCase();
      if (queryLower.includes("stockout") || queryLower.includes("risk") || queryLower.includes("run out")) {
        response = "Our highest stockout risks are Classic Cotton Tee (Black/M, 5 days left) and Heavyweight Hoodie (Gray/L, 3 days left). Recommended reorder: 150 & 100 units respectively.";
      } else if (queryLower.includes("capital") || queryLower.includes("trapped") || queryLower.includes("overstock") || queryLower.includes("excess")) {
        response = "We flagged $14,200 in trapped capital in the Cargo Jogger range (Olive/S & M variants). I recommend pausing pending production runs and scheduling a liquidation event.";
      }
      setChatLog((prev) => [...prev, { sender: "eve", message: response }]);
    }, 600);
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return mockProducts.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) || 
                            product.sku.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "All" || product.category === categoryFilter;
      const matchesTab = activeTab === "all" || product.status === activeTab;
      return matchesSearch && matchesCategory && matchesTab;
    });
  }, [search, categoryFilter, activeTab]);

  return (
    <div className="min-h-screen bg-[#020203] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Background Star field & Glows */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="hero-stars" />
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-purple-500/10 rounded-full filter blur-[120px] opacity-40" />
      </div>

      {/* Navbar */}
      <header className="w-full bg-black/40 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-50 relative z-10">
        <div className="flex items-center gap-2">
          <Link href="/" className="h-8 w-8 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-black tracking-tighter shadow-md shadow-purple-900/20">
            E
          </Link>
          <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
            EVE <span className="text-xs sm:text-sm font-normal text-zinc-400">Demo Workspace</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold text-zinc-300 hover:text-white transition-colors">
            Home
          </Link>
          <Link 
            href="/signup" 
            className="text-xs sm:text-sm font-semibold bg-[#4F46E5] hover:bg-[#4F46E5]/90 px-3 sm:px-4 py-2 rounded-lg transition-all text-white shadow-md hover:-translate-y-0.5"
          >
            Create Free Account
          </Link>
        </div>
      </header>

      {/* Demo Warning Banner */}
      <div className="w-full bg-purple-500/10 border-b border-purple-500/20 text-purple-200 px-4 py-3 text-center text-xs sm:text-sm font-semibold relative z-10 flex flex-col sm:flex-row items-center justify-center gap-2">
        <span>⚡ You are viewing simulated sample reports and example insights for a high-growth fashion brand. No sign-up required.</span>
        <Link href="/signup" className="underline hover:text-purple-300 flex items-center gap-1">
          Unlock your real dashboard <ArrowRight size={14} />
        </Link>
      </div>

      {/* Workspace Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6 relative z-10">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="insight-card p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs sm:text-sm font-medium text-zinc-400">Inventory Health Score</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl sm:text-3xl font-bold text-white">84</span>
              <span className="text-xs font-semibold text-emerald-400 flex items-center"><TrendingUp size={12} className="mr-0.5" /> +2.1%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden mt-3">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: '84%' }} />
            </div>
          </div>

          <div className="insight-card p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs sm:text-sm font-medium text-zinc-400">Total Inventory Value</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl sm:text-3xl font-bold text-white">$72,920</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-2">Across 250 active stock variants</span>
          </div>

          <div className="insight-card p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs sm:text-sm font-medium text-zinc-400 flex justify-between items-center">
              Critical Stockouts
              <AlertTriangle size={14} className="text-amber-400 animate-pulse" />
            </span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl sm:text-3xl font-bold text-amber-400">2 SKUs</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-2">Predicted deficit in under 5 days</span>
          </div>

          <div className="insight-card p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs sm:text-sm font-medium text-zinc-400 flex justify-between items-center">
              Trapped Capital
              <DollarSign size={14} className="text-rose-450 text-rose-400" />
            </span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl sm:text-3xl font-bold text-rose-400">$14,200</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-2">Excess slow-moving stock</span>
          </div>
        </div>

        {/* Two Column Layout: Main Catalog & AI assistant */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Product Table & Filters */}
          <div className="lg:col-span-2 space-y-4">
            <div className="insight-card p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
                <div>
                  <h2 className="text-lg font-bold text-white">Recommended Inventory Action Items</h2>
                  <p className="text-xs text-zinc-400">View variant-level sales velocity, days left of stock, and reorder alerts.</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search by SKU or Product Name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5 border border-white/10 rounded-lg px-3 py-2 bg-white/5 text-xs">
                    <Filter size={13} className="text-zinc-450 text-zinc-400" />
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-transparent focus:outline-none text-white cursor-pointer select-dark-arrow"
                    >
                      <option value="All" className="bg-[#020203] text-white">All Categories</option>
                      <option value="Tops" className="bg-[#020203] text-white">Tops</option>
                      <option value="Bottoms" className="bg-[#020203] text-white">Bottoms</option>
                      <option value="Outerwear" className="bg-[#020203] text-white">Outerwear</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/[0.08] text-xs gap-4 font-semibold pb-1">
                <button 
                  onClick={() => setActiveTab("all")} 
                  className={`pb-2 border-b-2 transition-all ${activeTab === "all" ? "border-purple-500 text-purple-400" : "border-transparent text-zinc-450 text-zinc-400 hover:text-white"}`}
                >
                  All Products ({mockProducts.length})
                </button>
                <button 
                  onClick={() => setActiveTab("low_stock")} 
                  className={`pb-2 border-b-2 transition-all ${activeTab === "low_stock" ? "border-amber-500 text-amber-500" : "border-transparent text-zinc-450 text-zinc-400 hover:text-white"}`}
                >
                  Reorder Alerts (2)
                </button>
                <button 
                  onClick={() => setActiveTab("dead_stock")} 
                  className={`pb-2 border-b-2 transition-all ${activeTab === "dead_stock" ? "border-rose-500 text-rose-500" : "border-transparent text-zinc-450 text-zinc-400 hover:text-white"}`}
                >
                  Dead Stock Warnings (2)
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-zinc-400 font-medium bg-white/[0.01]">
                      <th className="px-4 py-3">Product SKU & Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3 text-right">Velocity (Daily)</th>
                      <th className="px-4 py-3 text-right">Days Left</th>
                      <th className="px-4 py-3 text-right">Reorder Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.08] text-zinc-200 font-mono">
                    {filteredProducts.map((p) => (
                      <tr key={p.sku} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-sans">
                          <div className="font-semibold text-white">{p.name}</div>
                          <div className="text-[10px] text-zinc-500">{p.sku}</div>
                        </td>
                        <td className="px-4 py-3 font-sans text-zinc-300">{p.category}</td>
                        <td className="px-4 py-3 text-right text-zinc-300">{p.stock}</td>
                        <td className="px-4 py-3 text-right text-zinc-300">{p.velocity} / day</td>
                        <td className={`px-4 py-3 text-right font-bold ${
                          p.status === "low_stock" ? "text-amber-400" : 
                          p.status === "dead_stock" ? "text-rose-400" : "text-emerald-450 text-emerald-400"
                        }`}>
                          {p.daysLeft > 365 ? "365+ days" : `${p.daysLeft} days`}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${p.status === "low_stock" ? "text-purple-400" : "text-zinc-500"}`}>
                          {p.reorderSuggestion}
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-zinc-500">
                          No products found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: AI Assistant Mockup */}
          <div className="space-y-4">
            <div className="insight-card flex flex-col h-[520px] overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 flex items-center gap-2 shadow-inner">
                <MessageSquare size={16} />
                <h3 className="text-sm font-bold">Ask EVE AI Assistant</h3>
              </div>

              {/* Chat Log */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs custom-scrollbar">
                {chatLog.map((log, idx) => (
                  <div key={idx} className={`flex flex-col ${log.sender === "user" ? "items-end" : "items-start"}`}>
                    <span className="text-[9px] text-zinc-500 mb-1 uppercase font-bold">
                      {log.sender === "user" ? "You" : "EVE AI"}
                    </span>
                    <div className={`p-3 rounded-xl max-w-[85%] whitespace-pre-line leading-relaxed ${
                      log.sender === "user" 
                        ? "bg-purple-600 text-white rounded-tr-none" 
                        : "bg-white/5 text-zinc-200 rounded-tl-none border border-white/10"
                    }`}>
                      {log.message}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Questions */}
              <div className="p-3 border-t border-white/[0.08] bg-white/[0.01] space-y-2">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Suggested Questions:</div>
                <div className="flex flex-wrap gap-1.5">
                  <button 
                    onClick={() => handleQuickQuestion("What is my biggest stockout risk?")}
                    className="text-[10px] px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-zinc-350 text-zinc-300 transition-all text-left"
                  >
                    ⚠️ Stockout Risks
                  </button>
                  <button 
                    onClick={() => handleQuickQuestion("How can I free up trapped capital?")}
                    className="text-[10px] px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-zinc-350 text-zinc-300 transition-all text-left"
                  >
                    💰 Free Trapped Capital
                  </button>
                  <button 
                    onClick={() => handleQuickQuestion("Summarize my inventory health.")}
                    className="text-[10px] px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-zinc-350 text-zinc-300 transition-all text-left"
                  >
                    📊 Health Summary
                  </button>
                </div>
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendQuery} className="p-3 border-t border-white/[0.08] flex gap-2">
                <input
                  type="text"
                  placeholder="Ask EVE a custom question..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                />
                <button 
                  type="submit"
                  className="px-3 py-2 bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white rounded-lg text-xs font-bold transition-all shadow-md"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center pt-4">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft size={12} /> Back to Homepage
          </Link>
        </div>
      </main>
    </div>
  );
}
