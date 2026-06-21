"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL } from "@/lib/api";
import { 
  sendExecutiveChat, 
  listGoals, 
  getRecommendations,
  listConversations,
  getConversation,
  renameConversation,
  deleteConversation
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
  BookOpen,
  Mic,
  Plus,
  Trash2,
  Edit,
  MessageSquare,
  X,
  FileText
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
          <li key={idx} className="ml-4 list-disc text-slate-300 text-sm mb-1 leading-relaxed">
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
          <h3 key={idx} className="text-base font-bold text-slate-100 mt-4 mb-2">
            {renderFormattedText(trimmed.substring(3))}
          </h3>
        );
      }
      if (trimmed.startsWith("# ")) {
        return (
          <h2 key={idx} className="text-lg font-extrabold text-white mt-5 mb-2.5">
            {renderFormattedText(trimmed.substring(2))}
          </h2>
        );
      }
      if (trimmed === "") {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-slate-305 text-sm mb-1.5 leading-relaxed">
          {renderFormattedText(line)}
        </p>
      );
    });
  };

  return (
    <>
      <div className="space-y-1">{renderLines(normalLines)}</div>
      {evidenceLines.length > 0 && (
        <details className="mt-3 border border-slate-800 bg-slate-950/40 rounded-xl overflow-hidden group">
          <summary className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer list-none flex items-center justify-between select-none bg-slate-900/40 hover:bg-slate-900/60">
            <span className="flex items-center gap-1.5">📊 Supporting Evidence</span>
            <span className="text-[10px] text-indigo-405 group-open:rotate-185 transition-transform">▼</span>
          </summary>
          <div className="px-4 pb-3.5 pt-2 border-t border-slate-850 text-xs space-y-1">
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
  const [suggestedActions, setSuggestedActions] = useState<string[]>([
    "What needs my attention?",
    "Finance summary",
    "Identify overstock risks",
    "Pricing optimizations"
  ]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<Record<string, string[]> | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsHistoryOpen(window.innerWidth >= 1280);
    }
  }, []);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  // Resizable panel widths (percentages)
  const [rightWidth, setRightWidth] = useState(30);

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
  const [overview, setOverview] = useState<any>(null);

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

  const handleRightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    const doDrag = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / window.innerWidth) * 100;
      const newWidth = Math.max(20, Math.min(45, startWidth - deltaPercent));
      setRightWidth(newWidth);
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

  const [conversations, setConversations] = useState<any[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Initial dashboard hydration
  const hydrateDashboard = async (token: string) => {
    try {
      const [healthData, riskData, oppData, trendData, goalsData, convsData, overviewData] = await Promise.all([
        fetchHealth(token),
        fetchRisks(token),
        fetchOpportunities(token),
        fetchTrends(token),
        listGoals(token),
        listConversations(token).catch(() => []),
        fetch(`${API_BASE_URL}/api/analytics/overview`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.ok ? r.json() : null).catch(() => null)
      ]);

      if (healthData) {
        setHealthScore(healthData.score || 0);
        setHealthStatus(healthData.status || "Unknown");
      }
      if (riskData && riskData.risks) setRisks(riskData.risks.slice(0, 3));
      if (oppData && oppData.opportunities) setOpportunities(oppData.opportunities.slice(0, 3));
      setHealthTrends(trendData);
      setGoals(goalsData);
      if (overviewData) {
        setOverview(overviewData);
      }
      if (convsData) {
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
          const defaultEvidence: string[] = [];
          if (riskData && riskData.risks) {
            riskData.risks.forEach((r: any) => defaultEvidence.push(`Risk: ${r.title} - ${r.description}`));
          }
          if (oppData && oppData.opportunities) {
            oppData.opportunities.forEach((o: any) => defaultEvidence.push(`Opportunity: ${o.title} - ${o.description}`));
          }
          if (defaultEvidence.length === 0) {
            defaultEvidence.push("Establish base ledger and inventory records to trace operational performance.");
          }

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
              Overall: healthData ? (healthData.score / 100) : 0.85,
              "Finance Agent": 0.88,
              "Operations Agent": 0.85
            }
          } as any);
        }
      }

      // Fetch suggested questions
      try {
        const questionsRes = await fetch(`${API_BASE_URL}/api/executive/suggested-questions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (questionsRes.ok) {
          const qData = await questionsRes.json();
          setSuggestedQuestions(qData);
        }
      } catch (err) {
        console.error("Failed to fetch suggested questions", err);
      }
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

        await hydrateDashboard(session.access_token);
      } catch (err) {
        console.error("EVE setup error:", err);
      } finally {
        setLoading(false);
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
        content: "Welcome to the EVE AI COO Command Center. I am analyzing real-time finance, inventory, and operations parameters. You can set long-term strategic goals in the Memory Manager or request a Daily Brief. What analysis shall we run?",
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
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    
    const isGreet = isGreetingMessage(messageText);
    setIsGreeting(isGreet);
    setChatLoading(true);

    try {
      const response = await sendExecutiveChat(
        messageText, 
        sessionToken, 
        conversationId, 
        chatMode,
        developerMode,
        language,
        documentId || undefined
      );
      
      const isNewChat = !conversationId;
      setConversationId(response.conversation_id);

      const assistantMsg: MessageResponse = response.message;
      setMessages((prev) => [...prev, assistantMsg]);

      // Automatically populate Right Reasoning panel with returned agent data
      if (assistantMsg.agent_data) {
        setSelectedReasoning(assistantMsg.agent_data as AgentAnalysisResult);
        setIsInsightsOpen(true);
      } else {
        setSelectedReasoning(null);
        setIsInsightsOpen(false);
      }

      // Reload conversations list to show new auto-title or updated sorting
      if (isNewChat && sessionToken) {
        const convs = await listConversations(sessionToken).catch(() => []);
        setConversations(convs);
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
          setVoiceError(`Voice input error: ${event.error}`);
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

  useEffect(() => {
    if (messages.length <= 1) {
      setSuggestedActions([
        "What needs my attention?",
        "Finance summary",
        "Identify overstock risks",
        "Pricing optimizations"
      ]);
      return;
    }

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "user") return;

    const contentLower = lastMsg.content.toLowerCase();
    const agentData = lastMsg.agent_data as any;
    const intent = agentData?.intent || "";

    if (intent === "Greeting" || contentLower.includes("hi!") || contentLower.includes("hello!")) {
      setSuggestedActions([
        "Show my daily brief",
        "What needs my attention?",
        "How is our health score?"
      ]);
    } else if (intent === "Finance Query" || contentLower.includes("finance") || contentLower.includes("revenue") || contentLower.includes("cogs")) {
      setSuggestedActions([
        "Identify overstock risks",
        "How to contain expenses?",
        "Show my health score"
      ]);
    } else if (intent === "Inventory Query" || contentLower.includes("inventory") || contentLower.includes("stock") || contentLower.includes("sku")) {
      setSuggestedActions([
        "Show top stockout risks",
        "Suggest reorder quantities",
        "Pricing optimizations"
      ]);
    } else if (intent === "Pricing Query" || contentLower.includes("price") || contentLower.includes("pricing") || contentLower.includes("margins")) {
      setSuggestedActions([
        "Simulate price change",
        "What is our profit margin?",
        "Identify overstock risks"
      ]);
    } else {
      setSuggestedActions([
        "What needs my attention?",
        "Show my daily brief",
        "Finance summary",
        "Identify overstock risks"
      ]);
    }
  }, [messages]);

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
      {/* Mobile Sidebar Backdrop */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 xl:hidden transition-opacity duration-300"
          onClick={() => setIsHistoryOpen(false)}
        />
      )}

      {/* Column 0: Conversation History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 h-full w-64 border-r border-slate-800 bg-slate-900 rounded-r-2xl rounded-l-none transform transition-all duration-300 ease-in-out xl:relative xl:translate-x-0 xl:z-0 xl:border xl:rounded-2xl xl:shadow-lg xl:flex xl:flex-col xl:gap-3 xl:flex-shrink-0 xl:overflow-hidden ${
        isHistoryOpen 
          ? "translate-x-0 p-4 opacity-100" 
          : "-translate-x-full xl:translate-x-0 xl:w-0 xl:p-0 xl:border-0 xl:opacity-0 xl:pointer-events-none"
      }`}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare size={14} className="text-indigo-400" /> Chat History
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleStartNewChat}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold border border-slate-800 hover:border-slate-700 cursor-pointer"
              title="Start New Chat"
            >
              <Plus size={12} /> New Chat
            </button>
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg transition-all cursor-pointer text-[10px]"
              title="Collapse Panel"
            >
              &lt;&lt;
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto space-y-4 pr-0.5 scrollbar-none">
          {Object.entries(groupConversationsByDate(conversations)).map(([groupName, groupConvs]) => (
            <div key={groupName} className="space-y-1.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block px-1 mb-1">
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
                        : "bg-slate-950/45 text-slate-400 border-slate-800/60 hover:bg-slate-800/40 hover:text-slate-200"
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
                          className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs px-1.5 py-0.5 rounded outline-none"
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
                        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-slate-900/95 p-0.5 rounded border border-slate-800">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(c.id);
                              setEditingTitle(c.title || "");
                            }}
                            className="p-1 hover:text-indigo-400 text-slate-400 hover:bg-slate-800 rounded transition-all cursor-pointer"
                            title="Rename Chat"
                          >
                            <Edit size={10} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(c.id);
                            }}
                            className="p-1 hover:text-rose-400 text-slate-400 hover:bg-slate-800 rounded transition-all cursor-pointer"
                            title="Delete Chat"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-[8px] text-slate-500 mt-1 flex justify-between items-center">
                      <span>
                        {getRelativeTimeString(c.updated_at || c.created_at)}
                      </span>
                      {c.message_count !== undefined && c.message_count > 0 && (
                        <span className="bg-slate-800 text-slate-450 px-1 py-0.2 rounded text-[7px] font-bold">
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
            <p className="text-[10px] text-slate-550 italic text-center py-6">No previous conversations.</p>
          )}
        </div>
      </div>
          {/* Middle Column - Multi-Turn EVE Command Center Chat */}
      <div 
        className="w-full xl:h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative flex-1 min-w-[320px] transition-all duration-300"
      >
        
        {/* Conversational Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {!isHistoryOpen && (
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="p-1 hover:bg-slate-800 text-slate-450 hover:text-indigo-400 rounded-lg transition-all border border-slate-800 cursor-pointer flex items-center gap-1 text-[10px]"
                title="Show Chat History"
              >
                <MessageSquare size={12} /> History
              </button>
            )}
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-600/30">
              <Brain size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                EVE Agent Network <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Active</span>
              </h2>
              <p className="text-[10px] text-slate-405">Queries route automatically to COO, Finance & Operations agents</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Relocated Quick Actions */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/80 mr-1.5">
              <button
                type="button"
                onClick={() => setIsDailyBriefOpen(true)}
                className="py-1 px-2.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="Daily Brief"
              >
                <BookOpen size={11} className="text-indigo-400" />
                <span>Daily Brief</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMemoryOpen(true)}
                className="py-1 px-2.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="Goals Memory"
              >
                <Target size={11} className="text-indigo-400" />
                <span>Goals Memory</span>
              </button>
            </div>

            {/* Panel Toggles */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 mr-2">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  isHistoryOpen 
                    ? "bg-slate-800 text-indigo-400 font-bold" 
                    : "text-slate-500 hover:text-slate-300"
                }`}
                title={isHistoryOpen ? "Hide Chat History" : "Show Chat History"}
              >
                <MessageSquare size={13} />
              </button>
            </div>
            {/* Language Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
                  language === "en" 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "text-slate-400 hover:text-slate-200"
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
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "text-slate-400 hover:text-slate-200"
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
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20" 
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                }`}
                title="Toggle Advanced Telemetry"
              >
                <Database size={10} />
                <span>Telemetry: {showTelemetry ? "ON" : "OFF"}</span>
              </button>
            )}

            {/* Mode Selector */}
            {developerMode && (
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
            )}
          </div>
        </div>
               {/* Business Snapshot & Suggested Questions Section */}
        <div className="px-6 py-2.5 border-b border-slate-800/60 bg-slate-900/10 flex flex-col gap-2.5 flex-shrink-0">
          {/* Business Snapshot Cards */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {/* Business Health Badge */}
            <div className="flex items-center gap-1.5 bg-slate-950/50 border border-slate-800/60 px-2.5 py-1 rounded-full">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Health:</span>
              <span className={`font-bold flex items-center gap-1 ${
                healthScore >= 80 ? 'text-emerald-450' : healthScore >= 60 ? 'text-amber-450' : 'text-rose-450'
              }`}>
                {healthScore} - {healthStatus}
              </span>
            </div>

            {/* Top Risk Pill */}
            <div className="flex items-center gap-1.5 bg-slate-950/50 border border-slate-800/60 px-2.5 py-1 rounded-full min-w-0 max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl">
              <ShieldAlert size={12} className="text-rose-450 flex-shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-505 flex-shrink-0">Risk:</span>
              <span className="truncate text-slate-300 font-medium" title={risks[0]?.description || "None"}>
                {risks[0]?.description || "No active risks."}
              </span>
            </div>

            {/* Top Opportunity Pill */}
            <div className="flex items-center gap-1.5 bg-slate-950/50 border border-slate-800/60 px-2.5 py-1 rounded-full min-w-0 max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl">
              <Lightbulb size={12} className="text-emerald-400 flex-shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-505 flex-shrink-0">Opportunity:</span>
              <span className="truncate text-slate-300 font-medium" title={opportunities[0]?.description || "None"}>
                {opportunities[0]?.description || "No opportunities."}
              </span>
            </div>
          </div>

          {/* Suggested Questions Row */}
          <div className="flex flex-col gap-2">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Suggested Questions</span>
            <div className="flex flex-wrap gap-2">
              {[
                "What needs my attention?",
                "Show my daily brief.",
                "Give me a finance summary.",
                "Identify inventory risks.",
                "What should I focus on this week?"
              ].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendChat(q)}
                  disabled={chatLoading}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-slate-350 hover:text-slate-200 rounded-lg text-xs transition-all duration-200 leading-normal cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
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
                              <span key={name} className="text-[8px] font-bold bg-slate-800 text-slate-450 border border-slate-700/60 px-1.5 py-0.2 rounded-md uppercase tracking-wide">
                                {name.replace(" Agent", "").replace(" Intelligence Agent", "")}: {Math.round(score * 100)}%
                              </span>
                            ))
                          ) : null
                        )}
                      </div>
                    )}
 
                    <div className={`text-sm leading-relaxed space-y-2.5 ${
                      isAssistant 
                        ? "bg-transparent text-slate-100 border-none shadow-none px-1 py-0" 
                        : "bg-indigo-600/10 text-indigo-100 border border-indigo-500/15 px-4.5 py-3 rounded-2xl shadow-sm"
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
                              <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                                EVE needs active data to run its advanced COO logic. Upload CSV sheets or create entries:
                              </p>
                              <div className="flex flex-wrap gap-2 pt-0.5">
                                <a 
                                  href="/dashboard/inventory"
                                  className="text-[10px] font-bold px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-all flex items-center gap-1"
                                >
                                  <span>📦 Setup Inventory Catalog</span>
                                  <ArrowRight size={10} />
                                </a>
                                <a 
                                  href="/dashboard/finance"
                                  className="text-[10px] font-bold px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-all flex items-center gap-1"
                                >
                                  <span>💰 Import Sales & Costs</span>
                                  <ArrowRight size={10} />
                                </a>
                                <a 
                                  href="/dashboard/projects"
                                  className="text-[10px] font-bold px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-all flex items-center gap-1"
                                >
                                  <span>💼 Create Client Project</span>
                                  <ArrowRight size={10} />
                                </a>
                              </div>
                            </div>
                          )}
                          
                          {/* findings by agent */}
                          {developerMode && agentData?.findings_by_agent && Object.keys(agentData.findings_by_agent).length > 0 && (
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
                          {developerMode && !agentData?.findings_by_agent && agentData?.findings && agentData.findings.length > 0 && (
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
                              <span className="text-[10px] font-bold text-slate-405 uppercase tracking-widest block">Strategic Priorities</span>
                              <div className="grid grid-cols-1 gap-2">
                                {agentData.priorities.map((pri: any, idx: number) => (
                                  <div key={idx} className="py-2.5 px-3 bg-slate-950/30 border-l-2 border-indigo-500 rounded-r-xl space-y-0.5 animate-fade-in">
                                    <span className="text-xs font-bold text-indigo-300 block">Priority {idx + 1}: {pri.title}</span>
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-normal">{pri.description}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                           {/* Expected Business Impact */}
                          {agentData?.expected_impact && 
                           agentData.expected_impact.trim() !== "" && 
                           agentData.expected_impact.trim().toUpperCase() !== "N/A" && (
                            <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs space-y-0.5">
                              <span className="font-semibold text-emerald-400 block text-[10px] uppercase tracking-wider">Expected Business Impact</span>
                              <p className="text-slate-300 font-normal leading-relaxed">{agentData.expected_impact}</p>
                            </div>
                          )}

                          {/* Recommendations by agent */}
                          {developerMode && agentData?.recommendations_by_agent && Object.keys(agentData.recommendations_by_agent).length > 0 && (
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
                          {developerMode && !agentData?.recommendations_by_agent && agentData?.recommendations && agentData.recommendations.length > 0 && (
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
                          {developerMode && agentData?.telemetry && (
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

            {messages.length <= 1 && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl ml-11 pb-6 animate-fade-in">
                {Object.entries(suggestedQuestions || {
                  Finance: [
                    "How profitable is this business?",
                    "What expenses are hurting margins?"
                  ],
                  Inventory: [
                    "Which products should I reorder?",
                    "What inventory is becoming dead stock?"
                  ],
                  Growth: [
                    "How can revenue be increased?",
                    "Which customers are most valuable?"
                  ],
                  Founder: [
                    "Give me an executive summary.",
                    "What should I focus on this week?"
                  ]
                }).map(([category, qs]) => (
                  <div key={category} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-3 shadow-md hover:border-slate-800/95 transition-all duration-300">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block border-b border-slate-800/60 pb-2">
                      {category}
                    </span>
                    <div className="flex flex-col gap-2">
                      {qs.map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendChat(q)}
                          disabled={chatLoading}
                          className="text-left text-xs bg-slate-950/60 hover:bg-slate-950 border border-slate-850 hover:border-indigo-500/40 p-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-all duration-200 leading-normal cursor-pointer disabled:opacity-50"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
 
            {chatLoading && (
              <div className="flex gap-3 max-w-[80%] mr-auto animate-fade-in">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white border border-indigo-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Brain size={14} />
                </div>
                <div className="space-y-1.5 flex-1">
                  {isGreeting ? (
                    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl px-4 py-3 shadow-lg w-20 flex items-center justify-center space-x-1">
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
                      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl px-4 py-3 text-xs flex flex-col gap-3 shadow-lg w-full max-w-[340px]">
                        {developerMode ? (
                          <>
                            <div className="flex items-center gap-2 text-slate-355 font-semibold text-[11px] border-b border-slate-800 pb-2 mb-0.5">
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
                                  <Loader2 className="w-3 h-3 text-indigo-405 animate-spin" />
                                ) : (
                                  <div className="w-2.5 h-2.5 rounded-full border border-slate-700" />
                                )}
                                <span className={loadingStage === 3 ? "text-indigo-400 font-semibold animate-pulse" : "text-slate-600"}>
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
          <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3 flex-shrink-0">
            {/* Quick action chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {suggestedActions.map((chip, idx) => (
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
 
            {documentId && (
              <div className="flex items-center justify-between p-2.5 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-xs text-indigo-300">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-indigo-400" />
                  <span>
                    Context: <strong className="font-semibold text-slate-200">{documentName || "Loading file details..."}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDocumentId(null);
                    setDocumentName(null);
                  }}
                  className="text-slate-500 hover:text-slate-350 transition-colors cursor-pointer"
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
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={handleVoiceInput}
                disabled={chatLoading}
                className={`p-3 rounded-xl transition-all flex items-center justify-center flex-shrink-0 cursor-pointer ${
                  isListening 
                    ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse" 
                    : "bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-slate-200 border border-slate-700"
                }`}
                title={isListening ? "Listening... Click to stop" : "Start Voice Input"}
              >
                <Mic size={16} />
              </button>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-2">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-100">Delete Conversation?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete this conversation? This will permanently erase the chat history and context.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 text-slate-350 rounded-xl text-xs font-semibold cursor-pointer border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSession(deleteConfirmId)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md shadow-rose-600/20"
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
