"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL } from "@/lib/api";
import { devLog } from "@/lib/logger";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  LogOut,
  Sparkles,
  AlertCircle,
  X,
  LayoutDashboard,
  Users,
  Briefcase,
  CheckSquare,
  DollarSign,
  Package,
  Activity,
  Settings,
  Menu,
  Brain,
  Sun,
  Moon,
  FileText,
  HelpCircle,
  Clock,
  Database,
} from "lucide-react";
import { ProductTour } from "@/components/dashboard/ProductTour";
import ProactiveAnalysisBanner from "@/components/dashboard/ProactiveAnalysisBanner";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

import { NAV_ITEMS } from "@/config/navigation";
import { apiFetch } from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const isExempt = profile?.email === "devottamkumar1310@gmail.com" || profile?.subscription_status === "founder";
  const [sessionToken, setSessionToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState(0);
  const [theme, setTheme] = useState("dark");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isProvenanceModalOpen, setIsProvenanceModalOpen] = useState(false);
  
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showAnalysisBanner, setShowAnalysisBanner] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("eve_analysis_pending") === "1";
    }
    return false;
  });
  const [analysisOrgId, setAnalysisOrgId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("eve_analysis_org_id") || null;
    }
    return null;
  });

  const DEMO_WORKSPACES = [
    { id: "demo-novawear", slug: "novawear", apiSlug: "novawear", name: "NovaWear Fashion" },
    { id: "demo-urban_threads", slug: "urban-threads", apiSlug: "urban_threads", name: "Urban Threads" },
    { id: "demo-essentials_co", slug: "essentials-co", apiSlug: "essentials_co", name: "Essentials Co." },
  ];

  const handleSelectDemo = async (demoSlug: string) => {
    setIsDropdownOpen(false);
    // Normalize slug: convert underscores to hyphens for DB comparison
    const normalizedSlug = demoSlug.replaceAll("_", "-");
    const existing = workspaces.find(w => w.slug.startsWith(normalizedSlug) || w.slug.startsWith(demoSlug));
    if (existing) {
      handleSwitchWorkspace(existing.id);
      return;
    }
    
    // Create on the fly
    setLoadingStage(2);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/organization/onboard-demo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ demo_company: demoSlug })
      });
      if (resp.ok) {
        const data = await resp.json();
        localStorage.setItem("active_workspace_id", data.organization_id);
        window.location.reload(); // Hard refresh to load new workspace
      }
    } catch (e) {
      logger.error("Failed to create demo workspace on the fly", e);
    }
  };


  const getRemainingDays = () => {
    if (!profile?.trial_end_date) return 0;
    const end = new Date(profile.trial_end_date);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const router = useRouter();
  const pathname = usePathname();
  const sessionTokenRef = useRef(sessionToken);

  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  // Load sidebar state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved === "true") {
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  // Listen for eve_analysis_started event from CSV upload pages
  useEffect(() => {
    const handleAnalysisStarted = () => {
      const orgId = localStorage.getItem("eve_analysis_org_id");
      if (orgId) {
        setAnalysisOrgId(orgId);
        setShowAnalysisBanner(true);
      }
    };
    window.addEventListener("eve_analysis_started", handleAnalysisStarted);
    return () => window.removeEventListener("eve_analysis_started", handleAnalysisStarted);
  }, []);

  // Theme Sync on Mount — resolves 'system' to the actual OS preference.
  useEffect(() => {
    const resolveTheme = (stored: string): string => {
      if (stored === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "executive-light";
      }
      return stored;
    };

    let stored = localStorage.getItem("theme") || "dark";
    if (!["system", "executive-light", "dark"].includes(stored)) {
      stored = "dark";
      localStorage.setItem("theme", "dark");
    }

    const active = resolveTheme(stored);
    setTheme(stored); // store the raw value ("system" etc.)
    document.documentElement.setAttribute("data-theme", active);

    // Listen for OS preference changes when theme is set to 'system'
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onOSChange = () => {
      if (localStorage.getItem("theme") === "system") {
        const resolved = mql.matches ? "dark" : "executive-light";
        document.documentElement.setAttribute("data-theme", resolved);
      }
    };
    mql.addEventListener("change", onOSChange);

    // Listen for custom settings theme-changed event
    const handleThemeEvent = () => {
      const updatedStored = localStorage.getItem("theme") || "executive-light";
      setTheme(updatedStored);
      const activeResolved = resolveTheme(updatedStored);
      document.documentElement.setAttribute("data-theme", activeResolved);
    };
    window.addEventListener("theme-changed", handleThemeEvent);

    return () => {
      mql.removeEventListener("change", onOSChange);
      window.removeEventListener("theme-changed", handleThemeEvent);
    };
  }, []);

  const getThemePreference = (profileData?: any): string => {
    if (profileData?.preferences?.theme) {
      return profileData.preferences.theme;
    }
    if (profile?.preferences?.theme) {
      return profile.preferences.theme;
    }
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "dark";
    }
    return "dark";
  };

  const setThemePreference = (newTheme: string) => {
    setTheme(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme);
      // Resolve 'system' to the actual OS preference before applying to DOM
      const resolved =
        newTheme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "executive-light"
          : newTheme;
      document.documentElement.setAttribute("data-theme", resolved);
      // Trigger event so other tabs/components sync theme immediately
      window.dispatchEvent(new Event("theme-changed"));
    }
  };

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const loadWorkspacesAndProfile = async (token: string) => {
    // Use AbortController to enforce a 15-second timeout per request.
    // This prevents an unresponsive backend from trapping users on the
    // loading screen indefinitely.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let profileSettled: PromiseSettledResult<Response>;
    let wsSettled: PromiseSettledResult<Response>;

    try {
      [profileSettled, wsSettled] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }),
        fetch(`${API_BASE_URL}/api/organization/workspaces`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }),
      ]);
    } finally {
      clearTimeout(timeoutId);
    }

    // --- Handle profile result independently ---
    if (profileSettled.status === "fulfilled" && profileSettled.value.ok) {
      try {
        const profileData = await profileSettled.value.json();
        setProfile(profileData);
        const activeTheme = getThemePreference(profileData);
        setTheme(activeTheme);
        document.documentElement.setAttribute("data-theme", activeTheme);
      } catch (e) {
        logger.warn("[EVE] Failed to parse profile response:", e);
      }
    } else {
      const reason =
        profileSettled.status === "rejected"
          ? profileSettled.reason?.name === "AbortError"
            ? "Profile request timed out"
            : String(profileSettled.reason)
          : `Profile API returned ${profileSettled.value.status}`;
      logger.warn("[EVE] Profile load failed (non-fatal):", reason);
      // Dashboard still loads — profile fields show fallback values
    }

    // --- Handle workspaces result independently ---
    if (wsSettled.status === "fulfilled" && wsSettled.value.ok) {
      try {
        const wsData = await wsSettled.value.json();
        setWorkspaces(wsData);
        if (wsData.length === 0) {
          // Single retry after a brief delay to absorb async provisioning lag
          // (e.g. demo workspace DB commit not yet visible at query time).
          // One attempt only — no polling, no loops.
          devLog("[EVE] Workspaces empty on first fetch - retrying once after 1500ms");
          await new Promise<void>((resolve) => setTimeout(resolve, 1500));
          try {
            const retryRes = await fetch(`${API_BASE_URL}/api/organization/workspaces`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (retryRes.ok) {
              const retryData: Workspace[] = await retryRes.json();
              if (retryData.length > 0) {
                devLog("[EVE] Retry succeeded - workspaces found:", retryData.length);
                setWorkspaces(retryData);
                const storedId = localStorage.getItem("active_workspace_id");
                if (storedId && retryData.some((w) => w.id === storedId)) {
                  setActiveWorkspaceId(storedId);
                } else {
                  localStorage.setItem("active_workspace_id", retryData[0].id);
                  setActiveWorkspaceId(retryData[0].id);
                }
                return;
              }
            }
          } catch (retryErr) {
            logger.warn("[EVE] Workspace retry fetch failed:", retryErr);
          }
          // Still empty after retry — user genuinely has no workspace.
          localStorage.removeItem("active_workspace_id");
          setActiveWorkspaceId(null);
          router.push("/onboarding");
          return;
        }
        const storedId = localStorage.getItem("active_workspace_id");
        if (storedId && wsData.some((w: Workspace) => w.id === storedId)) {
          setActiveWorkspaceId(storedId);
        } else if (wsData.length > 0) {
          localStorage.setItem("active_workspace_id", wsData[0].id);
          setActiveWorkspaceId(wsData[0].id);
        } else {
          localStorage.removeItem("active_workspace_id");
          setActiveWorkspaceId(null);
        }
      } catch (e) {
        logger.warn("[EVE] Failed to parse workspaces response:", e);
      }
    } else {
      const reason =
        wsSettled.status === "rejected"
          ? wsSettled.reason?.name === "AbortError"
            ? "Workspaces request timed out after 15 seconds"
            : String(wsSettled.reason)
          : `Workspaces API returned ${wsSettled.value.status}`;
      logger.error("[EVE] Workspaces load failed:", reason);
      // Propagate as an initError so the user sees an actionable message
      // instead of an infinite spinner.
      throw new Error(`Failed to load workspaces: ${reason}`);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function init() {
      devLog("[TELEMETRY][PERF] Dashboard Layout Init Start");
      const tStart = performance.now();
      const supabase = createClient();
      setLoadingStage(1); // Authenticating
      
      const proceedWithSession = async (token: string) => {
        const tHydrate = performance.now();
        devLog(`[TELEMETRY][PERF] Session Hydration Duration: ${(tHydrate - tStart).toFixed(2)}ms`);
        setSessionToken(token);
        sessionTokenRef.current = token; // Eagerly sync ref so onAuthStateChange guard works before React re-render
        const isAlreadyInitialized =
          typeof window !== "undefined" &&
          sessionStorage.getItem("eve_initialized") === "true";

        try {
          if (isAlreadyInitialized) {
            // Sprint 1 Fix #2: Do NOT setLoading(false) here before workspaces resolve.
            // The finally block handles setLoading(false) after the fetch completes.
            // Sprint 2 UX: advance stage so animation doesn't freeze at stage 1 for returning users.
            if (mounted) setLoadingStage(2);
            await loadWorkspacesAndProfile(token);
          } else {
            if (mounted) setLoadingStage(2); // Loading Workspace
            await loadWorkspacesAndProfile(token);
            if (mounted) setLoadingStage(3); // Loading Business Data
            if (mounted) setLoadingStage(4); // Preparing AI Executive
            if (typeof window !== "undefined") {
              sessionStorage.setItem("eve_initialized", "true");
            }
          }
          if (mounted) setInitError(null);
        } catch (err: any) {
          logger.error("[EVE] Dashboard initialization failed:", err);
          if (mounted) {
            const msg: string = err?.message ?? "";
            let userMessage: string;
            if (msg.includes("timed out")) {
              userMessage = "Connection timed out. Please check your network and try again.";
            } else if (msg.includes("401") || msg.includes("403")) {
              userMessage = "Your session has expired. Please sign out and sign back in.";
            } else if (
              msg.includes("Failed to fetch") ||
              msg.includes("NetworkError") ||
              msg.includes("TypeError")
            ) {
              userMessage = "Cannot reach the server. Please check your internet connection.";
            } else {
              userMessage = "Workspace initialization failed. Please retry or contact support.";
            }
            setInitError(userMessage);
          }
        } finally {
          const tFinish = performance.now();
          devLog(`[TELEMETRY][PERF] Workspace/Profile Load Duration: ${(tFinish - tHydrate).toFixed(2)}ms`);
          devLog(`[TELEMETRY][PERF] Time to Dashboard Interactive: ${(tFinish - tStart).toFixed(2)}ms`);
          if (mounted) setLoading(false);
        }
      };

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Sprint 1 Fix #1: await so onAuthStateChange is registered only AFTER
        // the first init completes. This eliminates the double-invocation race
        // where both getSession() and the INITIAL_SESSION event trigger concurrent
        // loadWorkspacesAndProfile calls.
        await proceedWithSession(session.access_token);
      }
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
        // P2-A: TOKEN_REFRESHED is Supabase rotating the access token (typically every 60 min).
        // The workspace and profile data hasn't changed — only the token value.
        // Update the token references directly and skip the full workspace re-fetch.
        if (event === 'TOKEN_REFRESHED' && newSession) {
          sessionTokenRef.current = newSession.access_token;
          setSessionToken(newSession.access_token);
          return;
        }
        if (newSession && (!sessionTokenRef.current || sessionTokenRef.current !== newSession.access_token)) {
          proceedWithSession(newSession.access_token);
        } else if (!newSession && event === 'SIGNED_OUT') {
          router.push("/login");
        }
      });
      
      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }
    
    const cleanup = init();
    return () => {
      cleanup.then(clean => clean && clean());
    };
  }, [router]);

  const handleSwitchWorkspace = (id: string) => {
    localStorage.setItem("active_workspace_id", id);
    setActiveWorkspaceId(id);
    setIsDropdownOpen(false);
    // When switching workspaces, we want a fresh bootstrap animation to load the new workspace assets/reasoning context
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("eve_initialized");
    }
    window.location.reload();
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/organization/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ name: newWorkspaceName }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to create workspace");
      }
      const data = await response.json();
      localStorage.setItem("active_workspace_id", data.organization_id);
      setIsCreateModalOpen(false);
      setNewWorkspaceName("");
      window.location.reload();
    } catch {
      setCreateError("Workspace creation is currently synchronizing. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateDemoWorkspace = async () => {
    setDemoLoading(true);
    setCreateError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/organization/onboard-demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to launch demo workspace");
      }
      const data = await response.json();
      localStorage.setItem("active_workspace_id", data.organization_id);
      
      // Clear tour state so they get the tour
      localStorage.removeItem("eve_tour_completed");

      // Persist analysis banner state across reload
      localStorage.setItem("eve_analysis_pending", "1");
      localStorage.setItem("eve_analysis_org_id", data.organization_id);

      window.location.reload();
    } catch {
      setCreateError("Demo environment is currently initializing. Please try again shortly.");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Intentionally DO NOT remove active_workspace_id from localStorage.
    // This ensures the user's workspace selection persists across logins.
    // The onboarding page and dashboard layout handle workspace restoration.
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("eve_initialized");
    }
    router.push("/login");
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const isDemoWorkspace = activeWorkspace?.slug.startsWith("novawear") || activeWorkspace?.slug.startsWith("urban-threads") || activeWorkspace?.slug.startsWith("essentials-co");

  if (loading || (!activeWorkspaceId && !initError)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground font-sans">
        <div className="w-full max-w-sm bg-card backdrop-blur-md rounded-2xl border border-border p-8 shadow-2xl space-y-6 animate-fade-in">
          <div className="flex justify-center mb-2">
            <div className="h-14 w-14 bg-gradient-to-tr from-violet-700 to-purple-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl animate-pulse shadow-lg shadow-violet-600/30">
              EVE
            </div>
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold tracking-tight">Initializing EVE AI OS</h3>
            <p className="text-xs text-muted-foreground">Setting up executive operations context</p>
          </div>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-sm transition-all duration-300">
              {loadingStage >= 2 ? (
                <span className="text-violet-400 font-bold">✓</span>
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
              )}
              <span className={loadingStage >= 2 ? "text-muted-foreground line-through decoration-violet-500/50" : "text-foreground font-medium"}>
                Authenticating session
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-sm transition-all duration-300">
              {loadingStage >= 3 ? (
                <span className="text-violet-400 font-bold">✓</span>
              ) : loadingStage === 2 ? (
                <div className="h-4 w-4 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-secondary ml-1" />
              )}
              <span className={loadingStage >= 3 ? "text-muted-foreground line-through decoration-violet-500/50" : loadingStage === 2 ? "text-foreground font-medium animate-pulse" : "text-muted-foreground"}>
                Loading active workspace
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-sm transition-all duration-300">
              {loadingStage >= 4 ? (
                <span className="text-violet-400 font-bold">✓</span>
              ) : loadingStage === 3 ? (
                <div className="h-4 w-4 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-secondary ml-1" />
              )}
              <span className={loadingStage >= 4 ? "text-muted-foreground line-through decoration-violet-500/50" : loadingStage === 3 ? "text-foreground font-medium animate-pulse" : "text-muted-foreground"}>
                Loading business metrics & datasets
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-sm transition-all duration-300">
              {loadingStage === 4 ? (
                <div className="h-4 w-4 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-secondary ml-1" />
              )}
              <span className={loadingStage === 4 ? "text-violet-300 font-semibold animate-pulse" : "text-muted-foreground"}>
                Preparing AI Executive portal...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground font-sans">
        <div className="w-full max-w-sm bg-card backdrop-blur-md rounded-2xl border border-red-900/40 p-8 shadow-2xl space-y-6 animate-fade-in">
          <div className="flex justify-center mb-2">
            <div className="h-14 w-14 bg-gradient-to-tr from-red-700 to-rose-600 rounded-2xl flex items-center justify-center text-foreground font-bold text-2xl shadow-lg shadow-red-500/20">
              <AlertCircle size={28} />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold tracking-tight text-red-400">Connection Failed</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{initError}</p>
          </div>
          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                setInitError(null);
                setLoading(true);
                setLoadingStage(1);
                if (typeof window !== "undefined") {
                  sessionStorage.removeItem("eve_initialized");
                }
                window.location.reload();
              }}
              className="w-full py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md cursor-pointer"
            >
              Retry Connection
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-2.5 px-4 bg-transparent border border-border hover:border-slate-500 text-muted-foreground hover:text-foreground rounded-xl text-sm font-medium transition-all cursor-pointer"
            >
              Sign Out
            </button>
            <p className="text-center text-[10px] text-muted-foreground pt-1">
              Support: <a href="mailto:support@eveinventory.in" className="hover:text-indigo-400 underline">support@eveinventory.in</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans transition-colors duration-200">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-40 flex flex-col transition-all duration-200 eve-sidebar-atmosphere ${
 isSidebarCollapsed ? "w-64 md:w-16" : "w-64"
 } ${
 sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
 }`}
      >
        {/* Sidebar Brand */}
        <div className={`flex items-center border-b border-sidebar-border transition-all ${
 isSidebarCollapsed ? "px-5 py-5 md:px-3 md:py-5 md:justify-center" : "gap-3 px-5 py-5"
 }`}>
          <div
            onClick={() => router.push("/dashboard/inventory")}
            className="h-9 w-9 bg-gradient-to-tr from-violet-700 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm tracking-tighter cursor-pointer hover:opacity-90 transition-all shadow-md shadow-violet-700/25 flex-shrink-0"
          >
            EVE
          </div>
          <div className={`flex flex-col min-w-0 animate-fade-in ${isSidebarCollapsed ? "md:hidden block" : "block"}`}>
            <span className="font-bold text-foreground text-xs tracking-tight leading-none">EVE PORTAL</span>
            <span className="text-[9px] text-muted-foreground font-medium tracking-wider uppercase mt-0.5">Inventory Intelligence</span>
          </div>
          
          <button
            onClick={toggleSidebar}
            className="ml-auto p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-sidebar-accent transition-colors hidden md:block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>

          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto text-muted-foreground hover:text-muted-foreground md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-1"
            aria-label="Close navigation menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-none">
          {NAV_ITEMS.map((group) => (
            <div key={group.label}>
              <p className={`text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2 ${isSidebarCollapsed ? "md:hidden block" : "block"}`}>
                {group.label}
              </p>
              <div className={`h-px bg-sidebar-border my-4 ${isSidebarCollapsed ? "md:block hidden" : "hidden"}`} />
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href, (item as any).exact);
                  const isItemDisabled = !activeWorkspaceId && item.href !== "/dashboard/settings";
                  return (
                    <Link
                      key={item.href}
                      href={isItemDisabled ? "#" : item.href}
                      onClick={(e) => {
                        if (isItemDisabled) {
                          e.preventDefault();
                          return;
                        }
                        setSidebarOpen(false);
                      }}
                      title={isSidebarCollapsed ? item.label : undefined}
                      className={`flex items-center rounded-lg text-sm font-medium transition-all group relative ${
 isSidebarCollapsed ? "justify-start gap-3 px-3 py-2 md:justify-center md:p-2.5 md:mx-1" : "gap-3 px-3 py-2"
 } ${
 isItemDisabled
 ? "opacity-45 cursor-not-allowed text-muted-foreground"
 : active
 ? "bg-violet-600/10 text-violet-400 border-l-2 border-violet-500 pl-[10px]"
 : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
 } ${
 (item as any).isAI && !active && !isItemDisabled
 ? "hover:bg-violet-900/30 hover:text-violet-300"
 : ""
 }`}
                    >
                      <Icon size={15} className={active && !isItemDisabled ? "text-violet-400" : "text-muted-foreground group-hover:text-muted-foreground"} />
                      <span className={`animate-fade-in ${isSidebarCollapsed ? "md:hidden block" : "block"}`}>{item.label}</span>
                      {(item as any).isAI && (
                        <span className={`ml-auto text-[9px] font-bold bg-violet-600 text-white px-1.5 py-0.5 rounded-full tracking-wide ${isSidebarCollapsed ? "md:hidden block" : "block"}`}>NEW</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: Active Workspace */}
        <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
          <div 
            className={`flex items-center rounded-lg bg-sidebar-accent/60 transition-all ${
 isSidebarCollapsed ? "justify-start gap-2 px-2 py-2 md:justify-center md:p-2" : "gap-2 px-2 py-2"
 }`}
            title={isSidebarCollapsed ? activeWorkspace?.name || "No workspace" : undefined}
          >
            <Building2 size={14} className="text-violet-400 flex-shrink-0" />
            <div className={`flex flex-col ${isSidebarCollapsed ? "md:hidden block" : "block"} truncate animate-fade-in`}>
              <span className="text-xs text-muted-foreground font-medium truncate">
                {activeWorkspace?.name || "No workspace"}
              </span>
              {(activeWorkspace?.slug.startsWith("novawear") || activeWorkspace?.slug.startsWith("urban-threads") || activeWorkspace?.slug.startsWith("essentials-co")) && (
                <span className="text-[9px] text-blue-400 font-medium truncate mt-0.5">
                  Demo Workspace • Based on Public E-commerce Data
                </span>
              )}
            </div>
          </div>
          <div className={`text-[10px] text-slate-550 text-center mt-1 leading-normal ${isSidebarCollapsed ? "md:hidden block" : "block"}`}>
            Support: <a href="mailto:support@eveinventory.in" className="hover:text-indigo-400 underline">support@eveinventory.in</a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-200 ${
 isSidebarCollapsed ? "md:ml-16" : "md:ml-64"
 }`}>
        {/* Top Header */}
        <header className="sticky top-0 z-20 w-full bg-sidebar border-b border-sidebar-border text-sidebar-foreground transition-colors duration-200 eve-header-atmosphere">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>

            {/* Spacer for desktop */}
            <div className="hidden md:block" />

            {/* Right: Workspace Switcher + User */}
            <div className="flex items-center gap-3">
              {/* Trial Status Badge */}
              {profile?.subscription_status === "trial" && !isExempt && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-[11px] font-semibold text-violet-400">
                  <Clock size={11} className="animate-pulse" />
                  <span>
                    {(() => {
                      const days = getRemainingDays();
                      if (days <= 0) return "Trial Ended";
                      return `${days} ${days === 1 ? "day" : "days"} left`;
                    })()}
                  </span>
                </div>
              )}
              
              {/* Dataset Provenance Badge */}
              {isDemoWorkspace && (
                <button
                  onClick={() => setIsProvenanceModalOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 rounded-full text-[11px] font-semibold text-blue-400 transition-colors"
                >
                  <Database size={11} />
                  <span>Demo Dataset</span>
                </button>
              )}

              {/* Theme Toggler */}
              <button
                onClick={() => setThemePreference(theme === "dark" ? "executive-light" : "dark")}
                className="p-2 text-muted-foreground hover:text-violet-400 hover:bg-sidebar-accent rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              {/* Workspace Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-sidebar-accent/80 hover:bg-sidebar-accent border border-sidebar-border rounded-lg text-sm font-medium text-sidebar-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Switch workspace"
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <Building2 size={14} className="text-violet-400 flex-shrink-0" />
                  <div className="flex flex-col items-start max-w-[140px] truncate">
                    <span className="truncate w-full text-left">{activeWorkspace?.name || "Select Workspace"}</span>
                    {(activeWorkspace?.slug.startsWith("novawear") || activeWorkspace?.slug.startsWith("urban-threads") || activeWorkspace?.slug.startsWith("essentials-co")) && (
                      <span className="text-[9px] text-blue-400 font-medium truncate w-full text-left leading-none">
                        Demo Workspace
                      </span>
                    )}
                  </div>
                  <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-60 bg-sidebar border border-sidebar-border rounded-xl shadow-xl z-50 overflow-hidden text-sidebar-foreground">
                      <div className="p-3 border-b border-sidebar-border bg-sidebar-accent/30">
                        <span className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">Demo Workspaces</span>
                      </div>
                      <div className="py-1">
                        {DEMO_WORKSPACES.map((ws) => {
                          const isMatch = activeWorkspace?.slug.startsWith(ws.slug);
                          return (
                            <button
                              key={ws.id}
                              onClick={() => handleSelectDemo(ws.apiSlug)}
                              className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-sidebar-accent transition-colors ${
                                isMatch ? "text-violet-400 font-bold" : "text-sidebar-foreground"
                              }`}
                            >
                              <div className="flex flex-col items-start truncate max-w-[180px]">
                                <span className="truncate">{ws.name}</span>
                                <span className="text-[9px] text-blue-400 font-medium truncate mt-0.5">
                                  Demo Workspace
                                </span>
                              </div>
                              {isMatch && <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      <div className="p-3 border-y border-sidebar-border bg-sidebar-accent/30 mt-2">
                        <span className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">My Workspaces</span>
                      </div>
                      <div className="py-1 max-h-48 overflow-y-auto">
                        {workspaces.filter(w => !w.slug.startsWith("novawear") && !w.slug.startsWith("urban-threads") && !w.slug.startsWith("essentials-co") && !w.slug.startsWith("urban_threads") && !w.slug.startsWith("essentials_co")).map((ws) => (
                          <button
                            key={ws.id}
                            onClick={() => handleSwitchWorkspace(ws.id)}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-sidebar-accent transition-colors ${
                              ws.id === activeWorkspaceId ? "text-violet-400 font-bold" : "text-sidebar-foreground"
                            }`}
                          >
                            <div className="flex flex-col items-start truncate max-w-[180px]">
                              <span className="truncate">{ws.name}</span>
                            </div>
                            {ws.id === activeWorkspaceId && <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />}
                          </button>
                        ))}
                        {workspaces.filter(w => !w.slug.startsWith("novawear") && !w.slug.startsWith("urban-threads") && !w.slug.startsWith("essentials-co") && !w.slug.startsWith("urban_threads") && !w.slug.startsWith("essentials_co")).length === 0 && (
                          <div className="px-4 py-3 text-sm text-muted-foreground italic">No personal workspaces</div>
                        )}
                      </div>
                      <div className="p-2 border-t border-sidebar-border">
                        <button
                          onClick={() => { setIsDropdownOpen(false); setIsCreateModalOpen(true); }}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition-all"
                        >
                          <Plus size={12} /> Create Workspace
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="h-5 w-px bg-sidebar-border" />

              {/* Profile */}
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold text-foreground leading-none">{profile?.full_name || "Guest"}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">{profile?.email || ""}</span>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-muted-foreground hover:text-red-400 hover:bg-sidebar-accent rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background text-foreground transition-colors duration-200 eve-dashboard-main">
          {(() => {
            const days = getRemainingDays();
            const isTrialExpired = profile?.subscription_status === "trial" && days <= 0;
            const showSoftExpiry = isTrialExpired && !isExempt;
            
            const showPreExpiry = 
              profile?.subscription_status === "trial" && 
              !isExempt &&
              !bannerDismissed && 
              [7, 3, 1].includes(days);

            return (
              <>
                {showSoftExpiry && (
                  <div className="px-6 py-3.5 bg-gradient-to-r from-red-950/20 to-rose-950/20 border-b border-red-500/30 text-foreground flex flex-col sm:flex-row items-center justify-between gap-3 text-sm animate-fade-in z-20 relative">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                      <span>
                        Your trial has ended. Please request a trial extension to restore access.
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = "mailto:support@eveinventory.in?subject=EVE%20Trial%20Extension%20Request";
                        }}
                        className="px-3.5 py-1.5 bg-sidebar-accent border border-sidebar-border hover:bg-sidebar-accent/80 text-foreground text-xs font-semibold rounded-lg transition-all cursor-pointer"
                      >
                        Request Extension
                      </button>
                    </div>
                  </div>
                )}

                {showPreExpiry && (
                  <div className="px-6 py-3.5 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border-b border-indigo-500/20 text-foreground flex flex-col sm:flex-row items-center justify-between gap-3 text-sm animate-fade-in z-20 relative">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-indigo-400 flex-shrink-0" />
                      <span>
                        Enjoying EVE? Paid plans are coming soon. <strong>{days} {days === 1 ? "day" : "days"} remaining</strong> on your trial.
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setBannerDismissed(true)}
                        className="p-1 hover:bg-sidebar-accent rounded text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {!activeWorkspaceId && pathname !== "/dashboard/settings" && pathname !== "/dashboard/help" ? (
                  <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6 flex flex-col justify-center min-h-[85vh]">
                    <div className="bg-card/80 backdrop-blur-md rounded-3xl border border-border shadow-2xl overflow-hidden p-8 md:p-12 text-center space-y-8 max-w-3xl mx-auto relative">
                      <div className="absolute -top-24 -left-24 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
                      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                      
                      <div className="flex justify-center">
                        <div className="h-20 w-20 bg-gradient-to-tr from-violet-700 to-purple-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-violet-600/25 animate-pulse">
                          <Sparkles size={38} />
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">Welcome to EVE</h2>
                        <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                          Your inventory forecasting and planning platform. Choose how you would like to begin exploring the platform.
                        </p>
                      </div>

                      {createError && (
                        <div className="p-4 bg-red-950/40 text-red-400 text-xs rounded-xl border border-red-800/50 text-left flex items-start gap-2 max-w-xl mx-auto">
                          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                          <span>{createError}</span>
                        </div>
                      )}

                      {!showManualForm ? (
                        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto pt-4">
                          <button
                            onClick={handleCreateDemoWorkspace}
                            disabled={demoLoading || createLoading}
                            className="group relative flex flex-col text-left p-6 bg-background hover:bg-background border border-border hover:border-violet-500/40 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-violet-500/5 cursor-pointer disabled:opacity-50 overflow-hidden"
                          >
                            {demoLoading && (
                              <div className="absolute inset-0 bg-background backdrop-blur-xs flex items-center justify-center z-10">
                                <div className="flex flex-col items-center gap-3">
                                  <div className="h-8 w-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
                                  <span className="text-xs text-violet-400 font-semibold animate-pulse">Launching demo...</span>
                                </div>
                              </div>
                            )}
                            <div className="h-10 w-10 bg-violet-900/30 group-hover:bg-violet-600/20 text-violet-400 rounded-lg flex items-center justify-center mb-4 transition-all">
                              <Sparkles size={20} />
                            </div>
                            <h4 className="text-base font-bold text-foreground group-hover:text-violet-400 transition-colors">Option A: Launch Demo Workspace</h4>
                            <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                              Explore EVE using a realistic fashion business (<strong>NovaWear Fashion</strong>) with preloaded sales, inventory, customers, expenses, risks, and executive insights.
                            </p>
                            <div className="mt-auto pt-6 flex items-center text-xs font-semibold text-violet-400 group-hover:text-violet-300">
                              Launch Demo & Explore &rarr;
                            </div>
                          </button>

                          <button
                            onClick={() => setShowManualForm(true)}
                            disabled={demoLoading || createLoading}
                            className="group flex flex-col text-left p-6 bg-background hover:bg-background border border-border hover:border-violet-500/50 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-purple-500/5 cursor-pointer disabled:opacity-50"
                          >
                            <div className="h-10 w-10 bg-purple-900/30 group-hover:bg-purple-600/20 text-purple-400 rounded-lg flex items-center justify-center mb-4 transition-all">
                              <Plus size={20} />
                            </div>
                            <h4 className="text-base font-bold text-foreground group-hover:text-purple-400 transition-colors">Option B: Create My Own</h4>
                            <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                              Start fresh with your own brand details, upload your own business datasets/documents, and construct a custom operations workspace.
                            </p>
                            <div className="mt-auto pt-6 flex items-center text-xs font-semibold text-purple-400 group-hover:text-purple-300">
                              Create Custom Workspace &rarr;
                            </div>
                          </button>
                        </div>
                      ) : (
                        <div className="max-w-md mx-auto space-y-4 pt-2">
                          <div className="text-left mb-2">
                            <button
                              onClick={() => setShowManualForm(false)}
                              className="text-xs text-muted-foreground hover:text-muted-foreground flex items-center gap-1 transition-colors"
                            >
                              &larr; Back to options
                            </button>
                          </div>
                          <form onSubmit={handleCreateWorkspace} className="space-y-4 text-left">
                            <div>
                              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Workspace / Brand Name</label>
                              <input
                                type="text"
                                required
                                value={newWorkspaceName}
                                onChange={(e) => setNewWorkspaceName(e.target.value)}
                                placeholder="e.g. Acme Clothing"
                                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm placeholder-slate-600"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={createLoading || !newWorkspaceName.trim()}
                              className="w-full flex justify-center items-center py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md disabled:opacity-50 cursor-pointer"
                            >
                              {createLoading ? "Creating Workspace..." : "Create Workspace"}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {activeWorkspaceId && showAnalysisBanner && (
                      <ProactiveAnalysisBanner
                        organizationId={analysisOrgId ?? activeWorkspaceId}
                        sessionToken={sessionToken}
                        onComplete={() => {
                          localStorage.removeItem("eve_analysis_pending");
                          localStorage.removeItem("eve_analysis_org_id");
                          router.refresh();
                        }}
                        onDismiss={() => {
                          setShowAnalysisBanner(false);
                          localStorage.removeItem("eve_analysis_pending");
                          localStorage.removeItem("eve_analysis_org_id");
                          router.push("/dashboard/traceability");
                        }}
                      />
                    )}
                    {children}
                  </>
                )}
              </>
            );
          })()}
        </main>
      </div>

      {/* Create Workspace Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-background backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Building2 className="text-indigo-600" size={20} /> Create New Workspace
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-sidebar-accent text-muted-foreground">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateWorkspace} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Workspace / Brand Name</label>
                <input
                  type="text"
                  required
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="e.g. Acme Fashion Corp"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 border border-border text-foreground hover:bg-sidebar-accent rounded-lg text-sm font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={createLoading || !newWorkspaceName.trim()} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                  {createLoading ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dataset Provenance Modal */}
      {isProvenanceModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-sidebar-accent/30">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Database className="text-blue-500" size={20} /> Dataset Information
              </h3>
              <button onClick={() => setIsProvenanceModalOpen(false)} className="p-1 rounded-lg hover:bg-sidebar-accent text-muted-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">
                Based on a real publicly available e-commerce dataset and transformed into realistic fashion inventory businesses for demonstration purposes.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Dataset</span>
                  <span className="font-medium text-foreground text-right w-2/3">Olist Brazilian E-Commerce Public Dataset</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Source</span>
                  <span className="font-medium text-foreground text-right w-2/3">Official Olist Public Dataset</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>License</span>
                  <span className="font-medium text-foreground text-right w-2/3">Open-source (CC BY-NC-SA 4.0)</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Purpose</span>
                  <span className="font-medium text-foreground text-right w-2/3">Adapted into realistic fashion inventory businesses to demonstrate EVE's Inventory Intelligence capabilities.</span>
                </div>
                <div className="flex justify-between pb-2">
                  <span>Transformations</span>
                  <span className="font-medium text-foreground text-right w-2/3 leading-tight">Product categorization, Inventory reconstruction, Lead time estimation, Financial aggregation, Recommendation generation, Business scenario simulation.</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border bg-sidebar-accent/30 flex justify-end">
              <button onClick={() => setIsProvenanceModalOpen(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
      

      

      {activeWorkspaceId && <ProductTour />}
    </div>
  );
}
