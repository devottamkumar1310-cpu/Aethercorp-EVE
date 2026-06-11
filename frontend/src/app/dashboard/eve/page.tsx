"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  sendExecutiveChat, 
  listGoals, 
  getRecommendations 
} from "@/services/executiveService";
import { 
  fetchHealth, 
  fetchRisks, 
  fetchOpportunities, 
  fetchTrends 
} from "@/services/intelligenceService";
import { 
  AgentAnalysisResult, 
  MessageResponse, 
  BusinessGoalResponse, 
  AIRecommendationResponse 
} from "@/types/executive";
import { DailyBriefModal } from "@/components/executive/DailyBriefModal";
import { MemoryManagerPanel } from "@/components/executive/MemoryManagerPanel";
import { RecommendationHistoryPanel } from "@/components/executive/RecommendationHistoryPanel";

import { 
  Brain, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Send, 
  Loader2, 
  Target, 
  Database, 
  ShieldAlert, 
  Lightbulb, 
  Compass, 
  User, 
  HelpCircle, 
  ArrowRight,
  BookOpen
} from "lucide-react";

// Markdown parser helpers
function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-indigo-300">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function renderMarkdown(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const content = line.trim().replace(/^[-*]\s+/, "");
      return (
        <li key={idx} className="ml-4 list-disc text-slate-300 text-sm mb-1 leading-relaxed">
          {renderFormattedText(content)}
        </li>
      );
    }
    if (line.trim().startsWith("### ")) {
      return (
        <h4 key={idx} className="text-sm font-semibold text-indigo-400 mt-3 mb-1.5">
          {renderFormattedText(line.trim().substring(4))}
        </h4>
      );
    }
    if (line.trim().startsWith("## ")) {
      return (
        <h3 key={idx} className="text-base font-bold text-slate-100 mt-4 mb-2">
          {renderFormattedText(line.trim().substring(3))}
        </h3>
      );
    }
    if (line.trim().startsWith("# ")) {
      return (
        <h2 key={idx} className="text-lg font-extrabold text-white mt-5 mb-2.5">
          {renderFormattedText(line.trim().substring(2))}
        </h2>
      );
    }
    if (line.trim() === "") {
      return <div key={idx} className="h-2" />;
    }
    return (
      <p key={idx} className="text-slate-300 text-sm mb-2 leading-relaxed">
        {renderFormattedText(line)}
      </p>
    );
  });
}

