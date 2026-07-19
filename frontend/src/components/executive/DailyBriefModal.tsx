"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle, TrendingUp, Sparkles, Send, Loader2, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { getDailyBrief } from "@/services/executiveService";
import { DailyBriefResponse, PriorityItem, TraceData } from "@/types/executive";

interface DailyBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onAskFollowUp?: (question: string) => void;
}

export function DailyBriefModal({ isOpen, onClose, token, onAskFollowUp }: DailyBriefModalProps) {
  const [brief, setBrief] = useState<DailyBriefResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);
  const [followUpText, setFollowUpText] = useState("");

  useEffect(() => {
    if (isOpen && token) {
      const fetchBrief = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await getDailyBrief(token);
          setBrief(data);
        } catch (err: any) {
          console.error("Error fetching daily brief:", err);
          setError(err.message || "Failed to load the daily brief.");
        } finally {
          setLoading(false);
        }
      };
      fetchBrief();
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleSubmitFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpText.trim()) return;
    if (onAskFollowUp) {
      onAskFollowUp(followUpText);
      onClose();
    }
    setFollowUpText("");
  };

  const renderTracePanel = (trace: TraceData | undefined) => {
    if (!trace) return null;
    
    const chartData = [];
    const histLen = trace.historical_demand?.length || 0;
    const foreLen = trace.forecast_demand?.length || 0;
    
    for (let i = 0; i < histLen; i++) {
      chartData.push({
        day: `T-${histLen - i}`,
        historical: trace.historical_demand[i],
        forecast: null,
      });
    }
    for (let i = 0; i < foreLen; i++) {
      chartData.push({
        day: `T+${i+1}`,
        historical: null,
        forecast: trace.forecast_demand[i],
      });
    }
    
    const getConfidenceLabel = (conf: number) => {
      if (conf >= 0.75) return "High";
      if (conf >= 0.4) return "Medium";
      return "Low";
    };

    return (
      <div className="mt-4 p-4 bg-background border border-border/60 rounded-xl space-y-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400" />
            Recommendation Math & Trace
          </h4>
          <p className="text-xs text-muted-foreground ml-6">
            Demand has increased for 5 consecutive days.
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Chart */}
          <div className="h-48 bg-secondary/30 rounded-lg p-2 border border-border/50">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="day" hide />
                <YAxis fontSize={10} tick={{fill: '#888'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <ReferenceLine y={trace.reorder_point} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Reorder Point', fill: '#ef4444', fontSize: 10 }} />
                <Line type="monotone" dataKey="historical" stroke="#6366f1" strokeWidth={2} dot={false} name="Actual Sales" />
                <Line type="monotone" dataKey="forecast" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Forecast" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Variables Table */}
          <div className="bg-secondary/30 rounded-lg p-3 border border-border/50 text-xs flex flex-col justify-between">
            <table className="w-full text-left">
              <tbody className="divide-y divide-border/50">
                <tr><td className="py-1.5 text-muted-foreground">Current Inventory</td><td className="py-1.5 font-medium text-right text-foreground">{trace.current_inventory}</td></tr>
                <tr><td className="py-1.5 text-muted-foreground">Lead Time</td><td className="py-1.5 font-medium text-right text-foreground">{trace.lead_time} days</td></tr>
                <tr><td className="py-1.5 text-muted-foreground">Safety Stock</td><td className="py-1.5 font-medium text-right text-foreground">{trace.safety_stock}</td></tr>
                <tr><td className="py-1.5 text-muted-foreground font-semibold">Reorder Point</td><td className="py-1.5 font-bold text-right text-red-400">{trace.reorder_point}</td></tr>
                <tr><td className="py-1.5 text-muted-foreground">Trend Confidence</td><td className="py-1.5 font-medium text-right text-foreground">{getConfidenceLabel(trace.trend_confidence)} ({(trace.trend_confidence * 100).toFixed(0)}%)</td></tr>
                <tr><td className="py-1.5 text-muted-foreground font-semibold">Recommended Order Qty</td><td className="py-1.5 font-bold text-right text-indigo-400">{trace.eoq_adjustment}</td></tr>
              </tbody>
            </table>
            
            {/* Sprint 4: Purchase Impact Panel */}
            {trace.unit_cost && trace.selling_price && trace.eoq_adjustment > 0 && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                <h5 className="font-semibold text-emerald-400 mb-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> What If I Order?</h5>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="font-medium text-foreground">₹{(trace.eoq_adjustment * trace.unit_cost).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-muted-foreground">Est. Revenue</span>
                  <span className="font-medium text-foreground">₹{(trace.eoq_adjustment * trace.selling_price).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-emerald-500/20 pt-1 mt-1">
                  <span className="text-emerald-400/80 font-medium">Projected Margin</span>
                  <span className="font-bold text-emerald-400">₹{(trace.eoq_adjustment * (trace.selling_price - trace.unit_cost)).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sprint 2: Real Size Intelligence Panel */}
        {trace.size_curve_analysis && Object.keys(trace.size_curve_analysis).length > 0 && (
          <div className="mt-4 border-t border-border/50 pt-4">
             <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Apparel Size Intelligence
             </h4>
             <div className="bg-secondary/30 rounded-lg p-3 border border-border/50 flex gap-4 overflow-x-auto">
               {Object.entries(trace.size_curve_analysis).map(([size, pct]) => (
                 <div key={size} className="flex flex-col items-center flex-shrink-0">
                    <div className="h-16 w-8 bg-black/40 rounded-sm relative overflow-hidden flex items-end">
                       <div className="w-full bg-indigo-500/80" style={{ height: `${pct * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-bold mt-1 text-foreground">{size}</span>
                    <span className="text-[10px] text-muted-foreground">{(pct * 100).toFixed(0)}%</span>
                 </div>
               ))}
               <div className="ml-auto my-auto text-xs text-muted-foreground max-w-[200px] border-l border-border/50 pl-4">
                 EVE automatically shifted the recommended ratio based on real sales velocity for this specific variant group.
               </div>
             </div>
          </div>
        )}
      </div>
    );
  };

  const renderPriorityCard = (item: PriorityItem, icon: React.ReactNode, bgClass: string, textClass: string) => {
    let confColor = "text-muted-foreground border-border";
    if (item.confidence_label?.includes("High")) confColor = "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
    if (item.confidence_label?.includes("Medium")) confColor = "text-amber-400 border-amber-500/20 bg-amber-500/10";
    if (item.confidence_label?.includes("Low")) confColor = "text-rose-400 border-rose-500/20 bg-rose-500/10";

    return (
      <div key={item.title} className={`p-4 border rounded-xl flex flex-col gap-3 ${bgClass}`}>
        <div className="flex items-start justify-between">
          <h3 className={`text-sm font-semibold flex items-center gap-2 ${textClass}`}>
            {icon}
            {item.title}
          </h3>
          
          {/* Sprint 3: Confidence Badge */}
          {item.confidence_label && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${confColor}`}>
              {item.confidence_label} Confidence
            </span>
          )}
        </div>
      <div className="space-y-1.5 text-sm">
        <p><span className="text-muted-foreground font-medium">Why:</span> <span className="text-foreground">{item.why}</span></p>
        <p><span className="text-muted-foreground font-medium">Impact:</span> <span className="text-foreground">{item.impact}</span></p>
        <p><span className="text-muted-foreground font-medium">Action:</span> <span className="font-semibold text-foreground">{item.action}</span></p>

        {item.reasoning && item.reasoning.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
            {item.reasoning.map((r, i) => (
              <p key={i} className="text-amber-500/90 text-xs font-medium flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {r}
              </p>
            ))}
          </div>
        )}

        {item.size_run && Object.keys(item.size_run).length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <span className="text-muted-foreground text-xs font-medium block mb-2">Size Run</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(item.size_run).map(([size, qty]) => (
                <div key={size} className="px-2 py-0.5 bg-secondary/80 border border-border/50 rounded flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">{size}</span>
                  <span className="text-xs font-bold text-foreground">{qty}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Sprint 3: Data Quality Warnings */}
        {item.data_quality_warnings && item.data_quality_warnings.length > 0 && (
          <div className="mt-2 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-bold">Data Quality Warning:</span>
              <ul className="list-disc pl-3">
                {item.data_quality_warnings.map((w, idx) => <li key={idx}>{w}</li>)}
              </ul>
            </div>
          </div>
        )}
        
        {item.trace_data && (
          <div className="mt-2 pt-2 flex justify-end">
            <button 
              onClick={() => setExpandedExplanation(expandedExplanation === item.title ? null : item.title)}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              {expandedExplanation === item.title ? "Hide Math" : "Explain Math"}
            </button>
          </div>
        )}
      </div>
      
      {expandedExplanation === item.title && item.trace_data && renderTracePanel(item.trace_data)}
    </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-brief-title"
        aria-describedby="daily-brief-description"
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden bg-card border border-border rounded-2xl shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white rounded-lg border border-indigo-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 id="daily-brief-title" className="text-lg font-bold text-foreground">Today's Priorities</h2>
              <p id="daily-brief-description" className="text-xs text-muted-foreground">Actionable intelligence powered by EVE</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close daily brief"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-muted-foreground text-sm">Compiling today's priorities directly from EVE engines...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-foreground text-sm font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && brief && (
            <div className="space-y-8">
              {/* Revenue Risk */}
              {brief.revenue_risks?.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400 border-b border-rose-500/20 pb-2">Revenue Risk</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {brief.revenue_risks.map(item => 
                      renderPriorityCard(item, <AlertTriangle size={16} />, "bg-rose-500/5 border-rose-500/10", "text-rose-400")
                    )}
                  </div>
                </div>
              )}

              {/* Capital Risk */}
              {brief.capital_risks?.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 border-b border-amber-500/20 pb-2">Capital Risk</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {brief.capital_risks.map(item => 
                      renderPriorityCard(item, <AlertTriangle size={16} />, "bg-amber-500/5 border-amber-500/10", "text-amber-400")
                    )}
                  </div>
                </div>
              )}

              {/* Opportunities */}
              {brief.opportunities?.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 border-b border-emerald-500/20 pb-2">Opportunity</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {brief.opportunities.map(item => 
                      renderPriorityCard(item, <TrendingUp size={16} />, "bg-emerald-500/5 border-emerald-500/10", "text-emerald-400")
                    )}
                  </div>
                </div>
              )}

              {(!brief.revenue_risks?.length && !brief.capital_risks?.length && !brief.opportunities?.length) && (
                <div className="text-center py-10 text-muted-foreground">
                  <Sparkles className="w-8 h-8 text-indigo-400/50 mx-auto mb-3" />
                  <p>Your business is perfectly optimized today. No urgent priorities detected.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && brief && (
          <div className="p-4 bg-background border-t border-border">
            <form onSubmit={handleSubmitFollowUp} className="flex gap-2 items-center">
              <input
                type="text"
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                placeholder="Ask EVE a follow-up about these priorities..."
                className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!followUpText.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-muted-foreground !text-white [&_svg]:!text-white [&_svg]:!stroke-white rounded-xl transition-all shadow-lg flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Send follow-up question"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
