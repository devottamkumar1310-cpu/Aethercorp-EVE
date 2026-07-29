"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { devLog } from "@/lib/logger";
import { track } from "@/lib/analytics";
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
  ArrowUp,
  Loader2,
  Target,
  Database,
  BookOpen,
  Mic,
  Plus,
  Trash2,
  Edit,
  X,
  FileText,
  ListChecks,
  ChevronDown,
  MoreHorizontal,
  PanelLeft
} from "lucide-react";

// Markdown parser helpers
function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
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
          <li key={idx} className="ml-5 list-disc text-[15px] text-foreground/90 mb-1.5 leading-7">
            {renderFormattedText(content)}
          </li>
        );
      }
      if (trimmed.startsWith("### ")) {
        return (
          <h4 key={idx} className="text-sm font-semibold text-foreground mt-5 mb-2">
            {renderFormattedText(trimmed.substring(4))}
          </h4>
        );
      }
      if (trimmed.startsWith("## ")) {
        return (
          <h3 key={idx} className="text-base font-semibold text-foreground mt-6 mb-2">
            {renderFormattedText(trimmed.substring(3))}
          </h3>
        );
      }
      if (trimmed.startsWith("# ")) {
        return (
          <h2 key={idx} className="text-lg font-semibold text-foreground mt-6 mb-2.5">
            {renderFormattedText(trimmed.substring(2))}
          </h2>
        );
      }
      if (trimmed === "") {
        return <div key={idx} className="h-2.5" />;
      }
      return (
        <p key={idx} className="text-[15px] text-foreground/90 mb-2 leading-7">
          {renderFormattedText(line)}
        </p>
      );
    });
  };

  return (
    <>
      <div>{renderLines(normalLines)}</div>
      {evidenceLines.length > 0 && (
        <details className="mt-4 border border-border rounded-xl overflow-hidden group">
          <summary className="px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer list-none flex items-center justify-between select-none">
            <span>Supporting evidence</span>
            <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-3.5 pt-1 border-t border-border">
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

const WELCOME_MESSAGE_ID = "welcome-msg";

function buildWelcomeMessage(): MessageResponse {
  return {
    id: WELCOME_MESSAGE_ID,
    role: "assistant",
    content: "",
    created_at: new Date().toISOString()
  };
}

export default function EVEChatWorkspace() {
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
  const [language, setLanguage] = useState<string>("en");
  const [isGreeting, setIsGreeting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSnapshotExpanded, setIsSnapshotExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDeveloperMode(localStorage.getItem("developer_mode") === "true");
      setIsHistoryOpen(window.innerWidth >= 1280);
    }
  }, []);

  // Close the overflow menu on outside click / Escape
  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  // Modals & Panels open states
  const [isDailyBriefOpen, setIsDailyBriefOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(false);

  // Business metrics & data states
  const [healthScore, setHealthScore] = useState<number>(0);
  const [healthStatus, setHealthStatus] = useState<string>("");
  const [risks, setRisks] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);

  // Suggested prompts, derived from the workspace's real risks and opportunities.
  const getSuggestedPrompts = (): string[] => {
    const prompts: string[] = [];

    risks.slice(0, 2).forEach(r => {
      const desc = (r.description || "").toLowerCase();
      if (desc.includes("margin") || desc.includes("profit") || desc.includes("decay")) {
        prompts.push("How can we address the declining net margins?");
      } else if (desc.includes("stock") || desc.includes("inventory") || desc.includes("reorder") || desc.includes("safety")) {
        prompts.push("What is the replenishment plan for our stock risks?");
      } else if (desc.includes("cash") || desc.includes("capital") || desc.includes("runway")) {
        prompts.push("What cash flow adjustments will stabilise our runway?");
      } else if (r.description) {
        prompts.push(`How do we mitigate: ${r.description.slice(0, 60)}?`);
      }
    });

    opportunities.slice(0, 2).forEach(o => {
      const desc = (o.description || "").toLowerCase();
      if (desc.includes("price") || desc.includes("pricing") || desc.includes("markdown")) {
        prompts.push("Calculate the profit impact of the suggested pricing changes.");
      } else if (desc.includes("growth") || desc.includes("expansion") || desc.includes("revenue")) {
        prompts.push("What is the timeline for our growth opportunities?");
      } else if (o.description) {
        prompts.push(`How do we execute on: ${o.description.slice(0, 60)}?`);
      }
    });

    // Fall back to broadly useful executive questions for an empty workspace.
    const fallbacks = [
      "What needs my attention today?",
      "Which SKUs are at risk of stocking out?",
      "Where is my working capital tied up?",
      "Show a profitability breakdown by product category."
    ];

    for (const f of fallbacks) {
      if (prompts.length >= 4) break;
      if (!prompts.includes(f)) prompts.push(f);
    }

    return prompts.slice(0, 4);
  };

  const [messages, setMessages] = useState<MessageResponse[]>([buildWelcomeMessage()]);

  // Reasoning behind the most recent assistant answer, surfaced in the snapshot strip.
  const [selectedReasoning, setSelectedReasoning] = useState<AgentAnalysisResult | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // Only auto-scroll when the reader is already near the bottom, so scrolling
  // back through a long answer isn't yanked away by streaming tokens.
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 120;
  };

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, chatLoading]);

  // Auto-grow the composer up to a fixed ceiling, then scroll internally.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [inputMessage]);

  const [conversations, setConversations] = useState<any[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  useEffect(() => {
    if (sessionToken && pendingQuestion) {
      handleSendChat(pendingQuestion);
      setPendingQuestion(null);
    }
  }, [sessionToken, pendingQuestion]);

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
              logger.error("Failed to load last conversation details for default insights:", err);
            }
          } else {
            // No prior conversations — leave selectedReasoning null so the snapshot
            // falls back to live workspace data rather than a stale generic summary.
            setSelectedReasoning(null);
          }
          const tChat = performance.now();
          devLog(`[TELEMETRY][PERF] Time to Chat Interactive: ${(tChat - tStart).toFixed(2)}ms`);
        })
        .catch(err => logger.error("Conversations load failed:", err));

      // 2. Fetch Non-critical Analytics Independently
      Promise.allSettled([
        fetchHealth(token)
          .then(val => {
            if (val) {
              setHealthScore(val.score || 0);
              setHealthStatus(val.status || "");
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
      }).catch(err => logger.error("Panel group load failed", err));

      const workspaceIdForOverview = localStorage.getItem("active_workspace_id");
      apiFetch(`${API_BASE_URL}/api/analytics/overview`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(workspaceIdForOverview ? { "X-Workspace-Id": workspaceIdForOverview } : {})
        }
      })
        .then(r => r.ok ? r.json() : null)
        .then(val => {
          if (val) setOverview(val);
        })
        .catch(err => logger.error("Overview load failed:", err));

    } catch (err) {
      logger.error("Hydration failed:", err);
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

        const docParam = searchParams?.get("document_id");
        if (docParam) {
          setDocumentId(docParam);
          try {
            const { getDocumentDetails } = await import("@/services/documentService");
            const docDetails = await getDocumentDetails(docParam, session.access_token);
            setDocumentName(docDetails.filename);
          } catch (err) {
            logger.error("Failed to load document context for chat:", err);
          }
        }

        const questionParam = searchParams?.get("question");
        if (questionParam) {
          setPendingQuestion(questionParam);
        }

        hydrateDashboard(session.access_token);
      } catch (err) {
        logger.error("EVE setup error:", err);
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

        const assistantMsgs = mapped.filter((m: any) => m.role === "assistant");
        const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
        setSelectedReasoning(lastAssistant?.agent_data || null);
      } else {
        setMessages([]);
        setSelectedReasoning(null);
      }
      shouldAutoScrollRef.current = true;
      if (window.innerWidth < 1280) setIsHistoryOpen(false);
    } catch (err) {
      logger.error("Load conversation failed:", err);
    }
  };

  const handleStartNewChat = () => {
    setConversationId(undefined);
    setSelectedReasoning(null);
    setMessages([buildWelcomeMessage()]);
    setInputMessage("");
    shouldAutoScrollRef.current = true;
    if (typeof window !== "undefined" && window.innerWidth < 1280) setIsHistoryOpen(false);
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
      logger.error("Rename failed:", err);
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
      logger.error("Delete failed:", err);
    }
  };

  const handleSendChat = async (messageText: string) => {
    if (!messageText.trim() || !sessionToken || chatLoading) return;

    const userMsg: MessageResponse = {
      id: Math.random().toString(),
      role: "user",
      content: messageText,
      created_at: new Date().toISOString()
    };

    const assistantTempId = Math.random().toString();
    const assistantPlaceholder: MessageResponse = {
      id: assistantTempId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString()
    };

    // Drop the placeholder welcome message once a real exchange begins.
    setMessages((prev) => [
      ...prev.filter((m) => m.id !== WELCOME_MESSAGE_ID),
      userMsg,
      assistantPlaceholder
    ]);
    setInputMessage("");
    shouldAutoScrollRef.current = true;

    const isGreet = isGreetingMessage(messageText);
    setIsGreeting(isGreet);
    setChatLoading(true);

    // Message LENGTH only — the prompt itself never leaves the app.
    track("ai_chat_message_sent", { message_length: messageText.length, mode: chatMode });
    track("analysis_started", { source: "executive_chat", mode: chatMode });
    const analysisStartedAt = Date.now();
    let analysisFailed = false;

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
          } else if (type === "error") {
            // Outcome only — the error text can quote model output.
            analysisFailed = true;
            track("analysis_failed", {
              source: "executive_chat",
              error_type: "stream_error",
              analysis_duration_ms: Date.now() - analysisStartedAt,
              success: false,
            });
            accumulatedContent = typeof content === "string" && content
              ? content
              : "EVE couldn't complete that answer. Please try again.";
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantTempId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
          } else if (type === "done") {
            if (!analysisFailed) {
              track("analysis_completed", {
                source: "executive_chat",
                mode: chatMode,
                analysis_duration_ms: Date.now() - analysisStartedAt,
                success: true,
              });
            }
            if (activeConversationId) {
              getConversation(activeConversationId, sessionToken).then((detail) => {
                const lastMsg = [...detail.messages]
                  .reverse()
                  .find(m => m.role === "assistant" && m.agent_data);
                if (lastMsg) {
                  // Count of recommendations produced — never their text.
                  const priorities = lastMsg.agent_data?.priorities;
                  if (Array.isArray(priorities) && priorities.length > 0) {
                    track("recommendation_generated", {
                      source: "executive_chat",
                      recommendation_count: priorities.length,
                    });
                  }
                  setSelectedReasoning(lastMsg.agent_data);
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantTempId
                        ? { ...msg, agent_data: lastMsg.agent_data }
                        : msg
                    )
                  );
                }
              }).catch((e) => logger.error("Error finalizing stream detail data:", e));

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
      logger.error("Chat streaming failed:", err);
      // Guarded: a stream that emits an `error` frame and then throws would
      // otherwise emit analysis_failed twice for one message.
      if (!analysisFailed) {
        analysisFailed = true;
        track("analysis_failed", {
          source: "executive_chat",
          error_type: "network_or_client",
          analysis_duration_ms: Date.now() - analysisStartedAt,
          success: false,
        });
      }
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
      setVoiceError("Your browser does not support speech recognition. Please use Chrome, Safari, or Edge.");
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

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputMessage((prev) => prev ? prev + " " + transcript : transcript);
        }
      };

      recognition.onerror = (event: any) => {
        logger.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setVoiceError("Microphone permission denied. Please allow microphone access in your browser settings.");
        } else {
          setVoiceError("Voice input requires microphone permissions.");
        }
        setIsListening(false);
        setTimeout(() => setVoiceError(null), 5000);
      };

      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      logger.error("Failed to start speech recognition:", err);
      setVoiceError(`Failed to initialize microphone: ${err.message || err}`);
      setIsListening(false);
      setTimeout(() => setVoiceError(null), 5000);
    }
  };

  // One-line summary for the collapsed snapshot strip.
  const snapshotSummary = (() => {
    const parts: string[] = [];
    if (healthScore > 0) parts.push(`Health ${healthScore}/100`);
    if (risks.length > 0) parts.push(`${risks.length} risk${risks.length === 1 ? "" : "s"}`);
    if (opportunities.length > 0) parts.push(`${opportunities.length} ${opportunities.length === 1 ? "opportunity" : "opportunities"}`);
    if (parts.length === 0 && overview?.profit !== undefined) {
      parts.push(`Profit $${(overview.profit || 0).toLocaleString()}`);
    }
    return parts.join("  ·  ");
  })();

  const hasSnapshotData = Boolean(snapshotSummary) || Boolean(selectedReasoning);
  const isConversationEmpty = messages.filter(m => m.id !== WELCOME_MESSAGE_ID).length === 0;

  if (loading) {
    return (
      <div className="h-[calc(100vh-57px)] w-full flex overflow-hidden">
        <div className="hidden xl:block w-64 border-r border-border bg-card/40" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          <span className="text-xs text-muted-foreground">Loading your workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-57px)] min-h-[520px] w-full flex overflow-hidden bg-background text-foreground font-sans">

      {/* Mobile sidebar backdrop */}
      {isHistoryOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 xl:hidden"
          onClick={() => setIsHistoryOpen(false)}
        />
      )}

      {/* Conversation history */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-out xl:relative xl:z-0 xl:transition-[width] ${
          isHistoryOpen
            ? "translate-x-0 xl:w-72"
            : "-translate-x-full xl:translate-x-0 xl:w-0 xl:overflow-hidden xl:border-r-0"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-3 h-14 flex-shrink-0">
          <button
            onClick={handleStartNewChat}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer border border-border"
          >
            <Plus size={15} />
            New chat
          </button>
          <button
            onClick={() => setIsHistoryOpen(false)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Hide history"
          >
            <PanelLeft size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5 scrollbar-none">
          {Object.entries(groupConversationsByDate(conversations)).map(([groupName, groupConvs]) => (
            <div key={groupName} className="space-y-0.5">
              <span className="text-[11px] font-medium text-muted-foreground block px-2 mb-1.5">
                {groupName}
              </span>
              {groupConvs.map((c) => {
                const isActive = conversationId === c.id;
                const isEditing = editingSessionId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`group relative rounded-lg transition-colors ${
                      isActive ? "bg-muted" : "hover:bg-muted/60"
                    }`}
                  >
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
                        className="w-full bg-background border border-border text-foreground text-sm px-2.5 py-2 rounded-lg outline-none focus:border-primary"
                        autoFocus
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => handleSelectConversation(c.id)}
                          className={`w-full text-left text-sm truncate px-2.5 py-2 pr-14 cursor-pointer rounded-lg ${
                            isActive ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground"
                          }`}
                          title={c.title || "New conversation"}
                        >
                          {c.title || "New conversation"}
                        </button>
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(c.id);
                              setEditingTitle(c.title || "");
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-background transition-colors cursor-pointer"
                            title="Rename"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(c.id);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-rose-500 rounded-md hover:bg-background transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-6 text-center">
              Your conversations will appear here.
            </p>
          )}
        </div>
      </aside>

      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header — deliberately minimal so attention lands on the conversation */}
        <header className="h-14 flex-shrink-0 flex items-center justify-between gap-3 px-3 sm:px-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            {!isHistoryOpen && (
              <>
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Show history"
                >
                  <PanelLeft size={16} />
                </button>
                <button
                  onClick={handleStartNewChat}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="New chat"
                >
                  <Plus size={16} />
                </button>
              </>
            )}
            <span className="text-sm font-semibold text-foreground truncate">EVE</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Language */}
            <div className="flex items-center rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`text-[11px] font-medium px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  language === "en" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage("hi")}
                className={`text-[11px] font-medium px-2 py-1 rounded-md transition-colors cursor-pointer ${
                  language === "hi" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="हिन्दी"
              >
                हिन्दी
              </button>
            </div>

            {/* Overflow menu — secondary tools live here, not in the header */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="More"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
              >
                <MoreHorizontal size={16} />
              </button>
              {isMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-56 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 py-1"
                >
                  <button
                    role="menuitem"
                    onClick={() => { setIsDailyBriefOpen(true); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
                  >
                    <BookOpen size={14} className="text-muted-foreground" />
                    Daily brief
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setIsMemoryOpen(true); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
                  >
                    <Target size={14} className="text-muted-foreground" />
                    Strategic goals
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setIsRecommendationsOpen(true); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
                  >
                    <ListChecks size={14} className="text-muted-foreground" />
                    Recommendation history
                  </button>

                  {developerMode && (
                    <>
                      <div className="h-px bg-border my-1" />
                      <button
                        role="menuitem"
                        onClick={() => { setShowTelemetry(!showTelemetry); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
                      >
                        <Database size={14} className="text-muted-foreground" />
                        Telemetry: {showTelemetry ? "on" : "off"}
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { setChatMode(chatMode === "smart" ? "full" : "smart"); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
                      >
                        <Brain size={14} className="text-muted-foreground" />
                        Mode: {chatMode === "smart" ? "smart" : "full"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Executive snapshot — a single collapsed line by default */}
        {hasSnapshotData && (
          <div className="flex-shrink-0 border-b border-border">
            <button
              type="button"
              onClick={() => setIsSnapshotExpanded(!isSnapshotExpanded)}
              className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-2 text-left hover:bg-muted/40 transition-colors cursor-pointer"
              aria-expanded={isSnapshotExpanded}
            >
              <span className="flex items-center gap-2 min-w-0 text-xs text-muted-foreground">
                <Sparkles size={13} className="text-primary flex-shrink-0" />
                <span className="font-medium text-foreground">Snapshot</span>
                {snapshotSummary && <span className="truncate">{snapshotSummary}</span>}
              </span>
              <ChevronDown
                size={14}
                className={`text-muted-foreground flex-shrink-0 transition-transform ${isSnapshotExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {isSnapshotExpanded && (
              <div className="px-4 sm:px-6 pb-4 pt-1 space-y-3">
                {selectedReasoning ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedReasoning.confidence_category && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                          {selectedReasoning.confidence_category}
                        </span>
                      )}
                      {selectedReasoning.risk_classification && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                          {selectedReasoning.risk_classification}
                        </span>
                      )}
                    </div>

                    {selectedReasoning.priorities && selectedReasoning.priorities.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground block">Strategic priorities</span>
                        <ol className="space-y-1">
                          {selectedReasoning.priorities.map((pri: any, idx: number) => (
                            <li key={idx} className="text-xs text-foreground/90 leading-relaxed">
                              <span className="font-medium text-foreground">{idx + 1}. {pri.title}</span>
                              {pri.description && <span className="text-muted-foreground"> — {pri.description}</span>}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {selectedReasoning.expected_impact && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-medium text-foreground">Expected impact: </span>
                        {selectedReasoning.expected_impact}
                      </p>
                    )}

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Snapshot figures come from EVE&apos;s forecasting engine, which recalculates safety stock and
                      demand trend independently of the live ledger. For the authoritative figure see{" "}
                      <a href="/dashboard/inventory" className="underline hover:text-foreground">Inventory Intelligence</a>.
                    </p>
                  </>
                ) : (
                  <div className="space-y-2">
                    {healthStatus && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Business health: </span>
                        {healthScore}/100 ({healthStatus})
                      </p>
                    )}
                    {risks.slice(0, 3).map((risk, idx) => (
                      <p key={`r-${idx}`} className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-medium text-rose-600 dark:text-rose-400">Risk · </span>
                        {risk.description}
                      </p>
                    ))}
                    {opportunities.slice(0, 3).map((opp, idx) => (
                      <p key={`o-${idx}`} className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">Opportunity · </span>
                        {opp.description}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Conversation */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto scrollbar-thin"
        >
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6">

            {isConversationEmpty ? (
              /* Empty state — greeting, then four prompts. Nothing else. */
              <div className="min-h-[52vh] flex flex-col items-center justify-center text-center">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                  <Brain size={20} />
                </div>
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                  What should we look at today?
                </h1>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  Ask about inventory, cash, margins or suppliers. EVE reads your live workspace data.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-8 w-full max-w-2xl">
                  {getSuggestedPrompts().map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendChat(prompt)}
                      className="text-left text-sm text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 hover:bg-muted/50 rounded-xl px-4 py-3 transition-colors cursor-pointer leading-snug"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-8">
                  <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
                  AI can make mistakes. Verify important financial, operational and inventory decisions.
                </p>
              </div>
            ) : (
              <div className="space-y-7">
                {/* Subtle system note, as the first thing in the transcript */}
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground text-center">
                  <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
                  AI can make mistakes. Verify important financial, operational and inventory decisions.
                </p>

                {messages.filter(m => m.id !== WELCOME_MESSAGE_ID).map((msg) => {
                  const isAssistant = msg.role === "assistant";
                  const agentData = msg.agent_data as any;

                  if (!isAssistant) {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[85%] bg-muted text-foreground rounded-2xl px-4 py-2.5 text-[15px] leading-7 whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex gap-3.5">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Brain size={14} />
                      </div>

                      <div className="flex-1 min-w-0">
                        {renderMarkdown(msg.content)}

                        {/* Streaming caret */}
                        {chatLoading && !msg.content && (
                          <span className="inline-block w-1.5 h-4 bg-foreground/40 align-middle animate-pulse rounded-sm" />
                        )}

                        {/* Confidence — one quiet line, only when known */}
                        {agentData?.confidence !== undefined && (
                          <p className="text-[11px] text-muted-foreground mt-2.5">
                            {agentData.agent || "COO Lead"} · {Math.round(agentData.confidence * 100)}% confidence
                            {agentData.telemetry?.latency_ms
                              ? ` · ${((agentData.telemetry.latency_ms || 0) / 1000).toFixed(1)}s`
                              : ""}
                          </p>
                        )}

                        {/* Onboarding pathway when EVE has no data to reason over */}
                        {((msg.content && msg.content.includes("Insufficient")) ||
                          (agentData?.governance_decisions?.data_sufficiency &&
                            (agentData.governance_decisions.data_sufficiency === "NO_DATA" ||
                              agentData.governance_decisions.data_sufficiency === "DATA_INSUFFICIENT"))) && (
                          <div className="mt-4 p-4 border border-border rounded-xl space-y-2.5">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              EVE needs workspace data before it can reason about this. Add data to get started:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <a
                                href="/dashboard/inventory"
                                className="text-xs font-medium px-2.5 py-1.5 border border-border hover:bg-muted rounded-lg transition-colors"
                              >
                                Set up inventory
                              </a>
                              <a
                                href="/dashboard/finance"
                                className="text-xs font-medium px-2.5 py-1.5 border border-border hover:bg-muted rounded-lg transition-colors"
                              >
                                Import sales &amp; costs
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Developer-only diagnostics */}
                        {developerMode && agentData?.findings_by_agent && Object.keys(agentData.findings_by_agent).length > 0 && (
                          <div className="mt-4 pt-3 border-t border-border space-y-2">
                            <span className="text-[11px] font-medium text-muted-foreground block">Agent findings</span>
                            {Object.entries(agentData.findings_by_agent).map(([agentName, list]: [string, any]) => (
                              <div key={agentName} className="text-xs">
                                <span className="font-medium text-foreground block mb-0.5">{agentName}</span>
                                <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                                  {list.map((item: string, idx: number) => (
                                    <li key={idx} className="leading-relaxed">{item}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}

                        {developerMode && showTelemetry && agentData?.telemetry && (
                          <div className="mt-4 pt-3 border-t border-border">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                              <div>
                                <span className="block text-muted-foreground">Latency</span>
                                <span className="font-medium text-foreground">{agentData.telemetry.latency_ms} ms</span>
                              </div>
                              <div>
                                <span className="block text-muted-foreground">Cost</span>
                                <span className="font-medium text-foreground">${agentData.telemetry.estimated_cost?.toFixed(6) || "0.000000"}</span>
                              </div>
                              <div>
                                <span className="block text-muted-foreground">Prompt tokens</span>
                                <span className="font-medium text-foreground">{agentData.telemetry.prompt_tokens}</span>
                              </div>
                              <div>
                                <span className="block text-muted-foreground">Completion tokens</span>
                                <span className="font-medium text-foreground">{agentData.telemetry.completion_tokens}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Thinking indicator, shown only before the first token lands */}
                {chatLoading && !messages[messages.length - 1]?.content && (
                  <div className="flex gap-3.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Brain size={14} />
                    </div>
                    <div className="flex items-center gap-1.5 h-7">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
                      {!isGreeting && (
                        <span className="text-xs text-muted-foreground ml-2">Reading your business data…</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 px-4 sm:px-6 pb-4 pt-1">
          <div className="max-w-3xl mx-auto w-full space-y-2">

            {documentId && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 border border-border rounded-lg text-xs text-muted-foreground">
                <span className="flex items-center gap-2 min-w-0">
                  <FileText size={13} className="flex-shrink-0" />
                  <span className="truncate">
                    Context: <strong className="font-medium text-foreground">{documentName || "Loading…"}</strong>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDocumentId(null);
                    setDocumentName(null);
                  }}
                  className="p-0.5 hover:text-foreground transition-colors cursor-pointer flex-shrink-0"
                  title="Remove document context"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {voiceError && (
              <div className="flex items-center gap-2 px-3 py-2 border border-rose-500/30 bg-rose-500/5 rounded-lg text-xs text-rose-600 dark:text-rose-400">
                <AlertTriangle size={13} className="flex-shrink-0" />
                <span>{voiceError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat(inputMessage);
              }}
              className="relative flex items-end gap-2 border border-border rounded-2xl bg-card px-3 py-2.5 focus-within:border-primary/50 transition-colors shadow-xs"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat(inputMessage);
                  }
                }}
                placeholder="Ask EVE anything about your business…"
                disabled={chatLoading}
                className="flex-1 min-w-0 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground resize-none outline-none leading-6 py-1 max-h-[200px] scrollbar-thin disabled:opacity-60"
              />

              <button
                type="button"
                onClick={handleVoiceInput}
                disabled={chatLoading}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 cursor-pointer disabled:opacity-40 ${
                  isListening
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title={isListening ? "Listening — click to stop" : "Voice input"}
              >
                <Mic size={16} />
              </button>

              <button
                type="submit"
                disabled={chatLoading || !inputMessage.trim()}
                className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:hover:bg-primary transition-colors flex-shrink-0 cursor-pointer"
                title="Send"
              >
                {chatLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Modals & drawers */}
      {isDailyBriefOpen && (
        <DailyBriefModal
          isOpen={isDailyBriefOpen}
          onClose={() => setIsDailyBriefOpen(false)}
          token={sessionToken}
          onAskFollowUp={handleFollowUpQuestion}
        />
      )}

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

      {isRecommendationsOpen && (
        <RecommendationHistoryPanel
          isOpen={isRecommendationsOpen}
          onClose={() => setIsRecommendationsOpen(false)}
          token={sessionToken}
        />
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-foreground">Delete conversation?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This permanently erases the chat history and its context.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 border border-border hover:bg-muted text-foreground rounded-lg text-sm font-medium cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSession(deleteConfirmId)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors"
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