export default function EVECoocommandCenter() {
  const [sessionToken, setSessionToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [chatMode, setChatMode] = useState<"smart" | "full">("smart");
  const [inputMessage, setInputMessage] = useState("");
  const [showTelemetry, setShowTelemetry] = useState(false);

  // Resizable panel widths (percentages)
  const [leftWidth, setLeftWidth] = useState(22);
  const [chatWidth, setChatWidth] = useState(43);

  // Loading stage tracker
  const [loadingStage, setLoadingStage] = useState(0);

  // Responsive layout state
  const [isDesktop, setIsDesktop] = useState(false);
  const [leftActiveTab, setLeftActiveTab] = useState<"risks" | "opportunities">("risks");

  // Modals & Panels open states
  const [isDailyBriefOpen, setIsDailyBriefOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(false);

  // Business metrics & data states
  const [healthScore, setHealthScore] = useState<number>(0);
  const [healthStatus, setHealthStatus] = useState<string>("Determining...");
  const [healthTrends, setHealthTrends] = useState<any>(null);
  const [risks, setRisks] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [goals, setGoals] = useState<BusinessGoalResponse[]>([]);

  // Track if desktop viewport size is active
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1280);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Chat message state
  const [messages, setMessages] = useState<MessageResponse[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      content: "Welcome to the EVE AI COO Command Center. I am analyzing real-time finance, inventory, and operations parameters. You can set long-term strategic goals in the Memory Manager or request a Daily Brief. What analysis shall we run?",
      created_at: new Date().toISOString()
    }
  ]);

  // Track the agent data for the right panel
  const [selectedReasoning, setSelectedReasoning] = useState<AgentAnalysisResult | null>(null);

  // Scroll ref for chat window
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Draggable panel resizers mouse event listeners
  const handleLeftMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    const doDrag = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / window.innerWidth) * 100;
      const newWidth = Math.max(18, Math.min(30, startWidth + deltaPercent));
      setLeftWidth(newWidth);
    };
    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
    };
    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const handleChatMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = chatWidth;
    const doDrag = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / window.innerWidth) * 100;
      const newWidth = Math.max(30, Math.min(55, startWidth + deltaPercent));
      if (100 - leftWidth - newWidth >= 20) {
        setChatWidth(newWidth);
      }
    };
    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
    };
    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  // Loading stage timer triggers
  useEffect(() => {
    if (!chatLoading) {
      setLoadingStage(0);
      return;
    }
    setLoadingStage(1);
    const t1 = setTimeout(() => setLoadingStage(2), 1200);
    const t2 = setTimeout(() => setLoadingStage(3), 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [chatLoading]);

  // Quick prompt chips
  const promptChips = [
    "What needs my attention?",
    "Finance summary",
    "Identify overstock risks",
    "Pricing optimizations"
  ];

  const scrollChatToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [messages, chatLoading]);

  // Initial dashboard hydration
  const hydrateDashboard = async (token: string) => {
    try {
      const [healthData, riskData, oppData, trendData, goalsData] = await Promise.all([
        fetchHealth(token),
        fetchRisks(token),
        fetchOpportunities(token),
        fetchTrends(token),
        listGoals(token)
      ]);

      if (healthData) {
        setHealthScore(healthData.score || 0);
        setHealthStatus(healthData.status || "Unknown");
      }
      if (riskData && riskData.risks) setRisks(riskData.risks.slice(0, 3));
      if (oppData && oppData.opportunities) setOpportunities(oppData.opportunities.slice(0, 3));
      setHealthTrends(trendData);
      setGoals(goalsData);
    } catch (err) {
      console.error("Hydration failed:", err);
    }
  };

  useEffect(() => {
    async function initialize() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = "/login";
          return;
        }
        setSessionToken(session.access_token);
        await hydrateDashboard(session.access_token);
      } catch (err) {
        console.error("EVE setup error:", err);
      } finally {
        setLoading(false);
      }
    }
    initialize();
  }, []);

  const handleSendChat = async (messageText: string) => {
    if (!messageText.trim() || !sessionToken || chatLoading) return;

    // Add user message locally
    const userMsg: MessageResponse = {
      id: Math.random().toString(),
      role: "user",
      content: messageText,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setChatLoading(true);

    try {
      const response = await sendExecutiveChat(messageText, sessionToken, conversationId, chatMode);
      setConversationId(response.conversation_id);

      const assistantMsg: MessageResponse = response.message;
      setMessages((prev) => [...prev, assistantMsg]);

      // Automatically populate Right Reasoning panel with returned agent data
      if (assistantMsg.agent_data) {
        setSelectedReasoning(assistantMsg.agent_data as AgentAnalysisResult);
      }
    } catch (err: any) {
      console.error("Chat send failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "assistant",
          content: err.message || "An unexpected error occurred.",
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleFollowUpQuestion = (question: string) => {
    handleSendChat(question);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-slate-950 text-slate-100">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400 text-sm tracking-wider animate-pulse">Initializing EVE COO Command Center...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen xl:min-h-0 xl:h-[calc(100vh-57px)] w-full overflow-y-auto xl:overflow-hidden flex flex-col xl:flex-row p-4 xl:p-5 gap-4 font-sans">
      
      {/* Left Column - System Health & Alerts */}
      <div 
        className="w-full xl:h-full xl:overflow-y-auto pr-1 flex flex-col gap-4 scrollbar-thin flex-shrink-0"
        style={isDesktop ? { width: `${leftWidth}%` } : undefined}
      >
        {/* Health Score Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Brain size={14} className="text-indigo-400" /> Executive Dashboard
          </h3>

          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center border font-bold text-xl ${
              healthScore >= 80 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : healthScore >= 60 
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {healthScore}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Business Health Status</div>
              <div className={`text-[11px] mt-0.5 font-medium ${
                healthScore >= 80 ? 'text-emerald-400' : healthScore >= 60 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {healthStatus}
              </div>
            </div>
          </div>

          {/* Health Trend indicators */}
          {healthTrends && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-slate-400">Profitability:</span>
                <span className={healthTrends.profit_trend === 'up' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {healthTrends.profit_trend === 'up' ? '↑' : '↓'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-slate-400">Task Velocity:</span>
                <span className={healthTrends.task_trend === 'up' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {healthTrends.task_trend === 'up' ? '↑' : '↓'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Daily Brief & Goal CTAs */}
        <div className="grid grid-cols-3 gap-2 flex-shrink-0">
          <button
            onClick={() => setIsDailyBriefOpen(true)}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 transition-all border border-indigo-500/20 rounded-xl flex flex-col justify-between text-left group shadow-lg cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-indigo-200 mb-2 group-hover:scale-105 transition-transform" />
            <div>
              <span className="block text-[10px] font-semibold text-white leading-tight">Daily Brief</span>
              <span className="text-[8px] text-indigo-200 mt-0.5">Synthesize today</span>
            </div>
          </button>

          <button
            onClick={() => setIsMemoryOpen(true)}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 transition-all border border-slate-800 rounded-xl flex flex-col justify-between text-left group shadow-lg cursor-pointer"
          >
            <Target className="w-4 h-4 text-slate-400 mb-2 group-hover:scale-105 transition-transform" />
            <div>
              <span className="block text-[10px] font-semibold text-slate-200 leading-tight">Goals Memory</span>
              <span className="text-[8px] text-slate-400 mt-0.5 font-normal">Set goals</span>
            </div>
          </button>

          <button
            onClick={() => setIsRecommendationsOpen(true)}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 transition-all border border-slate-800 rounded-xl flex flex-col justify-between text-left group shadow-lg cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-slate-400 mb-2 group-hover:scale-105 transition-transform" />
            <div>
              <span className="block text-[10px] font-semibold text-slate-200 leading-tight">AI Insights</span>
              <span className="text-[8px] text-slate-400 mt-0.5 font-normal">Rec history</span>
            </div>
          </button>
        </div>

        {/* Risks & Opportunities Alerts panel (Tabbed for spacing optimization) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex-1 flex flex-col overflow-hidden min-h-[260px] xl:min-h-0">
          
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 mb-3 flex-shrink-0">
            <button
              onClick={() => setLeftActiveTab("risks")}
              className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-all flex items-center justify-center gap-1.5 ${
                leftActiveTab === "risks" 
                  ? "bg-slate-800 text-slate-100 shadow-sm" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldAlert size={11} className="text-rose-450" />
              <span>Risks ({risks.length})</span>
            </button>
            <button
              onClick={() => setLeftActiveTab("opportunities")}
              className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-all flex items-center justify-center gap-1.5 ${
                leftActiveTab === "opportunities" 
                  ? "bg-slate-800 text-slate-100 shadow-sm" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Lightbulb size={11} className="text-emerald-450" />
              <span>Opportunities ({opportunities.length})</span>
            </button>
          </div>

          <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 scrollbar-thin">
            {leftActiveTab === "risks" ? (
              <>
                {risks.map((risk, idx) => (
                  <div key={idx} className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-400 font-semibold uppercase tracking-wider text-[9px]">
                      <AlertTriangle size={10} /> {risk.category || "Inventory Alert"}
                    </div>
                    <p className="text-slate-300 leading-relaxed font-normal">{risk.description}</p>
                  </div>
                ))}
                {risks.length === 0 && (
                  <p className="text-xs text-slate-500 italic text-center py-8">No active risks detected.</p>
                )}
              </>
            ) : (
              <>
                {opportunities.map((opp, idx) => (
                  <div key={idx} className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold uppercase tracking-wider text-[9px]">
                      <TrendingUp size={10} /> {opp.category || "Growth"}
                    </div>
                    <p className="text-slate-300 leading-relaxed font-normal">{opp.description}</p>
                  </div>
                ))}
                {opportunities.length === 0 && (
                  <p className="text-xs text-slate-550 italic text-center py-8">No growth opportunities detected.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Draggable Divider 1 */}
      {isDesktop && (
        <div 
          onMouseDown={handleLeftMouseDown}
          className="group w-1.5 hover:bg-indigo-600/40 active:bg-indigo-500/80 cursor-col-resize self-stretch transition-all duration-150 z-20 flex-shrink-0 flex items-center justify-center"
          title="Drag to resize panels"
        >
          <div className="w-[2px] h-8 bg-slate-800 group-hover:bg-indigo-400/80 rounded transition-all" />
        </div>
      )}

      {/* Middle Column - Multi-Turn EVE Command Center Chat */}
      <div 
        className="w-full xl:h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative flex-shrink-0"
        style={isDesktop ? { width: `${chatWidth}%` } : undefined}
      >
        
        {/* Conversational Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-600/30">
              <Brain size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                EVE Agent Network <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Active</span>
              </h2>
              <p className="text-[10px] text-slate-400">Queries route automatically to COO, Finance & Operations agents</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Advanced Telemetry Toggle */}
            <button
              type="button"
              onClick={() => setShowTelemetry(!showTelemetry)}
              className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                showTelemetry 
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20" 
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
              }`}
              title="Toggle Advanced Telemetry"
            >
              <Database size={10} />
              <span>Telemetry: {showTelemetry ? "ON" : "OFF"}</span>
            </button>

            {/* Mode Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setChatMode("smart")}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
                  chatMode === "smart" 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Fast query routing"
              >
                Smart
              </button>
              <button
                type="button"
                onClick={() => setChatMode("full")}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
                  chatMode === "full" 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Deep sub-agent aggregation"
              >
                Full
              </button>
            </div>
          </div>
        </div>

          {/* Conversation history area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/20 scrollbar-thin">
            {messages.map((msg) => {
              const isAssistant = msg.role === "assistant";
              const agentData = msg.agent_data as any;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[85%] ${
                    isAssistant ? "mr-auto" : "ml-auto flex-row-reverse"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isAssistant 
                      ? "bg-indigo-600 text-white border border-indigo-500/20" 
                      : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}>
                    {isAssistant ? <Brain size={14} /> : <User size={14} />}
                  </div>

                  <div className="space-y-1.5">
                    {/* Active agent badges for assistant */}
                    {isAssistant && msg.id !== "welcome-msg" && (
                      <div className="flex flex-wrap gap-1.5 items-center mb-1">
                        <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                          {agentData?.agent || "COO Lead"}
                        </span>
                        {agentData?.confidence_scores ? (
                          Object.entries(agentData.confidence_scores).map(([name, score]: [string, any]) => (
                            <span key={name} className="text-[8px] font-bold bg-slate-800 text-slate-400 border border-slate-700/60 px-1.5 py-0.2 rounded-md uppercase tracking-wide">
                              {name.replace(" Agent", "").replace(" Intelligence Agent", "")}: {Math.round(score * 100)}%
                            </span>
                          ))
                        ) : agentData?.confidence !== undefined ? (
                          <span className="text-[8px] font-bold bg-slate-800 text-slate-400 border border-slate-700/60 px-1.5 py-0.2 rounded-md uppercase tracking-wide">
                            Confidence: {Math.round(agentData.confidence * 100)}%
                          </span>
                        ) : null}
                      </div>
                    )}

                    <div className={`rounded-2xl px-4 py-3 border text-sm leading-relaxed space-y-3 ${
                      isAssistant 
                        ? "bg-slate-900 text-slate-100 border-slate-800/80 shadow-md" 
                        : "bg-indigo-600/15 text-indigo-100 border-indigo-500/20 shadow-md"
                    }`}>
                      {isAssistant ? (
                        <>
                          {renderMarkdown(msg.content)}
                          
                          {/* findings by agent */}
                          {agentData?.findings_by_agent && Object.keys(agentData.findings_by_agent).length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Agent Findings</span>
                              <div className="space-y-2">
                                {Object.entries(agentData.findings_by_agent).map(([agentName, list]: [string, any]) => (
                                  <div key={agentName} className="text-xs">
                                    <span className="font-semibold text-indigo-300 block mb-0.5">{agentName}:</span>
                                    <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                                      {list.map((item: string, idx: number) => (
                                        <li key={idx} className="leading-relaxed">{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* legacy findings */}
                          {!agentData?.findings_by_agent && agentData?.findings && agentData.findings.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Findings</span>
                              <ul className="list-disc pl-4 space-y-0.5 text-xs text-slate-300">
                                {agentData.findings.map((item: string, idx: number) => (
                                  <li key={idx} className="leading-relaxed">{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Priorities */}
                          {agentData?.priorities && agentData.priorities.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Strategic Priorities</span>
                              <div className="grid grid-cols-1 gap-2">
                                {agentData.priorities.map((pri: any, idx: number) => (
                                  <div key={idx} className="p-3 bg-indigo-950/20 border border-indigo-500/10 rounded-xl space-y-1">
                                    <span className="text-xs font-semibold text-indigo-300 block">Priority {idx + 1}: {pri.title}</span>
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-normal">{pri.description}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Expected Business Impact */}
                          {agentData?.expected_impact && (
                            <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs space-y-0.5">
                              <span className="font-semibold text-emerald-400 block text-[10px] uppercase tracking-wider">Expected Business Impact</span>
                              <p className="text-slate-300 font-normal leading-relaxed">{agentData.expected_impact}</p>
                            </div>
                          )}

                          {/* Recommendations by agent */}
                          {agentData?.recommendations_by_agent && Object.keys(agentData.recommendations_by_agent).length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Recommendations by Agent</span>
                              <div className="space-y-2">
                                {Object.entries(agentData.recommendations_by_agent).map(([agentName, list]: [string, any]) => (
                                  <div key={agentName} className="text-xs space-y-1">
                                    <span className="font-semibold text-indigo-300 block">{agentName}:</span>
                                    <div className="grid grid-cols-1 gap-1.5 pl-2">
                                      {list.map((item: string, idx: number) => (
                                        <div key={idx} className="p-2 bg-slate-950 border border-slate-800/50 rounded-lg text-slate-300">
                                          {item}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* legacy recommendations */}
                          {!agentData?.recommendations_by_agent && agentData?.recommendations && agentData.recommendations.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Recommendations</span>
                              <div className="grid grid-cols-1 gap-1.5">
                                {agentData.recommendations.map((item: string, idx: number) => (
                                  <div key={idx} className="p-2 bg-slate-950 border border-slate-800/50 rounded-lg text-xs text-slate-300">
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Telemetry metadata */}
                          {agentData?.telemetry && (
                            showTelemetry ? (
                              <div className="mt-4 pt-3 border-t border-slate-850 space-y-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Execution Telemetry</span>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-400">
                                  <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg">
                                    <span className="block text-slate-500">Total Latency</span>
                                    <span className="font-semibold text-indigo-400">{agentData.telemetry.latency_ms} ms</span>
                                  </div>
                                  <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg">
                                    <span className="block text-slate-500">Token Cost</span>
                                    <span className="font-semibold text-emerald-400">${agentData.telemetry.estimated_cost?.toFixed(6) || "0.000000"}</span>
                                  </div>
                                  <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg">
                                    <span className="block text-slate-500">Prompt Tokens</span>
                                    <span className="font-semibold text-slate-300">{agentData.telemetry.prompt_tokens}</span>
                                  </div>
                                  <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg">
                                    <span className="block text-slate-500">Completion Tokens</span>
                                    <span className="font-semibold text-slate-300">{agentData.telemetry.completion_tokens}</span>
                                  </div>
                                </div>
                                {/* Agent execution details */}
                                {agentData.telemetry.agents && Object.keys(agentData.telemetry.agents).length > 0 && (
                                  <div className="p-2 bg-slate-950/40 border border-slate-800 rounded-lg text-[9px] text-slate-500 space-y-1">
                                    <span className="font-semibold text-slate-400 block mb-1">Agent Pipeline Breakdown:</span>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                      {Object.entries(agentData.telemetry.agents).map(([agentName, data]: [string, any]) => (
                                        <div key={agentName} className="flex items-center gap-1.5">
                                          <span className="capitalize text-slate-400 font-medium">{agentName}:</span>
                                          <span className="text-slate-300">{data.latency_ms}ms</span>
                                          <span className={`text-[8px] px-1 rounded-sm font-semibold uppercase ${data.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            {data.status}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="mt-3 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px] text-slate-450">
                                <div className="flex items-center gap-1.5 text-emerald-400/90 font-medium">
                                  <span className="text-emerald-400 font-bold">✓</span>
                                  <span>Processed in {((agentData.telemetry.latency_ms || 0) / 1000).toFixed(2)}s</span>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => setShowTelemetry(true)}
                                  className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                                >
                                  View Telemetry
                                </button>
                              </div>
                            )
                          )}
                        </>
                      ) : (
                        msg.content
                      )}
                    </div>
 
                    <span className="text-[9px] text-slate-500 block px-1">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
 
            {chatLoading && (
              <div className="flex gap-3 max-w-[80%] mr-auto animate-fade-in">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white border border-indigo-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Brain size={14} />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex gap-1 items-center mb-1">
                    <span className="text-[9px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.2 rounded-full animate-pulse">
                      EVE COO Executing...
                    </span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800/80 rounded-2xl px-4 py-3 text-xs flex flex-col gap-3 shadow-lg w-full max-w-[340px]">
                    <div className="flex items-center gap-2 text-slate-350 font-semibold text-[11px] border-b border-slate-800 pb-2 mb-0.5">
                      <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                      <span>EVE Analysis Pipeline running...</span>
                    </div>
                    <div className="space-y-2">
                      {/* Step 1: Routing */}
                      <div className="flex items-center gap-2 text-[11px]">
                        {loadingStage > 1 ? (
                          <span className="text-emerald-400 font-bold">✓</span>
                        ) : loadingStage === 1 ? (
                          <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full border border-slate-700" />
                        )}
                        <span className={loadingStage > 1 ? "text-slate-400" : loadingStage === 1 ? "text-indigo-400 font-semibold" : "text-slate-600"}>
                          Intent routing classifier
                        </span>
                      </div>

                      {/* Step 2: Sub-agents */}
                      <div className="flex items-center gap-2 text-[11px]">
                        {loadingStage > 2 ? (
                          <span className="text-emerald-400 font-bold">✓</span>
                        ) : loadingStage === 2 ? (
                          <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full border border-slate-700" />
                        )}
                        <span className={loadingStage > 2 ? "text-slate-400" : loadingStage === 2 ? "text-indigo-400 font-semibold" : "text-slate-600"}>
                          Spawn sub-agent queries
                        </span>
                      </div>

                      {/* Step 3: Synthesis */}
                      <div className="flex items-center gap-2 text-[11px]">
                        {loadingStage === 3 ? (
                          <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full border border-slate-700" />
                        )}
                        <span className={loadingStage === 3 ? "text-indigo-400 font-semibold animate-pulse" : "text-slate-600"}>
                          Synthesize recommendations
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
 
          {/* Quick chip selector & Input Form footer */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3 flex-shrink-0">
            {/* Quick action chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {promptChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendChat(chip)}
                  disabled={chatLoading}
                  className="px-3 py-1 bg-slate-950/80 border border-slate-800 hover:border-slate-700 disabled:opacity-50 text-slate-400 hover:text-slate-200 rounded-full text-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
 
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat(inputMessage);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Query agent network (e.g. 'Should we adjust price for item XYZ?')..."
                disabled={chatLoading}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={chatLoading || !inputMessage.trim()}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-slate-500 text-white rounded-xl transition-all shadow-lg flex items-center justify-center flex-shrink-0 cursor-pointer"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
 
        {/* Draggable Divider 2 */}
        {isDesktop && (
          <div 
            onMouseDown={handleChatMouseDown}
            className="group w-1.5 hover:bg-indigo-600/40 active:bg-indigo-500/80 cursor-col-resize self-stretch transition-all duration-150 z-20 flex-shrink-0 flex items-center justify-center"
            title="Drag to resize panels"
          >
            <div className="w-[2px] h-8 bg-slate-800 group-hover:bg-indigo-400/80 rounded transition-all" />
          </div>
        )}
 
        {/* Right Column - Deep Sub-Agent Reasoning & Confidence metrics */}
        <div 
          className="w-full xl:h-full bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl flex-shrink-0"
          style={isDesktop ? { width: `${100 - leftWidth - chatWidth}%` } : undefined}
        >
          
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center gap-2 flex-shrink-0">
            <Compass className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">Deep Agent Reasoning</h2>
              <p className="text-[10px] text-slate-400">Sub-agent telemetry, margins, & weighted confidence</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedReasoning ? (
              <>
                {/* Confidence Meter */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Network Confidence Level</span>
                  
                  {/* Gauge indicator */}
                  {(() => {
                    const displayConfidence = selectedReasoning.confidence_scores?.Overall ?? selectedReasoning.confidence ?? (selectedReasoning as any).confidence_level ?? 0.80;
                    return (
                      <>
                        <div className="relative w-32 h-16 overflow-hidden flex items-end justify-center mb-2">
                          <div className="absolute inset-0 border-8 border-slate-800 rounded-t-full" />
                          <div 
                            className="absolute inset-0 border-8 border-indigo-500 rounded-t-full origin-bottom transition-transform duration-1000 ease-out" 
                            style={{
                              transform: `rotate(${displayConfidence * 180}deg)`,
                            }}
                          />
                          <div className="absolute inset-2 bg-slate-900 rounded-t-full" />
                          <span className="text-lg font-black text-slate-100 relative z-10 leading-none">
                            {Math.round(displayConfidence * 100)}%
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400 font-medium mb-3">
                          Weighted recommendation probability correctness
                        </span>

                        {selectedReasoning.confidence_scores && Object.keys(selectedReasoning.confidence_scores).length > 0 && (
                          <div className="mt-2 pt-3 border-t border-slate-850 w-full">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-2 text-left">Sub-Agent Scores</span>
                            <div className="grid grid-cols-2 gap-1.5 text-left">
                              {Object.entries(selectedReasoning.confidence_scores).map(([name, score]) => {
                                if (name === "Overall") return null;
                                return (
                                  <div key={name} className="bg-slate-900/50 border border-slate-800/60 rounded-lg p-2 flex flex-col justify-between">
                                    <span className="text-[9px] text-slate-400 font-medium truncate uppercase">
                                      {name.replace(" Agent", "").replace(" Intelligence Agent", "")}
                                    </span>
                                    <span className="text-xs font-bold text-indigo-400 mt-0.5">
                                      {Math.round(Number(score) * 100)}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Explanation text */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle size={14} className="text-indigo-400" /> Explanation & Logic
                  </h3>
                  <div className="p-4 bg-slate-950/30 border border-slate-800/60 rounded-xl text-xs text-slate-300 leading-relaxed font-normal">
                    {selectedReasoning.summary || (selectedReasoning as any).reasoning_summary || (selectedReasoning as any).recommendation}
                  </div>
                </div>

                {/* Findings by Agent */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Database size={14} className="text-indigo-400" /> Telemetry Findings
                  </h3>
                  {selectedReasoning.findings_by_agent && Object.keys(selectedReasoning.findings_by_agent).length > 0 ? (
                    <div className="p-4 bg-slate-950/30 border border-slate-800/60 rounded-xl space-y-3 max-h-56 overflow-y-auto">
                      {Object.entries(selectedReasoning.findings_by_agent).map(([agentName, list]) => (
                        <div key={agentName} className="space-y-1">
                          <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
                            {agentName.replace(" Agent", "").replace(" Intelligence Agent", "")}
                          </span>
                          <ul className="space-y-1">
                            {Array.isArray(list) && list.map((item: string, idx: number) => (
                              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                                <ArrowRight size={12} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : selectedReasoning.findings && selectedReasoning.findings.length > 0 ? (
                    <div className="p-4 bg-slate-950/30 border border-slate-800/60 rounded-xl space-y-1.5 max-h-56 overflow-y-auto">
                      <ul className="space-y-1.5">
                        {selectedReasoning.findings.map((item, idx) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                            <ArrowRight size={12} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (selectedReasoning as any).data_used && Object.keys((selectedReasoning as any).data_used).length > 0 ? (
                    <div className="p-4 bg-slate-950/30 border border-slate-800/60 rounded-xl space-y-2 max-h-48 overflow-y-auto">
                      {Object.entries((selectedReasoning as any).data_used).map(([key, val]: [string, any]) => (
                        <div key={key} className="text-xs flex justify-between border-b border-slate-850 pb-1.5 last:border-0 last:pb-0">
                          <span className="text-slate-400 font-medium lowercase tracking-wide capitalize">{key.replace(/_/g, " ")}</span>
                          <span className="text-indigo-300 font-semibold truncate max-w-[180px]">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-950/30 border border-slate-800/60 rounded-xl text-xs text-slate-500 italic">
                      No telemetry data evaluated.
                    </div>
                  )}
                </div>

                {/* Priorities & Expected Impact or Legacy Weighed Factors */}
                {selectedReasoning.priorities && selectedReasoning.priorities.length > 0 ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Target size={14} className="text-indigo-400" /> Strategic Priorities
                      </h3>
                      <div className="grid grid-cols-1 gap-2.5">
                        {selectedReasoning.priorities.map((pri, idx) => (
                          <div key={idx} className="p-3 bg-indigo-950/20 border border-indigo-500/10 rounded-xl space-y-1">
                            <span className="text-xs font-semibold text-indigo-300 block">
                              Priority {idx + 1}: {pri.title}
                            </span>
                            <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                              {pri.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedReasoning.expected_impact && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                          <TrendingUp size={12} /> Expected Business Impact
                        </h4>
                        <div className="p-3 bg-emerald-950/20 border border-emerald-500/10 rounded-xl text-xs text-slate-300 leading-relaxed font-normal">
                          {selectedReasoning.expected_impact}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {/* Risks weighted */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle size={12} /> Risks Weighed
                      </h4>
                      <ul className="space-y-1.5">
                        {(selectedReasoning as any).risk_factors?.map((fact: string, idx: number) => (
                          <li key={idx} className="p-2.5 bg-rose-500/5 border border-rose-500/10 rounded-xl text-xs text-slate-300 flex items-start gap-2">
                            <ArrowRight size={12} className="text-rose-400 mt-0.5 flex-shrink-0" />
                            <span>{fact}</span>
                          </li>
                        ))}
                        {(!(selectedReasoning as any).risk_factors || (selectedReasoning as any).risk_factors.length === 0) && (
                          <li className="text-xs text-slate-500 italic">No risk adjustments computed.</li>
                        )}
                      </ul>
                    </div>

                    {/* Opportunities weighted */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp size={12} /> Opportunities Weighed
                      </h4>
                      <ul className="space-y-1.5">
                        {(selectedReasoning as any).opportunity_factors?.map((fact: string, idx: number) => (
                          <li key={idx} className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-slate-300 flex items-start gap-2">
                            <ArrowRight size={12} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                            <span>{fact}</span>
                          </li>
                        ))}
                        {(!(selectedReasoning as any).opportunity_factors || (selectedReasoning as any).opportunity_factors.length === 0) && (
                          <li className="text-xs text-slate-500 italic">No pricing/inventory margins computed.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-3">
                <Brain className="w-12 h-12 text-slate-800 animate-pulse-subtle" />
                <h3 className="text-sm font-bold text-slate-400">Deep Reasoning Ready</h3>
                <p className="text-xs text-slate-600 max-w-[240px] leading-relaxed">
                  Submit queries in the EVE console. Sub-agent logic metrics will populate here in real-time.
                </p>
              </div>
            )}
          </div>
        </div>

      {/* Render Daily Brief Modal */}
      <DailyBriefModal 
        isOpen={isDailyBriefOpen} 
        onClose={() => setIsDailyBriefOpen(false)} 
        token={sessionToken} 
        onAskFollowUp={handleFollowUpQuestion} 
      />

      {/* Render long-term memory drawers */}
      <MemoryManagerPanel 
        isOpen={isMemoryOpen} 
        onClose={() => {
          setIsMemoryOpen(false);
          if (sessionToken) {
            hydrateDashboard(sessionToken);
          }
        }} 
        token={sessionToken} 
      />

      {/* Render recommendation history drawer */}
      <RecommendationHistoryPanel 
        isOpen={isRecommendationsOpen} 
        onClose={() => setIsRecommendationsOpen(false)} 
        token={sessionToken} 
      />
    </div>
  );
}
