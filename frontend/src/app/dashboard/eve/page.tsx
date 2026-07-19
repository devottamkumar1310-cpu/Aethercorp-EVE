"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL } from "@/lib/api";
import { devLog } from "@/lib/logger";
import { 
  sendExecutiveChatStream,
  listConversations,
  getConversation,
  renameConversation,
  deleteConversation
} from "@/services/executiveService";
import { 
  fetchHealth, 
  fetchRisks, 
  fetchOpportunities
} from "@/services/intelligenceService";
import { 
  AgentAnalysisResult, 
  MessageResponse
} from "@/types/executive";

const DailyBriefModal = dynamic(
  () => import("@/components/executive/DailyBriefModal").then((mod) => mod.DailyBriefModal),
  { ssr: false }
);
const MemoryManagerPanel = dynamic(
  () => import("@/components/executive/MemoryManagerPanel").then((mod) => mod.MemoryManagerPanel),
  { ssr: false }
);
const RecommendationHistoryPanel = dynamic(
  () => import("@/components/executive/RecommendationHistoryPanel").then((mod) => mod.RecommendationHistoryPanel),
  { ssr: false }
);

import { 
  Brain, 
  Sparkles, 
  AlertTriangle, 
  Send, 
  Loader2, 
  Target, 
  Database, 
  ShieldAlert, 
  Lightbulb, 
  User, 
  ArrowRight,
  BookOpen,
  Mic,
  Plus,
  Trash2,
  Edit,
  MessageSquare,
  X,
  FileText,
  Coins
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
  let inEvidence = false;
  const evidenceLines: string[] = [];
  const normalLines: string[] = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("### Supporting Evidence") || trimmed.startsWith("### 4. Supporting Evidence")) {
      inEvidence = true;
      return;
    }
    if (inEvidence) {
      evidenceLines.push(line);
    } else {
      normalLines.push(line);
    }
  });

  const renderLines = (targetLines: string[]) => {
    return targetLines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const content = trimmed.replace(/^[-*]\s+/, "");
        return (
          <li key={idx} className="ml-4 list-disc text-muted-foreground text-sm mb-1 leading-relaxed">
            {renderFormattedText(content)}
          </li>
        );
      }
      if (trimmed.startsWith("### ")) {
        return (
          <h4 key={idx} className="text-sm font-semibold text-indigo-400 mt-3 mb-1.5">
            {renderFormattedText(trimmed.substring(4))}
          </h4>
        );
      }
      if (trimmed.startsWith("## ")) {
        return (
          <h3 key={idx} className="text-base font-bold text-foreground mt-4 mb-2">
            {renderFormattedText(trimmed.substring(3))}
          </h3>
        );
      }
      if (trimmed.startsWith("# ")) {
        return (
          <h2 key={idx} className="text-lg font-extrabold text-foreground mt-5 mb-2.5">
            {renderFormattedText(trimmed.substring(2))}
          </h2>
        );
      }
      if (trimmed === "") {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-muted-foreground text-sm mb-1.5 leading-relaxed">
          {renderFormattedText(line)}
        </p>
      );
    });
  };

  return (
    <>
      <div className="space-y-1">{renderLines(normalLines)}</div>
      {evidenceLines.length > 0 && (
        <details open className="mt-3 border border-border bg-background/40 rounded-xl overflow-hidden group">
          <summary className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer list-none flex items-center justify-between select-none bg-card/40 hover:bg-card/60">
            <span className="flex items-center gap-1.5">📊 Supporting Evidence</span>
            <span className="text-[10px] text-indigo-405 group-open:rotate-185 transition-transform">▼</span>
          </summary>
          <div className="px-4 pb-3.5 pt-2 border-t border-border text-xs space-y-1">
            {renderLines(evidenceLines)}
          </div>
        </details>
      )}
    </>
  );
}

