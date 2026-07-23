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
  MessageSquare,
  Sparkles,
  Bot
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
      response = "Our highest stockout risks are:\n1. TEE-BLK-M (Classic Cotton Tee - Black / M) has only 12 units left, which will run out in 5 days based on velocity of 2.4/day.\n2. HD-GRY-L (Heavyweight Hoodie - Gray / L) has only 8 units left, which will run out in 3 days.\n\nI recommend ordering 150 units of Black/M Tee and 100 units of Gray/L Hoodie immediately to avoid stockouts.";
    } else if (question.includes("capital") || question.includes("trapped")) {
      response = "You have $14,200 in trapped working capital inside overstocked items:\n- Cargo Jogger (Olive/S, Olive/M) has excessive stock (180 and 220 units) with almost zero velocity.\n\nRecommended Action: Defer the next PO draft and run a targeted promo/discount to recover this capital.";
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
    <div data-theme="executive-light" className="landing-page min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* Header Navigation */}
      <header className="w-full border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 rounded-xl" aria-label="EVE home">
            <div className="h-9 w-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-md shadow-violet-600/25">
              EVE
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-1.5">
                EVE
                <span className="chip chip-accent text-[10px] font-semibold px-2 py-0.5">Live Demo</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">Luma & Co. Interactive Workspace</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs font-semibold px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
            <Link href="/login" className="text-xs font-semibold px-3 py-2 text-foreground hover:text-indigo-600 transition-colors">
              Sign In
            </Link>
            <Link 
              href="/signup" 
              className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Demo Notice Banner */}
      <div className="w-full bg-indigo-500/10 border-b border-indigo-500/20 text-indigo-700 text-xs sm:text-sm font-medium px-4 py-2.5 text-center flex flex-col sm:flex-row items-center justify-center gap-2">
        <span>⚡ Interactive Demo — Displaying real-time intelligence for sample brand <strong>Luma & Co.</strong></span>
        <Link href="/signup" className="font-bold underline hover:text-indigo-900 inline-flex items-center gap-1">
          Start Free Trial <ArrowRight size={14} />
        </Link>
      </div>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inventory Health Score</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">84</span>
              <span className="text-xs font-bold text-emerald-600 flex items-center"><TrendingUp size={12} className="mr-0.5" /> +2.1%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-3">
              <div className="h-full bg-indigo-600 rounded-full" style={{ width: '84%' }} />
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Inventory Value</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">$72,920</span>
            </div>
            <span className="text-[11px] text-muted-foreground">Across 250 active stock variants</span>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
              Critical Stockouts
              <AlertTriangle size={14} className="text-amber-500 animate-pulse" />
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">2 SKUs</span>
            </div>
            <span className="text-[11px] text-muted-foreground">Predicted deficit in &lt; 5 days</span>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
              Trapped Capital
              <DollarSign size={14} className="text-rose-500" />
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight">$14,200</span>
            </div>
            <span className="text-[11px] text-muted-foreground">Excess slow-moving stock</span>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Product Table & Filters */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-foreground tracking-tight">Inventory Intelligence Alerts</h2>
                  <p className="text-xs text-muted-foreground">Variant sales velocity, days of supply, and automated reorder triggers.</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by SKU or Product Name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5 border border-border rounded-xl px-3 py-2 bg-background text-xs">
                    <Filter size={13} className="text-muted-foreground" />
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-transparent focus:outline-none text-foreground cursor-pointer"
                    >
                      <option value="All">All Categories</option>
                      <option value="Tops">Tops</option>
                      <option value="Bottoms">Bottoms</option>
                      <option value="Outerwear">Outerwear</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border text-xs gap-4 font-semibold pb-1">
                <button 
                  onClick={() => setActiveTab("all")} 
                  className={`pb-2 border-b-2 transition-all cursor-pointer ${activeTab === "all" ? "border-indigo-600 text-indigo-600 font-bold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  All Products ({mockProducts.length})
                </button>
                <button 
                  onClick={() => setActiveTab("low_stock")} 
                  className={`pb-2 border-b-2 transition-all cursor-pointer ${activeTab === "low_stock" ? "border-amber-500 text-amber-600 font-bold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  Reorder Alerts (2)
                </button>
                <button 
                  onClick={() => setActiveTab("dead_stock")} 
                  className={`pb-2 border-b-2 transition-all cursor-pointer ${activeTab === "dead_stock" ? "border-rose-500 text-rose-600 font-bold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  Dead Stock Warnings (2)
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-semibold bg-muted/30">
                      <th className="px-4 py-3">Product SKU & Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3 text-right">Velocity</th>
                      <th className="px-4 py-3 text-right">Days Left</th>
                      <th className="px-4 py-3 text-right">Reorder Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground font-mono">
                    {filteredProducts.map((p) => (
                      <tr key={p.sku} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-sans">
                          <div className="font-bold text-foreground">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground">{p.sku}</div>
                        </td>
                        <td className="px-4 py-3 font-sans text-muted-foreground">{p.category}</td>
                        <td className="px-4 py-3 text-right text-foreground font-semibold">{p.stock}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{p.velocity} / day</td>
                        <td className={`px-4 py-3 text-right font-bold ${
                          p.status === "low_stock" ? "text-amber-600" : 
                          p.status === "dead_stock" ? "text-rose-600" : "text-emerald-600"
                        }`}>
                          {p.daysLeft > 365 ? "365+ days" : `${p.daysLeft} days`}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${p.status === "low_stock" ? "text-indigo-600" : "text-muted-foreground"}`}>
                          {p.reorderSuggestion}
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          No products match the selected criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: AI Assistant Panel */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card shadow-sm flex flex-col h-[520px] overflow-hidden">
              <div className="bg-indigo-600 text-white p-4 flex items-center gap-2">
                <Bot size={18} />
                <h3 className="text-sm font-bold">Ask EVE AI Executive</h3>
              </div>

              {/* Chat Log */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
                {chatLog.map((log, idx) => (
                  <div key={idx} className={`flex flex-col ${log.sender === "user" ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-muted-foreground mb-1 uppercase font-bold">
                      {log.sender === "user" ? "You" : "EVE AI"}
                    </span>
                    <div className={`p-3 rounded-xl max-w-[88%] whitespace-pre-line leading-relaxed ${
                      log.sender === "user" 
                        ? "bg-indigo-600 text-white rounded-tr-none font-medium" 
                        : "bg-muted text-foreground rounded-tl-none border border-border"
                    }`}>
                      {log.message}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Questions */}
              <div className="p-3 border-t border-border bg-muted/20 space-y-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Suggested Questions:</div>
                <div className="flex flex-wrap gap-1.5">
                  <button 
                    onClick={() => handleQuickQuestion("What is my biggest stockout risk?")}
                    className="text-[11px] px-2.5 py-1 bg-background hover:bg-muted border border-border rounded-full text-foreground transition-all text-left cursor-pointer"
                  >
                    ⚠️ Stockout Risks
                  </button>
                  <button 
                    onClick={() => handleQuickQuestion("How can I free up trapped capital?")}
                    className="text-[11px] px-2.5 py-1 bg-background hover:bg-muted border border-border rounded-full text-foreground transition-all text-left cursor-pointer"
                  >
                    💰 Free Trapped Capital
                  </button>
                  <button 
                    onClick={() => handleQuickQuestion("Summarize my inventory health.")}
                    className="text-[11px] px-2.5 py-1 bg-background hover:bg-muted border border-border rounded-full text-foreground transition-all text-left cursor-pointer"
                  >
                    📊 Health Summary
                  </button>
                </div>
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendQuery} className="p-3 border-t border-border flex gap-2">
                <input
                  type="text"
                  placeholder="Ask EVE a custom question..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button 
                  type="submit"
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center py-6 border-t border-border mt-8 space-y-3">
          <h3 className="text-lg font-bold text-foreground">Ready to connect your brand?</h3>
          <div className="flex justify-center gap-3">
            <Link href="/signup" className="px-6 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:bg-primary/90 transition-all">
              Start Free Trial
            </Link>
            <Link href="/" className="px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors flex items-center gap-1">
              <ArrowLeft size={14} /> Back to Homepage
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-background border-t border-border px-4 sm:px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} EVE Inc. All rights reserved.</div>
          <div className="flex flex-wrap justify-center gap-4 font-medium">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

