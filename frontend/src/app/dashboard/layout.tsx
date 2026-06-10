"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL } from "@/lib/api";
import { Building2, ChevronDown, Plus, LogOut, User, Sparkles, AlertCircle, X } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const router = useRouter();

  const loadWorkspacesAndProfile = async (token: string) => {
    try {
      // Fetch profile
      const profileRes = await fetch(`${API_BASE_URL}/api/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      }

      // Fetch workspaces
      const wsRes = await fetch(`${API_BASE_URL}/api/organization/workspaces`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (wsRes.ok) {
        const wsData = await wsRes.json();
        setWorkspaces(wsData);

        // Initialize active workspace
        const storedId = localStorage.getItem("active_workspace_id");
        if (storedId) {
          // Verify it exists in user's memberships
          const exists = wsData.some((w: Workspace) => w.id === storedId);
          if (exists) {
            setActiveWorkspaceId(storedId);
          } else if (wsData.length > 0) {
            localStorage.setItem("active_workspace_id", wsData[0].id);
            setActiveWorkspaceId(wsData[0].id);
          } else {
            localStorage.removeItem("active_workspace_id");
            setActiveWorkspaceId(null);
          }
        } else if (wsData.length > 0) {
          localStorage.setItem("active_workspace_id", wsData[0].id);
          setActiveWorkspaceId(wsData[0].id);
        } else {
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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      setSessionToken(session.access_token);
      await loadWorkspacesAndProfile(session.access_token);
      setLoading(false);
    }
    init();
  }, [router]);

  const handleSwitchWorkspace = (id: string) => {
    localStorage.setItem("active_workspace_id", id);
    setActiveWorkspaceId(id);
    setIsDropdownOpen(false);
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
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ name: newWorkspaceName })
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

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem("active_workspace_id");
    router.push("/login");
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-300 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl animate-pulse shadow-lg shadow-indigo-500/20">
            E
          </div>
          <span className="text-sm font-medium tracking-wide text-slate-400">Loading Operations Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Premium Navigation Header */}
      <header className="sticky top-0 z-40 w-full bg-slate-900 border-b border-slate-800 text-white shadow-md">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div 
              onClick={() => router.push("/dashboard")}
              className="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg tracking-tighter cursor-pointer hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/10"
            >
              EVE
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-slate-100 tracking-tight text-sm leading-none">EVE OPERATIONAL PORTAL</span>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">Enterprise Virtual Executive</span>
            </div>
          </div>

          {/* Workspace Switcher & User Profile */}
          <div className="flex items-center gap-4">
            
            {/* Workspace Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium text-slate-200 transition-all focus:outline-none"
              >
                <Building2 size={16} className="text-indigo-400" />
                <span className="max-w-[150px] truncate">
                  {activeWorkspace ? activeWorkspace.name : "Select Workspace"}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-slate-850 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-700">
                    <div className="p-3 bg-slate-900/60">
                      <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">My Workspaces</span>
                    </div>
                    <div className="py-1 max-h-60 overflow-y-auto bg-slate-800">
                      {workspaces.map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => handleSwitchWorkspace(ws.id)}
                          className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-slate-750 transition-colors ${
                            ws.id === activeWorkspaceId
                              ? "text-indigo-400 font-bold bg-slate-750/50"
                              : "text-slate-300"
                          }`}
                        >
                          <span className="truncate">{ws.name}</span>
                          {ws.id === activeWorkspaceId && (
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          )}
                        </button>
                      ))}
                      {workspaces.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500 italic">
                          No active workspaces
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-slate-900/40">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setIsCreateModalOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                      >
                        <Plus size={14} />
                        Create Workspace
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />

            {/* Profile Dropdown */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-200 leading-none">
                  {profile?.full_name || "Guest User"}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  {profile?.email || ""}
                </span>
              </div>
              
              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* Main Page Layout Wrapper */}
      <div className="flex-1 w-full">
        {children}
      </div>

      {/* Create Workspace Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <Building2 className="text-indigo-600" size={20} />
                Create New Workspace
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Workspace / Brand Name
                </label>
                <input
                  type="text"
                  required
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="e.g. Acme Fashion Corp"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !newWorkspaceName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {createLoading ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