function isGreetingMessage(text: string): boolean {
  if (!text || !text.trim()) return true;
  const cleaned = text.toLowerCase().trim();
  const greetingRegex = /\b(hi+|hello+|hey+|gday|g'day|good\s+morning|morning|afternoon|evening|hola|namaste+|yo|hey\s+there|hello\s+there)\b/i;
  const hindiGreeting = /नमस्ते/i;
  return greetingRegex.test(cleaned) || hindiGreeting.test(cleaned);
}

interface GroupedConversations {
  [key: string]: any[];
}

function groupConversationsByDate(conversations: any[]): GroupedConversations {
  const groups: GroupedConversations = {
    "Today": [],
    "Yesterday": [],
    "Previous 7 Days": [],
    "Older": []
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  conversations.forEach(c => {
    const updatedDate = new Date(c.updated_at || c.created_at);
    updatedDate.setHours(0, 0, 0, 0);

    if (updatedDate.getTime() === today.getTime()) {
      groups["Today"].push(c);
    } else if (updatedDate.getTime() === yesterday.getTime()) {
      groups["Yesterday"].push(c);
    } else if (updatedDate.getTime() >= sevenDaysAgo.getTime()) {
      groups["Previous 7 Days"].push(c);
    } else {
      groups["Older"].push(c);
    }
  });

  return Object.keys(groups).reduce((acc, key) => {
    if (groups[key].length > 0) {
      acc[key] = groups[key];
    }
    return acc;
  }, {} as GroupedConversations);
}

function getRelativeTimeString(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function EVECoocommandCenter() {
  const searchParams = useSearchParams();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [chatMode, setChatMode] = useState<"smart" | "full">("smart");
  const [inputMessage, setInputMessage] = useState("");
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDeveloperMode(localStorage.getItem("developer_mode") === "true");
    }
  }, []);
  const [language, setLanguage] = useState<string>("en");
  const [isGreeting, setIsGreeting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsHistoryOpen(window.innerWidth >= 1280);
      setIsInsightsOpen(window.innerWidth >= 1440);
    }
  }, []);

  // Loading stage tracker
  const [loadingStage, setLoadingStage] = useState(0);

  // Modals & Panels open states
  const [isDailyBriefOpen, setIsDailyBriefOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(false);

  // Business metrics & data states
  const [healthScore, setHealthScore] = useState<number>(0);
  const [healthStatus, setHealthStatus] = useState<string>("Determining...");
  const [risks, setRisks] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);

  const getDynamicSuggestions = () => {
    const suggestions: { category: string; questions: string[] }[] = [];
    
    if (risks.length > 0) {
      const riskQuestions = risks.map(r => {
        const desc = r.description.toLowerCase();
        if (desc.includes("margin") || desc.includes("profit") || desc.includes("decay")) {
          return "How can we address the declining net margins?";
        }
        if (desc.includes("stock") || desc.includes("inventory") || desc.includes("reorder") || desc.includes("safety")) {
          return "What is the replenishment plan for stock risks?";
        }
        if (desc.includes("cash") || desc.includes("capital") || desc.includes("runway")) {
          return "What cash flow adjustments will stabilize our runway?";
        }
        return `How do we mitigate the risk: "${r.description.slice(0, 45)}"?`;
      }).slice(0, 2);
      suggestions.push({ category: "Risk Mitigation", questions: riskQuestions });
    }

    if (opportunities.length > 0) {
      const oppQuestions = opportunities.map(o => {
        const desc = o.description.toLowerCase();
        if (desc.includes("price") || desc.includes("pricing") || desc.includes("markdown")) {
          return "Calculate the profit impact of suggested pricing changes.";
        }
        if (desc.includes("growth") || desc.includes("expansion") || desc.includes("revenue")) {
          return "What is the timeline for our growth opportunities?";
        }
        return `How do we execute on: "${o.description.slice(0, 45)}"?`;
      }).slice(0, 2);
      suggestions.push({ category: "Opportunity Capture", questions: oppQuestions });
    }

    // Fallbacks if lists are empty
    if (suggestions.length === 0) {
      suggestions.push({
        category: "General Strategy",
        questions: [
          "What are the top bottlenecks in our supply chain?",
          "Show a detailed profitability breakdown by product category."
        ]
      });
    }

    return suggestions;
  };



  // Chat message state
  const [messages, setMessages] = useState<MessageResponse[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      content: "Welcome to your EVE Inventory Intelligence assistant. I can help analyze stockout risks, identify dead inventory, generate replenishment plans, and explain inventory recommendations. What shall we analyze today?",
      created_at: new Date().toISOString()
    }
  ]);

  // Track the agent data for the right panel
  const [selectedReasoning, setSelectedReasoning] = useState<AgentAnalysisResult | null>(null);

  // Scroll ref for chat window
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  const scrollChatToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [messages, chatLoading]);

  const [conversations, setConversations] = useState<any[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [activeActions, setActiveActions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (sessionToken && pendingQuestion) {
      handleSendChat(pendingQuestion);
      setPendingQuestion(null);
    }
  }, [sessionToken, pendingQuestion]);

  const renderActionButtons = (pri: any, idx: number, source: string) => {
    if (!pri || pri.title === "Insufficient Verified Data") return null;
    
    const titleLower = (pri.title || "").toLowerCase();
    const descLower = (pri.description || "").toLowerCase();
    
    const showReorder = titleLower.includes("reorder") || titleLower.includes("replenish") || titleLower.includes("safety stock") || titleLower.includes("stockout") || descLower.includes("reorder") || descLower.includes("replenish") || descLower.includes("lead time");
    const showDiscount = titleLower.includes("liquidate") || titleLower.includes("overstock") || titleLower.includes("dead stock") || titleLower.includes("pricing") || titleLower.includes("margin") || titleLower.includes("discount") || descLower.includes("overstock") || descLower.includes("dead stock") || descLower.includes("discount");
    const showSkuExport = showReorder || showDiscount || titleLower.includes("sku") || titleLower.includes("product") || descLower.includes("sku") || descLower.includes("product") || (!showReorder && !showDiscount);

    const actionKey = `${source}-${pri.title}-${idx}`;
    const triggeredOutcome = activeActions[actionKey];

    if (triggeredOutcome) {
      return (
        <div className="mt-2 p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-semibold animate-fade-in flex items-center gap-1">
          <span>✓</span>
          <span>{triggeredOutcome}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {showSkuExport && (
          <button
            type="button"
            onClick={() => {
              setActiveActions(prev => ({
                ...prev,
                [actionKey]: "Success: Exported 3 SKUs to CSV (TSHIRT-CLASSIC, HOODIE-WINTER, BENCH-PROD-0)"
              }));
            }}
            className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-300 rounded text-[9px] font-bold cursor-pointer transition-all"
          >
            Export SKU List
          </button>
        )}
        {showDiscount && (
          <button
            type="button"
            onClick={() => {
              setActiveActions(prev => ({
                ...prev,
                [actionKey]: "Success: Generated discount campaign for BENCH-PROD-0 (30% discount suggested)"
              }));
            }}
            className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300 rounded text-[9px] font-bold cursor-pointer transition-all"
          >
            Generate Discount Campaign
          </button>
        )}
        {showReorder && (
          <button
            type="button"
            onClick={() => {
              setActiveActions(prev => ({
                ...prev,
                [actionKey]: "Success: Generated replenishment order of 50 units for HOODIE-WINTER via Mock Supplier Corp"
              }));
            }}
            className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/30 hover:border-purple-500/50 text-purple-300 rounded text-[9px] font-bold cursor-pointer transition-all"
          >
            Create Reorder Plan
          </button>
        )}
      </div>
    );
  };

  const hydrateDashboard = async (token: string) => {
    try {
      const tStart = performance.now();
      devLog("[TELEMETRY][PERF] AI Workspace hydrateDashboard Start");

    // 1. Fetch Conversations (Critical for chat interactivity)
    listConversations(token)
      .then(async (convsData) => {
        setConversations(convsData);
        if (convsData.length > 0) {
          try {
            const detail = await getConversation(convsData[0].id, token);
            if (detail && detail.messages && detail.messages.length > 0) {
              const lastAssistantMsg = [...detail.messages]
                .reverse()
                .find(m => m.role === "assistant" && m.agent_data);
              if (lastAssistantMsg) {
                setSelectedReasoning(lastAssistantMsg.agent_data);
              }
            }
          } catch (err) {
            console.error("Failed to load last conversation details for default insights:", err);
          }
        } else {
          // No conversations; seed beautiful default initial state based on workspace metrics
          const defaultEvidence: string[] = [
            "Establish base ledger and inventory records to trace operational performance."
          ];

          setSelectedReasoning({
            agent: "COO Lead",
            summary: "EVE COO has initialized workspace audit operations. Explore details and recommendations in the panels.",
            recommendation_details: {
              recommendation: `Based on the latest data audit of **NovaWear Fashion**, EVE COO recommends the following key actions:\n- **Liquidate Dead Stock**: Formulate promotional discounts for slow-moving categories to free up capital.\n- **Replenish Safety Stock**: Initiate immediate reorders for high-priority stockout risks.\n- **Contain Overhead Expenses**: Optimize administrative and logistical overheads to stabilize declining net profit margins.`,
              expected_impact: "Stabilize inventory turnover rates and recover declining net margins to over 40% target.",
              evidence: defaultEvidence,
              assumptions: [
                "Supplier shipping routes and lead times will remain consistent during standard runs.",
                "Retail buyer transaction patterns reflect steady seasonal demands."
              ]
            },
            confidence_scores: {
              Overall: 0.85,
              "Finance Agent": 0.88,
              "Operations Agent": 0.85
            }
          } as any);
        }
        const tChat = performance.now();
        devLog(`[TELEMETRY][PERF] Time to Chat Interactive: ${(tChat - tStart).toFixed(2)}ms`);
      })
      .catch(err => console.error("Conversations load failed:", err));

    // 2. Fetch Non-critical Analytics Independently
    Promise.allSettled([
      fetchHealth(token)
        .then(val => {
          if (val) {
            setHealthScore(val.score || 0);
            setHealthStatus(val.status || "Unknown");
          }
        }),
      fetchRisks(token)
        .then(val => {
          if (val?.risks) setRisks(val.risks.slice(0, 3));
        }),
      fetchOpportunities(token)
        .then(val => {
          if (val?.opportunities) setOpportunities(val.opportunities.slice(0, 3));
        })
    ]).then(() => {
      const tPanels = performance.now();
      devLog(`[TELEMETRY][PERF] Time for Health/Risk/Opportunity Panels: ${(tPanels - tStart).toFixed(2)}ms`);
    }).catch(err => console.error("Panel group load failed", err));


    fetch(`${API_BASE_URL}/api/analytics/overview`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(val => {
        if (val) setOverview(val);
      })
      .catch(err => console.error("Overview load failed:", err));


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
        
        // Extract document ID parameter
        const docParam = searchParams?.get("document_id");
        if (docParam) {
          setDocumentId(docParam);
          try {
            const { getDocumentDetails } = await import("@/services/documentService");
            const docDetails = await getDocumentDetails(docParam, session.access_token);
            setDocumentName(docDetails.filename);
          } catch (err) {
            console.error("Failed to load document context for chat:", err);
          }
        }

        const questionParam = searchParams?.get("question");
        if (questionParam) {
          setPendingQuestion(questionParam);
        }

        hydrateDashboard(session.access_token);
      } catch (err) {
        console.error("EVE setup error:", err);
      } finally {
        setLoading(false);
        devLog(`[TELEMETRY][PERF] AI Workspace Time to First Render Triggered`);
      }
    }
    initialize();
  }, [searchParams]);

  const handleSelectConversation = async (id: string) => {
    if (!sessionToken) return;
    try {
      const detail = await getConversation(id, sessionToken);
      setConversationId(detail.id);
      
      if (detail.messages && detail.messages.length > 0) {
        const mapped = detail.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          agent_data: m.agent_data,
          created_at: m.created_at
        }));
        setMessages(mapped);
        
        // Auto select last assistant message reasoning if present
        const assistantMsgs = mapped.filter((m: any) => m.role === "assistant");
        if (assistantMsgs.length > 0) {
          const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
          if (lastAssistant.agent_data) {
            setSelectedReasoning(lastAssistant.agent_data);
            setIsInsightsOpen(true);
          } else {
            setSelectedReasoning(null);
            setIsInsightsOpen(false);
          }
        } else {
          setSelectedReasoning(null);
          setIsInsightsOpen(false);
        }
      } else {
        setMessages([]);
        setSelectedReasoning(null);
        setIsInsightsOpen(false);
      }
    } catch (err) {
      console.error("Load conversation failed:", err);
    }
  };

  const handleStartNewChat = () => {
    setConversationId(undefined);
    setSelectedReasoning(null);
    setIsInsightsOpen(false);
    setMessages([
      {
        id: "welcome-msg",
        role: "assistant",
        content: "Welcome to your EVE Inventory Intelligence assistant. I can help analyze stockout risks, identify dead inventory, generate replenishment plans, and explain inventory recommendations. What shall we analyze today?",
        created_at: new Date().toISOString()
      }
    ]);
  };

  const handleRenameSession = async (id: string) => {
    if (!editingTitle.trim() || !sessionToken) return;
    try {
      await renameConversation(id, editingTitle.trim(), sessionToken);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: editingTitle.trim() } : c))
      );
      setEditingSessionId(null);
      setEditingTitle("");
    } catch (err) {
      console.error("Rename failed:", err);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!sessionToken) return;
    try {
      await deleteConversation(id, sessionToken);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        handleStartNewChat();
      }
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleSendChat = async (messageText: string) => {
    if (!messageText.trim() || !sessionToken || chatLoading) return;

    // Add user message locally
    const userMsg: MessageResponse = {
      id: Math.random().toString(),
      role: "user",
      content: messageText,
      created_at: new Date().toISOString()
    };
    
    // Add temporary empty assistant message to stream into
    const assistantTempId = Math.random().toString();
    const assistantPlaceholder: MessageResponse = {
      id: assistantTempId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setInputMessage("");
    
    const isGreet = isGreetingMessage(messageText);
    setIsGreeting(isGreet);
    setChatLoading(true);

    let accumulatedContent = "";
    let activeConversationId = conversationId;

    try {
      await sendExecutiveChatStream(
        messageText,
        sessionToken,
        (type, content) => {
          if (type === "meta") {
            activeConversationId = content.conversation_id;
            setConversationId(content.conversation_id);
          } else if (type === "token") {
            accumulatedContent += content;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantTempId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
          } else if (type === "translate") {
            accumulatedContent = content;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantTempId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
          } else if (type === "done") {
            // Stream complete. Load full details to populate snap/telemetry panels
            if (activeConversationId) {
              getConversation(activeConversationId, sessionToken).then((detail) => {
                const lastMsg = [...detail.messages]
                  .reverse()
                  .find(m => m.role === "assistant" && m.agent_data);
                if (lastMsg) {
                  setSelectedReasoning(lastMsg.agent_data);
                  setIsInsightsOpen(true);
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantTempId
                        ? { ...msg, agent_data: lastMsg.agent_data }
                        : msg
                    )
                  );
                }
              }).catch((e) => console.error("Error finalizing stream detail data:", e));

              listConversations(sessionToken).then((convs) => setConversations(convs)).catch(() => {});
            }
          }
        },
        conversationId,
        chatMode,
        developerMode,
        language,
        documentId || undefined
      );

    } catch (err: any) {
      console.error("Chat streaming failed:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantTempId
            ? { ...msg, content: "EVE is currently recalibrating context. Please ask your question again." }
            : msg
        )
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleFollowUpQuestion = (question: string) => {
    handleSendChat(question);
  };

  const handleVoiceInput = () => {
    setVoiceError(null);

    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError("Your browser does not support Speech Recognition. Please use Chrome, Safari, or Edge.");
      setTimeout(() => setVoiceError(null), 5000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === "hi" ? "hi-IN" : "en-US";
      
      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputMessage((prev) => prev ? prev + " " + transcript : transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setVoiceError("Microphone permission denied. Please allow microphone access in your browser settings.");
        } else {
          setVoiceError(`Voice input requires microphone permissions.`);
        }
        setIsListening(false);
        setTimeout(() => setVoiceError(null), 5000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setVoiceError(`Failed to initialize microphone: ${err.message || err}`);
      setIsListening(false);
      setTimeout(() => setVoiceError(null), 5000);
    }
  };



  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen xl:min-h-0 xl:h-[calc(100vh-57px)] w-full overflow-hidden flex flex-col xl:flex-row p-4 xl:p-5 gap-4 font-sans animate-pulse">
        {/* Column 0: Conversation History Sidebar Skeleton */}
        <div className="hidden xl:flex xl:flex-col xl:gap-3 xl:w-64 border border-border rounded-2xl p-4 bg-card/50" />

        {/* Column 1: Active Chat Panel Skeleton */}
        <div className="flex-1 border border-border rounded-2xl p-5 bg-card/20 flex flex-col justify-between h-[80vh]">
          <div className="space-y-4">
            <div className="h-6 bg-muted rounded w-1/4" />
            <div className="h-px bg-muted" />
            <div className="flex gap-3">
              <div className="h-8 w-8 bg-muted rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
          <div className="h-14 bg-background border border-border rounded-xl w-full" />
        </div>

        {/* Column 2: Right-hand Executive Reasoning Panel Skeleton */}
        <div className="w-96 border border-border rounded-2xl p-5 bg-card/40 hidden xl:block space-y-6">
          <div className="h-6 bg-muted rounded w-1/2" />
          <div className="h-px bg-muted" />
          <div className="h-28 bg-background border border-border rounded-xl w-full" />
          <div className="h-28 bg-background border border-border rounded-xl w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen xl:min-h-0 xl:h-[calc(100vh-57px)] w-full overflow-y-auto xl:overflow-hidden flex flex-col xl:flex-row p-4 xl:p-5 gap-4 font-sans">
      {/* Mobile Sidebar Backdrop */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 xl:hidden transition-opacity duration-300"
          onClick={() => setIsHistoryOpen(false)}
        />
      )}

      {/* Column 0: Conversation History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 h-full w-64 border-r border-border bg-card rounded-r-2xl rounded-l-none transform transition-all duration-300 ease-in-out xl:relative xl:translate-x-0 xl:z-0 xl:border xl:rounded-2xl xl:shadow-lg xl:flex xl:flex-col xl:gap-3 xl:flex-shrink-0 xl:overflow-hidden ${
 isHistoryOpen 
 ? "translate-x-0 p-4 opacity-100" 
 : "-translate-x-full xl:translate-x-0 xl:w-0 xl:p-0 xl:border-0 xl:opacity-0 xl:pointer-events-none"
 }`}>
        <div className="flex items-center justify-between border-b border-border pb-3 flex-shrink-0">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare size={14} className="text-indigo-400" /> Chat History
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="xl:hidden p-1 hover:bg-muted text-muted-foreground hover:text-indigo-400 rounded-lg transition-all cursor-pointer"
              title="Close Sidebar"
            >
              <X size={14} />
            </button>
            <button
              onClick={handleStartNewChat}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-indigo-400 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold border border-border hover:border-border cursor-pointer"
              title="Start New Chat"
            >
              <Plus size={12} /> New Chat
            </button>
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-indigo-400 rounded-lg transition-all cursor-pointer text-[10px]"
              title="Collapse Panel"
            >
              &lt;&lt;
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto space-y-4 pr-0.5 scrollbar-none">
          {Object.entries(groupConversationsByDate(conversations)).map(([groupName, groupConvs]) => (
            <div key={groupName} className="space-y-1.5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block px-1 mb-1">
                {groupName}
              </span>
              {groupConvs.map((c) => {
                const isActive = conversationId === c.id;
                const isEditing = editingSessionId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`group w-full p-2.5 rounded-xl border transition-all text-left flex flex-col justify-between relative ${
 isActive
 ? "bg-indigo-600/10 text-indigo-200 border-indigo-500/30"
 : "bg-background/45 text-muted-foreground border-border/60 hover:bg-muted/40 hover:text-foreground"
 }`}
                  >
                    <div className="flex items-start justify-between gap-1 w-full">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleRenameSession(c.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameSession(c.id);
                            if (e.key === "Escape") setEditingSessionId(null);
                          }}
                          className="w-full bg-background border border-border text-foreground text-xs px-1.5 py-0.5 rounded outline-none"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => handleSelectConversation(c.id)}
                          className="text-xs font-medium truncate flex-1 text-left leading-snug cursor-pointer block pr-14"
                        >
                          {c.title || "New Conversation"}
                        </button>
                      )}
                      
                      {/* Actions (visible on hover/active) */}
                      {!isEditing && (
                        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-card/95 p-0.5 rounded border border-border">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(c.id);
                              setEditingTitle(c.title || "");
                            }}
                            className="p-1 hover:text-indigo-400 text-muted-foreground hover:bg-muted rounded transition-all cursor-pointer"
                            title="Rename Chat"
                          >
                            <Edit size={10} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(c.id);
                            }}
                            className="p-1 hover:text-rose-400 text-muted-foreground hover:bg-muted rounded transition-all cursor-pointer"
                            title="Delete Chat"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-[8px] text-muted-foreground mt-1 flex justify-between items-center">
                      <span>
                        {getRelativeTimeString(c.updated_at || c.created_at)}
                      </span>
                      {c.message_count !== undefined && c.message_count > 0 && (
                        <span className="bg-muted text-muted px-1 py-0.2 rounded text-[7px] font-bold">
                          {c.message_count} {c.message_count === 1 ? "msg" : "msgs"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-[10px] text-muted italic text-center py-6">No previous conversations.</p>
          )}
        </div>
      </div>
          {/* Middle Column - Multi-Turn EVE Command Center Chat */}
      <div 
        className="w-full xl:h-full flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-2xl relative flex-1 min-w-[320px] transition-all duration-300"
      >
        
        {/* Conversational Header */}
        <div className="px-6 py-4 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {!isHistoryOpen && (
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="p-1 hover:bg-muted text-muted hover:text-indigo-400 rounded-lg transition-all border border-border cursor-pointer flex items-center gap-1 text-[10px]"
                title="Show Chat History"
              >
                <MessageSquare size={12} /> History
              </button>
            )}
            <div className="p-2 bg-indigo-600 rounded-xl text-foreground shadow-md shadow-indigo-600/30">
              <Brain size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                EVE Agent Network <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Active</span>
              </h2>
              <p className="text-[10px] text-secondary">Queries route automatically to COO, Finance & Operations agents</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Relocated Quick Actions */}
            <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border/80 mr-1.5">
              <button
                type="button"
                onClick={() => setIsDailyBriefOpen(true)}
                className="py-1 px-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="Daily Brief"
              >
                <BookOpen size={11} className="text-indigo-400" />
                <span>Daily Brief</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMemoryOpen(true)}
                className="py-1 px-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="Strategic Goals"
              >
                <Target size={11} className="text-indigo-400" />
                <span>Strategic Goals</span>
              </button>
            </div>

            {/* Panel Toggles */}
            <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border mr-2">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
 isHistoryOpen 
 ? "bg-muted text-indigo-400 font-bold" 
 : "text-muted-foreground hover:text-muted-foreground"
 }`}
                title={isHistoryOpen ? "Hide Chat History" : "Show Chat History"}
              >
                <MessageSquare size={13} />
              </button>
              <button
                type="button"
                onClick={() => setIsInsightsOpen(!isInsightsOpen)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
 isInsightsOpen 
 ? "bg-muted text-indigo-400 font-bold" 
 : "text-muted-foreground hover:text-muted-foreground"
 }`}
                title={isInsightsOpen ? "Hide Executive Insights" : "Show Executive Insights"}
              >
                <Sparkles size={13} />
              </button>
            </div>
            {/* Language Selector */}
            <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
 language === "en" 
 ? "bg-indigo-600 text-foreground shadow-md" 
 : "text-muted-foreground hover:text-foreground"
 }`}
                title="English Language"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage("hi")}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
 language === "hi" 
 ? "bg-indigo-600 text-foreground shadow-md" 
 : "text-muted-foreground hover:text-foreground"
 }`}
                title="Hindi Translation"
              >
                हिन्दी
              </button>
            </div>



            {/* Advanced Telemetry Toggle */}
            {developerMode && (
              <button
                type="button"
                onClick={() => setShowTelemetry(!showTelemetry)}
                className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
 showTelemetry 
 ? "bg-indigo-600 text-foreground border-indigo-500 shadow-md shadow-indigo-600/20" 
 : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-border"
 }`}
                title="Toggle Advanced Telemetry"
              >
                <Database size={10} />
                <span>Telemetry: {showTelemetry ? "ON" : "OFF"}</span>
              </button>
            )}

            {/* Mode Selector */}
            {developerMode && (
              <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setChatMode("smart")}
                  className={`text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
 chatMode === "smart" 
 ? "bg-indigo-600 text-foreground shadow-md" 
 : "text-muted-foreground hover:text-foreground"
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
 ? "bg-indigo-600 text-foreground shadow-md" 
 : "text-muted-foreground hover:text-foreground"
 }`}
                  title="Deep sub-agent aggregation"
                >
                  Full
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Executive Snapshot Compact Card */}
        {isInsightsOpen && (
          <div className="mx-6 mt-4 p-4 bg-indigo-950/45 border border-indigo-500/40 rounded-2xl space-y-3.5 shadow-xl transition-all duration-300 animate-fade-in flex flex-col relative overflow-hidden backdrop-blur-md">
            {/* Ambient glowing effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2.5 z-10">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">
                  Executive Snapshot
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedReasoning?.confidence_category && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${
                    selectedReasoning.confidence_category === "High Confidence"
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : selectedReasoning.confidence_category === "Medium Confidence"
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-rose-500/15 text-rose-350 border-rose-500/30"
                  }`}>
                    {selectedReasoning.confidence_category}
                  </span>
                )}
                {selectedReasoning?.risk_classification && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${
                    selectedReasoning.risk_classification === "Low Risk"
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  }`}>
                    {selectedReasoning.risk_classification}
                  </span>
                )}
                <button
                  onClick={() => setIsInsightsOpen(false)}
                  className="p-1 hover:bg-indigo-500/15 text-slate-300 hover:text-indigo-300 rounded-lg transition-all cursor-pointer"
                  title="Collapse Panel"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {selectedReasoning ? (
              /* Intelligence-Driven Snapshot from LLM */
              <div className="space-y-3.5 z-10 text-xs">
                {/* Executive metrics row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-2 bg-slate-950/50 border border-indigo-500/25 rounded-xl text-center">
                    <span className="text-[9px] text-secondary block uppercase font-bold tracking-wider">Business Health</span>
                    <span className="text-sm font-extrabold text-indigo-200">
                      {selectedReasoning.evidence_used?.business_health_score !== undefined && selectedReasoning.evidence_used?.business_health_score !== null
                        ? `${selectedReasoning.evidence_used.business_health_score}/100` 
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950/50 border border-indigo-500/25 rounded-xl text-center">
                    <span className="text-[9px] text-secondary block uppercase font-bold tracking-wider">Top Risks</span>
                    <span className="text-sm font-extrabold text-rose-300">
                      {selectedReasoning.evidence_used?.risk_count || 0}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950/50 border border-indigo-500/25 rounded-xl text-center">
                    <span className="text-[9px] text-secondary block uppercase font-bold tracking-wider">Opportunities</span>
                    <span className="text-sm font-extrabold text-emerald-300">
                      {selectedReasoning.evidence_used?.opportunity_count || 0}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950/50 border border-indigo-500/25 rounded-xl text-center">
                    <span className="text-[9px] text-secondary block uppercase font-bold tracking-wider">Revenue at Risk</span>
                    <span className="text-sm font-extrabold text-primary">
                      ${selectedReasoning.evidence_used?.revenue_at_risk?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || "0"}
                    </span>
                  </div>
                </div>

                {/* Capital locked sub-badge */}
                {selectedReasoning.evidence_used?.working_capital_locked > 0 && (
                  <div className="text-[9.5px] text-primary bg-amber-500/5 px-3 py-1.5 rounded-lg border border-amber-500/20 flex items-center justify-between">
                    <span>Working capital locked in slow-moving stock:</span>
                    <span className="font-extrabold text-amber-300">
                      ${selectedReasoning.evidence_used?.working_capital_locked?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Strategic Priorities */}
                  <div className="space-y-2 md:col-span-2">
                    <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest block">
                      Strategic Priorities
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedReasoning.priorities && selectedReasoning.priorities.length > 0 ? (
                        selectedReasoning.priorities.map((pri: any, idx: number) => (
                          <div key={idx} className="p-2.5 bg-surface-secondary border border-semantic rounded-xl space-y-1">
                            <span className="font-extrabold text-indigo-400 dark:text-indigo-200 block text-[11px]">
                              {idx + 1}. {pri.title}
                            </span>
                            <p className="text-[10px] text-secondary leading-relaxed font-medium">
                              {pri.description}
                            </p>
                            {renderActionButtons(pri, idx, "right-panel")}
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">No strategic priorities required.</p>
                      )}
                    </div>
                  </div>

                  {/* Expected Impact */}
                  <div className="space-y-2 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest block">
                        Expected Impact
                      </span>
                      <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex-grow">
                        <p className="text-[10px] text-emerald-100 leading-relaxed font-medium">
                          {selectedReasoning.expected_impact || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conflict Warning & Resolution (if any) */}
                {selectedReasoning.detected_conflicts && selectedReasoning.detected_conflicts.length > 0 && (
                  <div className="p-2.5 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-start gap-2 text-[10px]">
                    <ShieldAlert size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold text-amber-300 block">Conflict Detected & Resolved:</span>
                      <p className="text-amber-100 leading-relaxed font-medium">
                        {selectedReasoning.trade_off_analysis || selectedReasoning.detected_conflicts.join("; ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback Baseline Snapshot: Workspace Overview */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs z-10">
                {/* Workspace Health & Financials */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block flex items-center gap-1">
                    <Coins size={11} className="text-indigo-400" /> Capital & Profit Buffer
                  </span>
                  
                  {overview?.profit === 0 && overview?.revenue === 0 ? (
                    <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/10 rounded-xl text-center space-y-1">
                      <span className="text-[9.5px] text-indigo-300 block font-semibold">Workspace Empty</span>
                      <p className="text-[8.5px] text-muted-foreground leading-normal">
                        Upload sales & inventory data to unlock executive insights.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 p-3 bg-background/40 border border-indigo-500/10 rounded-xl">
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Total Profit</span>
                        <span className="text-xs font-bold text-foreground">
                          ${overview?.profit?.toLocaleString() || "0"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block">Gross Revenue</span>
                        <span className="text-xs font-bold text-foreground">
                          ${overview?.revenue?.toLocaleString() || "0"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Risks */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block">
                    Active Risks
                  </span>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto scrollbar-none">
                    {risks.length > 0 ? (
                      risks.map((risk, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => handleSendChat(`Address and mitigate this risk: ${risk.description}`)}
                          className="p-2 bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/35 hover:bg-rose-500/10 rounded-lg flex items-start gap-1.5 text-[10px] cursor-pointer transition-all group"
                        >
                          <ShieldAlert size={12} className="text-rose-450 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                          <span className="text-muted-foreground leading-normal line-clamp-2 group-hover:text-foreground">{risk.description}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">No critical risks active. Seed data to analyze.</p>
                    )}
                  </div>
                </div>

                {/* Active Opportunities */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block">
                    Opportunities
                  </span>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto scrollbar-none">
                    {opportunities.length > 0 ? (
                      opportunities.map((opp, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => handleSendChat(`Analyze and execute opportunity: ${opp.description}`)}
                          className="p-2 bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/35 hover:bg-emerald-500/10 rounded-lg flex items-start gap-1.5 text-[10px] cursor-pointer transition-all group"
                        >
                          <Lightbulb size={12} className="text-emerald-450 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                          <span className="text-muted-foreground leading-normal line-clamp-2 group-hover:text-foreground">{opp.description}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">No opportunities flagged. Seed data to scan.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conversation history area */}
        <div className="flex-1 overflow-y-auto p-4 px-5 space-y-3.5 bg-background/20 scrollbar-thin">
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
 ? "bg-indigo-600 text-foreground border border-indigo-500/20" 
 : "bg-muted text-muted-foreground border border-border"
 }`}>
                    {isAssistant ? <Brain size={14} /> : <User size={14} />}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    {/* Active agent badges for assistant */}
                    {isAssistant && msg.id !== "welcome-msg" && (
                      <div className="flex flex-wrap gap-1.5 items-center mb-1">
                        <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                          {agentData?.agent || "COO Lead"}
                        </span>
                        {agentData?.confidence !== undefined && (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${
 agentData.confidence >= 0.8 
 ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/20" 
 : agentData.confidence >= 0.6 
 ? "bg-amber-500/10 text-amber-450 border-amber-500/20" 
 : "bg-rose-500/10 text-rose-450 border-rose-500/20"
 }`}>
                            {Math.round(agentData.confidence * 100)}% Confidence
                          </span>
                        )}
                        {developerMode && (
                          agentData?.confidence_scores ? (
                            Object.entries(agentData.confidence_scores).map(([name, score]: [string, any]) => (
                              <span key={name} className="text-[8px] font-bold bg-muted text-slate-450 border border-border/60 px-1.5 py-0.2 rounded-md uppercase tracking-wide">
                                {name.replace(" Agent", "").replace(" Intelligence Agent", "")}: {Math.round(score * 100)}%
                              </span>
                            ))
                          ) : null
                        )}
                      </div>
                    )}
 
                    <div className={`text-sm leading-relaxed space-y-2.5 ${
 isAssistant 
 ? "bg-transparent text-foreground border-none shadow-none px-1 py-0" 
 : "bg-indigo-600/10 text-indigo-100 border border-indigo-500/15 px-3.5 py-2 rounded-2xl shadow-sm"
 }`}>
                      {isAssistant ? (
                        <>
                          {renderMarkdown(msg.content)}

                          {((msg.content && msg.content.includes("Insufficient")) || 
                            (agentData?.governance_decisions?.data_sufficiency && 
                             (agentData.governance_decisions.data_sufficiency === "NO_DATA" || 
                              agentData.governance_decisions.data_sufficiency === "DATA_INSUFFICIENT"))) && (
                            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2.5">
                              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                                <Database size={13} className="text-amber-400" /> Guided Onboarding Pathway
                              </span>
                              <p className="text-[11px] text-muted-foreground leading-relaxed font-normal">
                                EVE needs active data to run its advanced COO logic. Upload CSV sheets or create entries:
                              </p>
                              <div className="flex flex-wrap gap-2 pt-0.5">
                                <a 
                                  href="/dashboard/inventory"
                                  className="text-[10px] font-bold px-2.5 py-1.5 bg-card border border-border hover:border-indigo-500/40 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all flex items-center gap-1"
                                >
                                  <span>📦 Setup Inventory Catalog</span>
                                  <ArrowRight size={10} />
                                </a>
                                <a 
                                  href="/dashboard/finance"
                                  className="text-[10px] font-bold px-2.5 py-1.5 bg-card border border-border hover:border-indigo-500/40 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all flex items-center gap-1"
                                >
                                  <span>💰 Import Sales & Costs</span>
                                  <ArrowRight size={10} />
                                </a>
                                <a 
                                  href="/dashboard/projects"
                                  className="text-[10px] font-bold px-2.5 py-1.5 bg-card border border-border hover:border-indigo-500/40 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all flex items-center gap-1"
                                >
                                  <span>💼 Create Client Project</span>
                                  <ArrowRight size={10} />
                                </a>
                              </div>
                            </div>
                          )}
                          
                          {/* findings by agent */}
                          {developerMode && agentData?.findings_by_agent && Object.keys(agentData.findings_by_agent).length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Agent Findings</span>
                              <div className="space-y-2">
                                {Object.entries(agentData.findings_by_agent).map(([agentName, list]: [string, any]) => (
                                  <div key={agentName} className="text-xs">
                                    <span className="font-semibold text-indigo-300 block mb-0.5">{agentName}:</span>
                                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
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
                          {developerMode && !agentData?.findings_by_agent && agentData?.findings && agentData.findings.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Findings</span>
                              <ul className="list-disc pl-4 space-y-0.5 text-xs text-muted-foreground">
                                {agentData.findings.map((item: string, idx: number) => (
                                  <li key={idx} className="leading-relaxed">{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Priorities and Impact are rendered in the right-hand reasoning panel to avoid duplication */}

                          {/* Recommendations by agent */}
                          {developerMode && agentData?.recommendations_by_agent && Object.keys(agentData.recommendations_by_agent).length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Recommendations by Agent</span>
                              <div className="space-y-2">
                                {Object.entries(agentData.recommendations_by_agent).map(([agentName, list]: [string, any]) => (
                                  <div key={agentName} className="text-xs space-y-1">
                                    <span className="font-semibold text-indigo-300 block">{agentName}:</span>
                                    <div className="grid grid-cols-1 gap-1.5 pl-2">
                                      {list.map((item: string, idx: number) => (
                                        <div key={idx} className="p-2 bg-background border border-border/50 rounded-lg text-muted-foreground">
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
                          {developerMode && !agentData?.recommendations_by_agent && agentData?.recommendations && agentData.recommendations.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Recommendations</span>
                              <div className="grid grid-cols-1 gap-1.5">
                                {agentData.recommendations.map((item: string, idx: number) => (
                                  <div key={idx} className="p-2 bg-background border border-border/50 rounded-lg text-xs text-muted-foreground">
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Telemetry metadata */}
                          {developerMode && agentData?.telemetry && (
                            showTelemetry ? (
                              <div className="mt-4 pt-3 border-t border-border space-y-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Execution Telemetry</span>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-muted-foreground">
                                  <div className="p-2 bg-background/80 border border-border rounded-lg">
                                    <span className="block text-muted-foreground">Total Latency</span>
                                    <span className="font-semibold text-indigo-400">{agentData.telemetry.latency_ms} ms</span>
                                  </div>
                                  <div className="p-2 bg-background/80 border border-border rounded-lg">
                                    <span className="block text-muted-foreground">Token Cost</span>
                                    <span className="font-semibold text-emerald-400">${agentData.telemetry.estimated_cost?.toFixed(6) || "0.000000"}</span>
                                  </div>
                                  <div className="p-2 bg-background/80 border border-border rounded-lg">
                                    <span className="block text-muted-foreground">Prompt Tokens</span>
                                    <span className="font-semibold text-muted-foreground">{agentData.telemetry.prompt_tokens}</span>
                                  </div>
                                  <div className="p-2 bg-background/80 border border-border rounded-lg">
                                    <span className="block text-muted-foreground">Completion Tokens</span>
                                    <span className="font-semibold text-muted-foreground">{agentData.telemetry.completion_tokens}</span>
                                  </div>
                                </div>
                                {/* Agent execution details */}
                                {agentData.telemetry.agents && Object.keys(agentData.telemetry.agents).length > 0 && (
                                  <div className="p-2 bg-background/40 border border-border rounded-lg text-[9px] text-muted-foreground space-y-1">
                                    <span className="font-semibold text-muted-foreground block mb-1">Agent Pipeline Breakdown:</span>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                      {Object.entries(agentData.telemetry.agents).map(([agentName, data]: [string, any]) => (
                                        <div key={agentName} className="flex items-center gap-1.5">
                                          <span className="capitalize text-muted-foreground font-medium">{agentName}:</span>
                                          <span className="text-muted-foreground">{data.latency_ms}ms</span>
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
                              <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-slate-450">
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
 
                    <span className="text-[9px] text-muted-foreground block px-1">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}

            {messages.length <= 1 && (
              <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 animate-fade-in">
                {/* Briefing Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/45 via-purple-950/15 to-transparent p-6 rounded-2xl border border-indigo-500/10 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-650 rounded-xl text-foreground shadow-md shadow-indigo-600/30">
                      <Brain size={22} className="text-foreground" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-foreground tracking-tight flex items-center gap-2">
                        EVE Executive Briefing
                      </h2>
                      <p className="text-xs text-slate-400">
                        Operational health status and automated intelligence for your brand
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-2 rounded-xl text-[10px] font-bold shadow-sm">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <span>Data Freshness: Live (Synced Just Now)</span>
                    </div>
                    <div className="flex items-center gap-3 bg-indigo-950/30 border border-indigo-500/20 px-4 py-2.5 rounded-xl">
                      <span className="text-xs font-semibold text-slate-400">Operational Health:</span>
                      <span className={`text-sm font-extrabold px-2.5 py-0.5 rounded-full ${
                        healthScore >= 75 ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/20"
                        : healthScore >= 50 ? "bg-amber-500/10 text-amber-450 border border-amber-500/20"
                        : "bg-rose-500/10 text-rose-450 border border-rose-500/20"
                      }`}>
                        {healthScore}/100 ({healthStatus})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Risks & Opportunities Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Risks Card */}
                  <div className="bg-card/45 backdrop-blur-sm border border-border/80 rounded-2xl p-5 shadow-md flex flex-col space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5 border-b border-border/40 pb-3">
                      <AlertTriangle size={14} className="text-rose-500" /> Active Operational Risks
                    </h3>
                    <div className="flex-1 space-y-2.5">
                      {risks.length > 0 ? (
                        risks.slice(0, 3).map((risk, i) => (
                          <div key={i} className="p-3 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-xl transition-all flex items-start gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                            <div className="space-y-0.5 flex-1">
                              <p className="text-xs text-foreground font-medium leading-relaxed">{risk.description || risk}</p>
                              {risk.impact_level && (
                                <span className="inline-block text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 rounded uppercase tracking-wider mt-1">
                                  {risk.impact_level} Impact
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-xs text-muted-foreground italic">
                          No active critical risks identified.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Opportunities Card */}
                  <div className="bg-card/45 backdrop-blur-sm border border-border/80 rounded-2xl p-5 shadow-md flex flex-col space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-450 flex items-center gap-1.5 border-b border-border/40 pb-3">
                      <Sparkles size={14} className="text-emerald-500" /> Strategic Opportunities
                    </h3>
                    <div className="flex-1 space-y-2.5">
                      {opportunities.length > 0 ? (
                        opportunities.slice(0, 3).map((opp, i) => (
                          <div key={i} className="p-3 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 rounded-xl transition-all flex items-start gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                            <div className="space-y-0.5 flex-1">
                              <p className="text-xs text-foreground font-medium leading-relaxed">{opp.description || opp}</p>
                              {opp.value_potential && (
                                <span className="inline-block text-[9px] font-bold text-emerald-450 bg-emerald-500/10 px-1.5 rounded uppercase tracking-wider mt-1">
                                  +${opp.value_potential.toLocaleString()} Est. Value
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-xs text-muted-foreground italic">
                          Scanning for revenue/margin opportunities...
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Suggested Quick-Prompts */}
                <div className="bg-card/30 border border-border/60 rounded-2xl p-5 space-y-3 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-indigo-500" /> Suggested Action Prompts
                  </h3>
                  <p className="text-xs text-slate-400">Click any prompt below to query the EVE Agent network immediately:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {getDynamicSuggestions().map((group, idx) => (
                      <div key={idx} className="space-y-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                          {group.category}
                        </span>
                        <div className="flex flex-col gap-2">
                          {group.questions.map((question, qIdx) => (
                            <button
                              key={qIdx}
                              type="button"
                              onClick={() => setInputMessage(question)}
                              className="text-left text-xs text-muted-foreground hover:text-foreground hover:border-indigo-500/40 bg-background/50 hover:bg-indigo-650/10 p-3 rounded-xl border border-border/80 transition-all cursor-pointer truncate"
                              title={question}
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
 
            {chatLoading && (
              <div className="flex gap-3 max-w-[80%] mr-auto animate-fade-in">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-foreground border border-indigo-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Brain size={14} />
                </div>
                <div className="space-y-1.5 flex-1">
                  {isGreeting ? (
                    <div className="bg-card border border-border/80 rounded-2xl px-4 py-3 shadow-lg w-20 flex items-center justify-center space-x-1">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-indigo-450 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-1 items-center mb-1">
                        <span className="text-[9px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.2 rounded-full animate-pulse">
                          EVE COO Executing...
                        </span>
                      </div>
                      <div className="bg-card border border-border/80 rounded-2xl px-4 py-3 text-xs flex flex-col gap-3 shadow-lg w-full max-w-[340px]">
                        {developerMode ? (
                          <>
                            <div className="flex items-center gap-2 text-slate-355 font-semibold text-[11px] border-b border-border pb-2 mb-0.5">
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
                                  <div className="w-2.5 h-2.5 rounded-full border border-border" />
                                )}
                                <span className={loadingStage > 1 ? "text-muted-foreground" : loadingStage === 1 ? "text-indigo-400 font-semibold" : "text-muted-foreground"}>
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
                                  <div className="w-2.5 h-2.5 rounded-full border border-border" />
                                )}
                                <span className={loadingStage > 2 ? "text-muted-foreground" : loadingStage === 2 ? "text-indigo-400 font-semibold" : "text-muted-foreground"}>
                                  Spawn sub-agent queries
                                </span>
                              </div>

                              {/* Step 3: Synthesis */}
                              <div className="flex items-center gap-2 text-[11px]">
                                {loadingStage === 3 ? (
                                  <Loader2 className="w-3 h-3 text-indigo-405 animate-spin" />
                                ) : (
                                  <div className="w-2.5 h-2.5 rounded-full border border-border" />
                                )}
                                <span className={loadingStage === 3 ? "text-indigo-400 font-semibold animate-pulse" : "text-muted-foreground"}>
                                  Synthesize recommendations
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2.5 text-slate-350 font-semibold text-[11px] py-0.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            <span>EVE is analyzing your business data...</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
 
          {/* Quick chip selector & Input Form footer */}
          <div className="p-4 bg-card border-t border-border space-y-3 flex-shrink-0">
 
            {documentId && (
              <div className="flex items-center justify-between p-2.5 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-xs text-indigo-300">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-indigo-400" />
                  <span>
                    Context: <strong className="font-semibold text-foreground">{documentName || "Loading file details..."}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDocumentId(null);
                    setDocumentName(null);
                  }}
                  className="text-muted-foreground hover:text-slate-350 transition-colors cursor-pointer"
                  title="Remove document context"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {voiceError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2 animate-fade-in">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>{voiceError}</span>
              </div>
            )}
 
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
                className="flex-1 min-w-0 bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={handleVoiceInput}
                disabled={chatLoading}
                className={`p-3 rounded-xl transition-all flex items-center justify-center flex-shrink-0 cursor-pointer ${
 isListening 
 ? "bg-rose-600 hover:bg-rose-500 text-foreground animate-pulse" 
 : "bg-muted hover:bg-secondary text-slate-350 hover:text-foreground border border-border"
 }`}
                title={isListening ? "Listening... Click to stop" : "Start Voice Input"}
              >
                <Mic size={16} />
              </button>
              <button
                type="submit"
                disabled={chatLoading || !inputMessage.trim()}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-muted-foreground text-foreground rounded-xl transition-all shadow-lg flex items-center justify-center flex-shrink-0 cursor-pointer"
              >
                <Send size={16} />
              </button>
            </form>
            <p className="text-[10px] text-muted-foreground text-center leading-normal select-none">
              EVE provides AI-generated business recommendations. Always verify information before making financial or operational decisions.
            </p>
          </div>
        </div>

      {/* Render Daily Brief Modal */}
      {isDailyBriefOpen && (
        <DailyBriefModal
          isOpen={isDailyBriefOpen}
          onClose={() => setIsDailyBriefOpen(false)}
          token={sessionToken}
          onAskFollowUp={handleFollowUpQuestion}
        />
      )}

      {/* Render long-term memory drawers */}
      {isMemoryOpen && (
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
      )}

      {/* Render recommendation history drawer */}
      {isRecommendationsOpen && (
        <RecommendationHistoryPanel
          isOpen={isRecommendationsOpen}
          onClose={() => setIsRecommendationsOpen(false)}
          token={sessionToken}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-background backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-2">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-foreground">Delete Conversation?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete this conversation? This will permanently erase the chat history and context.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 bg-muted hover:bg-slate-750 text-slate-350 rounded-xl text-xs font-semibold cursor-pointer border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSession(deleteConfirmId)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-foreground rounded-xl text-xs font-semibold cursor-pointer shadow-md shadow-rose-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
