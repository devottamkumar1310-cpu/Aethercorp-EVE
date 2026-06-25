"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL } from "@/lib/api";
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
  MessageSquare,
  Sun,
  Moon,
  FileText,
  HelpCircle,
} from "lucide-react";
import FeedbackModal from "@/components/business/FeedbackModal";
import { ProductTour } from "@/components/dashboard/ProductTour";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

const navItems = [
  {
    label: "INTELLIGENCE",
    items: [
      { href: "/dashboard/eve", label: "AI Command Center", icon: Brain, isAI: true },
      { href: "/dashboard/documents", label: "Document Hub", icon: FileText, isAI: true },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { href: "/dashboard", label: "Operations Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/clients", label: "Clients", icon: Users },
      { href: "/dashboard/projects", label: "Projects", icon: Briefcase },
      { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/dashboard/finance", label: "Finance", icon: DollarSign },
      { href: "/dashboard/inventory", label: "Inventory", icon: Package },
      { href: "/dashboard/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
      { href: "/dashboard/help", label: "Help & Learning", icon: HelpCircle },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
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
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Load sidebar state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved === "true") {
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  // Theme Sync on Mount
  useEffect(() => {
    const activeTheme = localStorage.getItem("theme") || "dark";
    setTheme(activeTheme);
    if (activeTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
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
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    // Future integration point: update preferences table in backend if needed
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
    try {
      const profileRes = await fetch(`${API_BASE_URL}/api/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
        
        // Sync theme preference if available in profile data
        const activeTheme = getThemePreference(profileData);
        setTheme(activeTheme);
        if (activeTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }

      const wsRes = await fetch(`${API_BASE_URL}/api/organization/workspaces`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (wsRes.ok) {
        const wsData = await wsRes.json();
        setWorkspaces(wsData);
        if (wsData.length === 0) {
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
      }
    } catch (e) {
      console.error("Failed to load workspace/profile", e);
    }
  };

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      setLoadingStage(1); // Authenticating
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setSessionToken(session.access_token);
      
      const isAlreadyInitialized = typeof window !== "undefined" && sessionStorage.getItem("eve_initialized") === "true";
      
      if (isAlreadyInitialized) {
        setLoading(false);
        await loadWorkspacesAndProfile(session.access_token);
      } else {
        setLoadingStage(2); // Loading Workspace
        await new Promise(r => setTimeout(r, 450));
        
        await loadWorkspacesAndProfile(session.access_token);
        
        setLoadingStage(3); // Loading Business Data
        await new Promise(r => setTimeout(r, 450));
        
        setLoadingStage(4); // Preparing AI Executive
        await new Promise(r => setTimeout(r, 500));
        
        setLoading(false);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("eve_initialized", "true");
        }
      }
    }
    init();
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
    } catch (err: any) {
      setCreateError(err.message);
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
      
      window.location.reload();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem("active_workspace_id");
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("eve_initialized");
    }
    router.push("/login");
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  if (loading || !activeWorkspaceId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-8 shadow-2xl space-y-6 animate-fade-in">
          <div className="flex justify-center mb-2">
            <div className="h-14 w-14 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl animate-pulse shadow-lg shadow-indigo-500/30">
              EVE
            </div>
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold tracking-tight">Initializing EVE AI OS</h3>
            <p className="text-xs text-slate-400">Setting up executive operations context</p>
          </div>
          
          <div className="space-y-3 pt-2">
            {/* Stage 1 */}
            <div className="flex items-center gap-3 text-sm transition-all duration-300">
              {loadingStage >= 2 ? (
                <span className="text-indigo-400 font-bold">✓</span>
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              )}
              <span className={loadingStage >= 2 ? "text-slate-400 line-through decoration-indigo-500/50" : "text-white font-medium"}>
                Authenticating session
              </span>
            </div>
            
            {/* Stage 2 */}
            <div className="flex items-center gap-3 text-sm transition-all duration-300">
              {loadingStage >= 3 ? (
                <span className="text-indigo-400 font-bold">✓</span>
              ) : loadingStage === 2 ? (
                <div className="h-4 w-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-slate-800 ml-1" />
              )}
              <span className={loadingStage >= 3 ? "text-slate-400 line-through decoration-indigo-500/50" : loadingStage === 2 ? "text-white font-medium animate-pulse" : "text-slate-500"}>
                Loading active workspace
              </span>
            </div>
            
            {/* Stage 3 */}
            <div className="flex items-center gap-3 text-sm transition-all duration-300">
              {loadingStage >= 4 ? (
                <span className="text-indigo-400 font-bold">✓</span>
              ) : loadingStage === 3 ? (
                <div className="h-4 w-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-slate-800 ml-1" />
              )}
              <span className={loadingStage >= 4 ? "text-slate-400 line-through decoration-indigo-500/50" : loadingStage === 3 ? "text-white font-medium animate-pulse" : "text-slate-500"}>
                Loading business metrics & datasets
              </span>
            </div>
            
            {/* Stage 4 */}
            <div className="flex items-center gap-3 text-sm transition-all duration-300">
              {loadingStage === 4 ? (
                <div className="h-4 w-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-slate-800 ml-1" />
              )}
              <span className={loadingStage === 4 ? "text-indigo-300 font-semibold animate-pulse" : "text-slate-500"}>
                Preparing AI Executive portal...
              </span>
            </div>
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
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-40 flex flex-col transition-all duration-200 ${
          isSidebarCollapsed ? "w-16" : "w-64"
        } ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Sidebar Brand */}
        <div className={`flex items-center border-b border-sidebar-border transition-all ${
          isSidebarCollapsed ? "px-3 py-5 justify-center" : "gap-3 px-5 py-5"
        }`}>
          <div
            onClick={() => router.push("/dashboard/eve")}
            className="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm tracking-tighter cursor-pointer hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 flex-shrink-0"
          >
            EVE
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0 animate-fade-in">
              <span className="font-bold text-slate-100 dark:text-slate-200 text-xs tracking-tight leading-none">EVE PORTAL</span>
              <span className="text-[9px] text-slate-500 font-medium tracking-wider uppercase mt-0.5">Enterprise Virtual Executive</span>
            </div>
          )}
          
          <button
            onClick={toggleSidebar}
            className="ml-auto p-1 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-sidebar-accent transition-colors hidden md:block"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>

          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto text-slate-600 hover:text-slate-400 md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-none">
          {navItems.map((group) => (
            <div key={group.label}>
              {!isSidebarCollapsed ? (
                <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest px-3 mb-2">
                  {group.label}
                </p>
              ) : (
                <div className="h-px bg-sidebar-border my-4" />
              )}
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
                        isSidebarCollapsed ? "justify-center p-2.5 mx-1" : "gap-3 px-3 py-2"
                      } ${
                        isItemDisabled
                          ? "opacity-45 cursor-not-allowed text-slate-600"
                          : active
                          ? "bg-indigo-600/15 text-indigo-400 border-l-2 border-indigo-500 pl-[10px]"
                          : "text-slate-400 hover:text-slate-100 hover:bg-sidebar-accent"
                      } ${
                        (item as any).isAI && !active && !isItemDisabled
                          ? "hover:bg-indigo-900/30 hover:text-indigo-300"
                          : ""
                      }`}
                    >
                      <Icon size={15} className={active && !isItemDisabled ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"} />
                      {!isSidebarCollapsed && <span className="animate-fade-in">{item.label}</span>}
                      {!isSidebarCollapsed && (item as any).isAI && (
                        <span className="ml-auto text-[9px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full tracking-wide">NEW</span>
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
              isSidebarCollapsed ? "justify-center p-2" : "gap-2 px-2 py-2"
            }`}
            title={isSidebarCollapsed ? activeWorkspace?.name || "No workspace" : undefined}
          >
            <Building2 size={14} className="text-indigo-400 flex-shrink-0" />
            {!isSidebarCollapsed && (
              <span className="text-xs text-slate-300 font-medium truncate animate-fade-in">
                {activeWorkspace?.name || "No workspace"}
              </span>
            )}
          </div>
          <button
            onClick={() => window.open("https://forms.gle/qETMVJfDzHnF86xi7", "_blank")}
            title={isSidebarCollapsed ? "Give Beta Feedback" : undefined}
            className={`w-full flex items-center rounded-lg text-xs font-semibold text-slate-400 hover:text-indigo-400 hover:bg-sidebar-accent transition-all border border-sidebar-border hover:border-sidebar-border bg-sidebar-accent/40 ${
              isSidebarCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
            }`}
          >
            <MessageSquare size={13} className="text-indigo-400" />
            {!isSidebarCollapsed && <span className="animate-fade-in">Give Beta Feedback</span>}
          </button>
          {!isSidebarCollapsed && (
            <div className="text-[10px] text-slate-550 text-center mt-1 leading-normal">
              Support: <a href="mailto:aethercorp.support@gmail.com" className="hover:text-indigo-400 underline">aethercorp.support@gmail.com</a>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-200 ${
        isSidebarCollapsed ? "md:ml-16" : "md:ml-64"
      }`}>
        {/* Top Header */}
        <header className="sticky top-0 z-20 w-full bg-sidebar border-b border-sidebar-border text-sidebar-foreground transition-colors duration-200">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-sidebar-accent rounded-lg transition-colors"
            >
              <Menu size={18} />
            </button>

            {/* Spacer for desktop */}
            <div className="hidden md:block" />

            {/* Right: Workspace Switcher + User */}
            <div className="flex items-center gap-3">
              {/* Theme Toggler */}
              <button
                onClick={() => setThemePreference(theme === "dark" ? "light" : "dark")}
                className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-sidebar-accent rounded-lg transition-all"
                title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              {/* Workspace Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-sidebar-accent/80 hover:bg-sidebar-accent border border-sidebar-border rounded-lg text-sm font-medium text-sidebar-foreground transition-all"
                >
                  <Building2 size={14} className="text-indigo-400" />
                  <span className="max-w-[140px] truncate">{activeWorkspace?.name || "Select Workspace"}</span>
                  <ChevronDown size={12} className="text-slate-400" />
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-60 bg-sidebar border border-sidebar-border rounded-xl shadow-xl z-50 overflow-hidden text-sidebar-foreground">
                      <div className="p-3 border-b border-sidebar-border bg-sidebar-accent/30">
                        <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">My Workspaces</span>
                      </div>
                      <div className="py-1 max-h-48 overflow-y-auto">
                        {workspaces.map((ws) => (
                          <button
                            key={ws.id}
                            onClick={() => handleSwitchWorkspace(ws.id)}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-sidebar-accent transition-colors ${
                              ws.id === activeWorkspaceId ? "text-indigo-400 font-bold" : "text-sidebar-foreground"
                            }`}
                          >
                            <span className="truncate">{ws.name}</span>
                            {ws.id === activeWorkspaceId && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />}
                          </button>
                        ))}
                        {workspaces.length === 0 && (
                          <div className="px-4 py-3 text-sm text-slate-500 italic">No active workspaces</div>
                        )}
                      </div>
                      <div className="p-2 border-t border-sidebar-border">
                        <button
                          onClick={() => { setIsDropdownOpen(false); setIsCreateModalOpen(true); }}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all"
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
                <span className="text-xs font-semibold text-slate-200 dark:text-slate-300 leading-none">{profile?.full_name || "Guest"}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">{profile?.email || ""}</span>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-sidebar-accent rounded-lg transition-all"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background text-foreground transition-colors duration-200">
          {!activeWorkspaceId && pathname !== "/dashboard/settings" && pathname !== "/dashboard/help" ? (
            <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6 flex flex-col justify-center min-h-[85vh]">
              <div className="bg-slate-900/60 dark:bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden p-8 md:p-12 text-center space-y-8 max-w-3xl mx-auto relative">
                {/* Decorative background glow */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex justify-center">
                  <div className="h-20 w-20 bg-gradient-to-tr from-indigo-600 to-violet-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-pulse">
                    <Sparkles size={38} />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight">Welcome to EVE</h2>
                  <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                    Enterprise Virtual Executive AI OS. Choose how you would like to begin exploring the platform.
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
                    {/* Option A: Demo Workspace */}
                    <button
                      onClick={handleCreateDemoWorkspace}
                      disabled={demoLoading || createLoading}
                      className="group relative flex flex-col text-left p-6 bg-slate-950/60 hover:bg-slate-950/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-indigo-500/5 cursor-pointer disabled:opacity-50 overflow-hidden"
                    >
                      {demoLoading && (
                        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-10">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                            <span className="text-xs text-indigo-400 font-semibold animate-pulse">Launching demo...</span>
                          </div>
                        </div>
                      )}
                      <div className="h-10 w-10 bg-indigo-900/30 group-hover:bg-indigo-600/20 text-indigo-400 rounded-lg flex items-center justify-center mb-4 transition-all">
                        <Sparkles size={20} />
                      </div>
                      <h4 className="text-base font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">Option A: Launch Demo Workspace</h4>
                      <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                        Explore EVE using a realistic fashion business (<strong>NovaWear Fashion</strong>) with preloaded sales, inventory, customers, expenses, risks, and executive insights.
                      </p>
                      <div className="mt-auto pt-6 flex items-center text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
                        Launch Demo & Explore &rarr;
                      </div>
                    </button>

                    {/* Option B: Create Workspace */}
                    <button
                      onClick={() => setShowManualForm(true)}
                      disabled={demoLoading || createLoading}
                      className="group flex flex-col text-left p-6 bg-slate-950/60 hover:bg-slate-950/90 border border-slate-800 hover:border-violet-500/50 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-purple-500/5 cursor-pointer disabled:opacity-50"
                    >
                      <div className="h-10 w-10 bg-purple-900/30 group-hover:bg-purple-600/20 text-purple-400 rounded-lg flex items-center justify-center mb-4 transition-all">
                        <Plus size={20} />
                      </div>
                      <h4 className="text-base font-bold text-slate-200 group-hover:text-purple-400 transition-colors">Option B: Create My Own</h4>
                      <p className="text-slate-400 text-xs mt-2 leading-relaxed">
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
                        className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                      >
                        &larr; Back to options
                      </button>
                    </div>
                    <form onSubmit={handleCreateWorkspace} className="space-y-4 text-left">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Workspace / Brand Name</label>
                        <input
                          type="text"
                          required
                          value={newWorkspaceName}
                          onChange={(e) => setNewWorkspaceName(e.target.value)}
                          placeholder="e.g. Acme Clothing"
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm placeholder-slate-600"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={createLoading || !newWorkspaceName.trim()}
                        className="w-full flex justify-center items-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md disabled:opacity-50 cursor-pointer"
                      >
                        {createLoading ? "Creating Workspace..." : "Create Workspace"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Create Workspace Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Building2 className="text-indigo-600" size={20} /> Create New Workspace
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-sidebar-accent text-slate-400">
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Workspace / Brand Name</label>
                <input
                  type="text"
                  required
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="e.g. Acme Fashion Corp"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 border border-border text-foreground hover:bg-sidebar-accent rounded-lg text-sm font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={createLoading || !newWorkspaceName.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                  {createLoading ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        sessionToken={sessionToken}
      />
      {activeWorkspaceId && <ProductTour />}
    </div>
  );
}
