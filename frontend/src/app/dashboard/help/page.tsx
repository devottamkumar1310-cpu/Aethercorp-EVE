"use client";

import { useState } from "react";
import { HelpCircle, BookOpen, Brain, Play, ShieldAlert, Sparkles, HelpCircle as HelpIcon, TrendingUp, Package, Database } from "lucide-react";

interface HelpTopic {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
}

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState("getting-started");

  const topics: HelpTopic[] = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: BookOpen,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-100">Welcome to EVE AI OS</h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            EVE (Enterprise Virtual Executive) is your autonomous Chief Operating Officer. EVE continuously monitors your sales, expenses, and inventory data, and automates executive analysis so you can focus on scaling your brand.
          </p>
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-indigo-400 uppercase">First Steps:</h4>
            <ul className="list-decimal list-inside text-xs text-slate-300 space-y-2 leading-relaxed">
              <li>Explore the preloaded <strong>NovaWear Fashion</strong> demo workspace or create your own.</li>
              <li>Go to the <strong>Document Hub</strong> to upload supplier invoices, contracts, or marketing plans.</li>
              <li>Open the <strong>AI Command Center</strong> to run queries and get strategic recommendations.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "understanding-kpis",
      title: "Understanding KPIs",
      icon: TrendingUp,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-100">Key Performance Indicators</h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            EVE tracks real-time business performance on your Operations Dashboard:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-sm font-bold text-slate-200">Net Profit</h4>
              <p className="text-xs text-slate-400 mt-1">Calculated as Net Revenues minus Total Expenses. A rising trend indicates healthy operational margins.</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-sm font-bold text-slate-200">Total Clients</h4>
              <p className="text-xs text-slate-400 mt-1">The total volume of business clients. Keep track of customer retention and active relationship rates.</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-sm font-bold text-slate-200">Tasks Completion</h4>
              <p className="text-xs text-slate-400 mt-1">A metric showing operational velocity by comparing completed tasks versus total open actions.</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <h4 className="text-sm font-bold text-slate-200">Revenue Trends</h4>
              <p className="text-xs text-slate-400 mt-1">Visualized directional trends indicating whether sales volumes are scaling up or down over time.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "using-ai-coo",
      title: "Using AI COO",
      icon: Brain,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-100">AI Command Center (AI COO)</h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            Your conversational control room. Chat with EVE using normal text to command deep operational audits.
          </p>
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-indigo-400 uppercase">Suggested Prompts:</h4>
            <div className="space-y-2">
              <p className="text-xs text-slate-300">💡 <em>"Give me an executive summary of this week."</em></p>
              <p className="text-xs text-slate-300">💡 <em>"Which products are hurting our profitability?"</em></p>
              <p className="text-xs text-slate-300">💡 <em>"Detail our dead stock inventory and how to liquidate it."</em></p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "inventory-intelligence",
      title: "Inventory Intelligence",
      icon: Package,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-100">Inventory & Safety Stock</h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            EVE prevents money from being locked up in low-demand inventory, and prevents sales loss from out-of-stock events.
          </p>
          <div className="space-y-3">
            <div className="flex gap-3 items-start bg-slate-900/40 p-3 rounded-lg border border-slate-800">
              <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <div>
                <strong className="text-xs text-slate-200">Dead Stock Detection</strong>
                <p className="text-xs text-slate-400 mt-0.5">Identifies items that have low inventory turnover or haven't sold in the past 90 days.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-slate-900/40 p-3 rounded-lg border border-slate-800">
              <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <div>
                <strong className="text-xs text-slate-200">Stockout Predictions</strong>
                <p className="text-xs text-slate-400 mt-0.5">Uses linear run-rates to predict exactly how many days of inventory remain before a SKU runs out.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-slate-900/40 p-3 rounded-lg border border-slate-800">
              <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
              <div>
                <strong className="text-xs text-slate-200">Reorder Recommendations</strong>
                <p className="text-xs text-slate-400 mt-0.5">Calculates safety stock thresholds and recommends order volumes based on supplier lead times.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "executive-board",
      title: "Executive Board",
      icon: Database,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-100">Multi-Agent Executive Board</h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            EVE features specialized sub-agents that collaborate behind the scenes to analyze issues from multiple business angles:
          </p>
          <div className="space-y-2 text-xs text-slate-300">
            <p>📊 <strong className="text-slate-200">Finance Agent:</strong> Evaluates costs, pricing strategy, margin degradation, and cash-flow health.</p>
            <p>⚙️ <strong className="text-slate-200">Operations Agent:</strong> Inspects supplier constraints, lead times, and shipping performance.</p>
            <p>📈 <strong className="text-slate-200">Growth Agent:</strong> Focuses on customer lifetime value, market opportunities, and demand patterns.</p>
            <p>🤝 <strong className="text-slate-200">Executive Synthesis:</strong> Cross-references all agent reports to deliver unified, conflict-free recommendations.</p>
          </div>
        </div>
      )
    },
    {
      id: "faq",
      title: "FAQ & Troubleshooting",
      icon: HelpIcon,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-100">Frequently Asked Questions</h3>
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <h4 className="font-bold text-slate-200">How do I restart the interactive guided tour?</h4>
              <p className="text-xs text-slate-400">Click the "Restart Product Tour" button below at any time to walk through the dashboard step-by-step.</p>
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-200">Where does the AI get its business data?</h4>
              <p className="text-xs text-slate-400">EVE reads from the central database schema (Clients, Projects, Finances, and Inventory tables) plus any documents uploaded to the Document Hub.</p>
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-200">Is my company data kept secure?</h4>
              <p className="text-xs text-slate-400">Yes. All uploaded files are stored securely in encrypted buckets, and database access is locked at the workspace boundary.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "support",
      title: "Support & Feedback",
      icon: HelpCircle,
      content: (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-100">Official Support & Beta Feedback</h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            We are dedicated to building a refined, reliable virtual executive system. If you run into issues, need assistance, or want to share feedback, we are here to help.
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 border border-slate-805 p-5 rounded-xl flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" /> Support Email
                </h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Have a question, encountered a bug, or need account assistance? Send us an email and our team will get back to you promptly.
                </p>
              </div>
              <a 
                href="mailto:aethercorp.support@gmail.com" 
                className="mt-4 inline-block text-center text-xs font-bold bg-indigo-600/20 hover:bg-indigo-650 text-indigo-400 hover:text-white px-4 py-2.5 rounded-lg border border-indigo-500/20 transition-all cursor-pointer"
              >
                aethercorp.support@gmail.com
              </a>
            </div>
            
            <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-xl flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Beta Feedback Form
                </h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Your insights shape EVE's roadmap. Use our quick Google Form to submit feedback, request features, or report UI bugs.
                </p>
              </div>
              <a 
                href="https://forms.gle/qETMVJfDzHnF86xi7" 
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-center text-xs font-bold bg-emerald-600/20 hover:bg-emerald-650 text-emerald-400 hover:text-white px-4 py-2.5 rounded-lg border border-emerald-500/20 transition-all cursor-pointer"
              >
                Open Feedback Form
              </a>
            </div>
          </div>
        </div>
      )
    }
  ];

  const restartTour = () => {
    // Fire the custom event
    const event = new CustomEvent("restart-eve-tour");
    window.dispatchEvent(event);
  };

  const activeTopic = topics.find(t => t.id === activeTab) || topics[0];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 font-sans animate-fade-in text-slate-100">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <HelpCircle className="text-indigo-400" size={32} /> Help & Learning Center
          </h1>
          <p className="text-slate-400 text-sm">Find answers, learn how to use EVE COO, and restart the product tour.</p>
        </div>
        
        <button
          onClick={restartTour}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/10 cursor-pointer"
        >
          <Play size={16} /> Restart Product Tour
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Sidebar Nav */}
        <div className="md:col-span-1 space-y-1 bg-slate-900/30 backdrop-blur-xs border border-slate-850 p-3 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 block">Topics</span>
          {topics.map(t => {
            const TopicIcon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left ${
                  activeTab === t.id
                    ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <TopicIcon size={18} />
                {t.title}
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="md:col-span-2 bg-slate-900/40 dark:bg-slate-950/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-8 shadow-xl min-h-[400px]">
          {activeTopic.content}
        </div>
      </div>
    </div>
  );
}
