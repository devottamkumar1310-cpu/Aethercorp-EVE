"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  Lock,
  Building2,
  Trash2,
  AlertTriangle,
  Upload,
  Check,
  Loader2,
  Mail,
  Palette,
  ShieldCheck,
  Menu
} from "lucide-react";
import { API_BASE_URL, apiFetch } from "@/lib/api";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [developerMode, setDeveloperMode] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  // Profile forms
  const [fullName, setFullName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [language, setLanguage] = useState("en");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Email update states
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Avatar Upload states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Workspace deletion modal state
  const [deleteWsModal, setDeleteWsModal] = useState<Workspace | null>(null);
  const [deleteWsConfirmText, setDeleteWsConfirmText] = useState("");
  const [deleteWsLoading, setDeleteWsLoading] = useState(false);
  const [deleteWsError, setDeleteWsError] = useState("");

  // Account deletion modal state
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState("");
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");

  // Sidebar navigation tracking state
  const [activeSection, setActiveSection] = useState("profile");

  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDeveloperMode(localStorage.getItem("developer_mode") === "true");
    }
  }, []);

  const handleToggleDeveloperMode = (enabled: boolean) => {
    setDeveloperMode(enabled);
    localStorage.setItem("developer_mode", String(enabled));
  };

  const getSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return null;
    }
    return session;
  }, [supabase, router]);

  const fetchWorkspaces = useCallback(async () => {
    const session = await getSession();
    if (!session) return;

    try {
      const response = await apiFetch(`${API_BASE_URL}/api/organization/workspaces`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data);
        // P0 Check: If zero workspaces left, clear local selection state and route back to onboarding
        if (data.length === 0) {
          localStorage.removeItem("active_workspace_id");
          sessionStorage.removeItem("eve_initialized");
          router.push("/onboarding");
        }
      }
    } catch (e) {
      console.error("Failed to fetch workspaces", e);
    }
  }, [getSession, router]);

  useEffect(() => {
    async function fetchData() {
      const session = await getSession();
      if (!session) return;

      // P2-A Detection: Identify if OAuth credentials control the account session
      const provider = session.user?.app_metadata?.provider;
      setIsGoogleUser(provider === "google");

      try {
        const [profileRes, workspacesRes] = await Promise.all([
          apiFetch(`${API_BASE_URL}/api/profile/me`, {
            headers: { "Authorization": `Bearer ${session.access_token}` },
          }),
          apiFetch(`${API_BASE_URL}/api/organization/workspaces`, {
            headers: { "Authorization": `Bearer ${session.access_token}` },
          }),
        ]);

        if (profileRes.ok) {
          const prof = await profileRes.json();
          setProfile(prof);
          setFullName(prof.full_name || "");
          setTimezone(prof.timezone || "UTC");
          setLanguage(prof.language || "en");
          setAvatarUrl(prof.avatar_url || null);
          setEmail(prof.email || "");
        }
        if (workspacesRes.ok) {
          setWorkspaces(await workspacesRes.json());
        }
      } catch (e) {
        console.error("Failed to fetch settings data", e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [getSession]);

  // Sidebar Intersection Observer to highlight current active section automatically on scroll
  useEffect(() => {
    const sections = ["profile", "appearance", "email", "workspaces", "security", "danger-zone"];
    const observerOptions = {
      root: null,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, observerOptions);

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [loading]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileSuccess(false);
    setProfileError(null);

    const session = await getSession();
    if (!session) return;

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/profile/me`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          full_name: fullName,
          timezone,
          language
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update profile settings.");
      }

      setProfileSuccess(true);
    } catch (err: any) {
      setProfileError(err.message || "An error occurred.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email === profile?.email || isGoogleUser) return;

    setUpdatingEmail(true);
    setEmailSuccess(null);
    setEmailError(null);

    const session = await getSession();
    if (!session) return;

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/profile/me/email`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ new_email: email })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to initiate email change.");
      }

      const data = await res.json();
      setEmailSuccess(data.message || "Verification emails sent to both addresses.");
    } catch (err: any) {
      setEmailError(err.message || "An error occurred.");
    } finally {
      setUpdatingEmail(false);
    }
  };

  // P2-B Avatar preview handling using local FileReader URL
  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("File size cannot exceed 2MB.");
      return;
    }
    setAvatarError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = async () => {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setUploadingAvatar(true);
    setAvatarSuccess(false);
    setAvatarError(null);

    const session = await getSession();
    if (!session) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch(`${API_BASE_URL}/api/profile/me/avatar`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to upload avatar.");
      }

      const data = await res.json();
      setAvatarUrl(data.avatar_url);
      setAvatarPreview(null);
      setAvatarSuccess(true);
    } catch (err: any) {
      setAvatarError(err.message || "Upload error.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!deleteWsModal || deleteWsConfirmText !== deleteWsModal.name) return;

    setDeleteWsLoading(true);
    setDeleteWsError("");

    try {
      const session = await getSession();
      if (!session) return;

      const response = await apiFetch(`${API_BASE_URL}/api/organization/${deleteWsModal.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete workspace");
      }

      setDeleteWsModal(null);
      setDeleteWsConfirmText("");
      await fetchWorkspaces();
    } catch (e: any) {
      setDeleteWsError(e.message || "An unexpected error occurred");
    } finally {
      setDeleteWsLoading(false);
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (loading) {
    return (
      <main className="p-6 max-w-6xl mx-auto w-full space-y-8 animate-pulse">
        <div className="bg-card rounded-xl border border-border h-48 flex flex-col justify-between" />
        <div className="bg-card rounded-xl border border-border h-52" />
      </main>
    );
  }

  const userTheme = typeof window !== "undefined" ? localStorage.getItem("theme") || "dark" : "dark";

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-8 flex flex-col lg:flex-row gap-8">
      
      {/* P2-C Sticky Sidebar Navigation */}
      <aside className="lg:w-64 lg:shrink-0 lg:sticky lg:top-24 h-fit">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-1">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
            <Menu className="h-3.5 w-3.5" />
            System settings
          </div>
          {[
            { id: "profile", label: "Profile Settings", icon: User },
            { id: "appearance", label: "Appearance", icon: Palette },
            { id: "email", label: "Email Management", icon: Mail },
            { id: "workspaces", label: "Workspaces", icon: Building2 },
            { id: "security", label: "Security & Keys", icon: Lock },
            { id: "danger-zone", label: "Danger Zone", icon: AlertTriangle }
          ].map((sec) => {
            const IconComponent = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                  active
                    ? "bg-indigo-600/10 text-indigo-500 border-l-4 border-indigo-600"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <IconComponent className={`h-4.5 w-4.5 ${active ? "text-indigo-500" : "text-slate-400"}`} />
                {sec.label}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Settings Form Scroll Area */}
      <main className="flex-1 space-y-10 pb-20">
        
        {/* Profile Section */}
        <section id="profile" className="scroll-mt-24 bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all">
          <div className="px-6 py-4 border-b border-border bg-slate-50/10 flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center text-foreground font-sans">
              <User className="h-5 w-5 mr-2 text-indigo-500" />
              Profile Settings
            </h2>
          </div>
          <div className="p-6 space-y-6">
            
            {/* P2-B Avatar Upload UI with interactive preview and local draft review */}
            <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-border pb-6">
              <div className="relative h-20 w-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden border border-border group">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview avatar" className="h-full w-full object-cover" />
                ) : avatarUrl ? (
                  <img src={avatarUrl.startsWith("gs://") ? "/favicon.ico" : avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  fullName ? fullName.slice(0, 2).toUpperCase() : "U"
                )}
              </div>
              <div className="space-y-1">
                <span className="block text-sm font-medium text-foreground">Avatar Image</span>
                <p className="text-xs text-muted-foreground">Accepts PNG, JPG, JPEG. Max size 2MB.</p>
                
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold px-3 py-2 border border-border rounded-lg hover:bg-muted/50 transition cursor-pointer text-foreground">
                    <Upload className="h-3.5 w-3.5" />
                    Select Image
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleAvatarFileSelect}
                      className="hidden"
                    />
                  </label>

                  {avatarPreview && (
                    <button
                      onClick={handleAvatarUpload}
                      disabled={uploadingAvatar}
                      className="flex items-center gap-2 text-xs font-semibold px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Save Upload
                    </button>
                  )}
                  
                  {avatarSuccess && <span className="text-xs text-emerald-500 font-medium flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Updated!</span>}
                  {avatarError && <span className="text-xs text-red-500 font-medium">{avatarError}</span>}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileSuccess && (
                <div className="p-3 bg-emerald-50/10 text-emerald-500 text-sm rounded-lg border border-emerald-500/20 flex items-center gap-2">
                  <Check className="h-4 w-4" /> Profile options updated successfully.
                </div>
              )}
              {profileError && (
                <div className="p-3 bg-red-50/10 text-red-500 text-sm rounded-lg border border-red-500/20">
                  {profileError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full text-foreground bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full text-foreground bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="UTC">UTC (Universal Time)</option>
                    <option value="America/New_York">EST (Eastern Standard Time)</option>
                    <option value="America/Chicago">CST (Central Standard Time)</option>
                    <option value="America/Denver">MST (Mountain Standard Time)</option>
                    <option value="America/Los_Angeles">PST (Pacific Standard Time)</option>
                    <option value="Europe/London">GMT (Greenwich Mean Time)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full text-foreground bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="en">English (US)</option>
                    <option value="es">Español (ES)</option>
                    <option value="fr">Français (FR)</option>
                    <option value="de">Deutsch (DE)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={updatingProfile}
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-lg transition"
                >
                  {updatingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* P1-A Appearance / Themes Section */}
        <section id="appearance" className="scroll-mt-24 bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all">
          <div className="px-6 py-4 border-b border-border bg-slate-50/10">
            <h2 className="text-base font-semibold flex items-center text-foreground">
              <Palette className="h-5 w-5 mr-2 text-indigo-500" />
              Theme Appearance
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="max-w-md">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Interface Mode</label>
              <select
                value={userTheme}
                onChange={(e) => {
                  const selected = e.target.value;
                  localStorage.setItem("theme", selected);
                  document.documentElement.setAttribute("data-theme", selected);
                  if (selected === "system") {
                    const resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "executive-light";
                    document.documentElement.setAttribute("data-theme", resolved);
                  }
                  window.dispatchEvent(new Event("theme-changed"));
                }}
                className="w-full text-foreground bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                <option value="system">🖥️ System Preference</option>
                <option value="dark">🌙 Executive Dark (Slate/Graphite)</option>
                <option value="executive-light">☀️ Executive Light (Minimalist Silver)</option>
                <option value="midnight-blue">🌌 Midnight Blue (Deep Navy/Cyan)</option>
                <option value="emerald-intelligence">🌲 Emerald Growth (Green/Emerald)</option>
                <option value="royal-purple">🔮 Royal Purple (Premium AI Indigo)</option>
                <option value="carbon-red">🚨 Carbon Red (Command Center Red)</option>
                <option value="aurora">🌈 Aurora (Nebula Gradients)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-2">
                Selecting System Mode coordinates automatically with your desktop dark or light configuration preferences.
              </p>
            </div>
          </div>
        </section>

        {/* Email Address Section */}
        <section id="email" className="scroll-mt-24 bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all">
          <div className="px-6 py-4 border-b border-border bg-slate-50/10 flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center text-foreground">
              <Mail className="h-5 w-5 mr-2 text-indigo-500" />
              Email Management
            </h2>
            {profile?.email_verified ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500">
                <Check className="h-3 w-3" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500">
                Verification Pending
              </span>
            )}
          </div>
          <div className="p-6">
            {isGoogleUser ? (
              // P2-A Managed Google OAuth Banner instead of modification inputs
              <div className="p-4 bg-muted/30 border border-border rounded-lg flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-indigo-500 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Google Managed Account</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your account is securely managed by Google Auth ({email}). Primary account email changes must be requested through your identity provider.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveEmail} className="space-y-4">
                {emailSuccess && (
                  <div className="p-3 bg-emerald-50/10 text-emerald-500 text-sm rounded-lg border border-emerald-500/20 flex items-center gap-2">
                    <Check className="h-4 w-4" /> {emailSuccess}
                  </div>
                )}
                {emailError && (
                  <div className="p-3 bg-red-50/10 text-red-500 text-sm rounded-lg border border-red-500/20">
                    {emailError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Current Email</label>
                    <div className="text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border cursor-not-allowed text-sm">
                      {profile?.email}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">New Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-foreground bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={updatingEmail || email === profile?.email}
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingEmail && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Change Email Address
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Workspaces Section */}
        <section id="workspaces" className="scroll-mt-24 bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all">
          <div className="px-6 py-4 border-b border-border bg-slate-50/10">
            <h2 className="text-base font-semibold flex items-center text-foreground">
              <Building2 className="h-5 w-5 mr-2 text-indigo-500" />
              Workspaces
            </h2>
          </div>
          <div className="p-6">
            {workspaces.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active workspaces configured.</p>
            ) : (
              <div className="space-y-3">
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-slate-50/5 hover:bg-muted/10 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{ws.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{ws.slug}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          ws.role === "owner"
                            ? "bg-indigo-500/10 text-indigo-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {ws.role}
                      </span>
                      {ws.role === "owner" && (
                        <button
                          onClick={() => {
                            setDeleteWsModal(ws);
                            setDeleteWsConfirmText("");
                            setDeleteWsError("");
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 px-3 py-1.5 rounded-md border border-red-500/25 hover:bg-red-500/10 transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Workspace
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Security Section */}
        <section id="security" className="scroll-mt-24 bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all">
          <div className="px-6 py-4 border-b border-border bg-slate-50/10">
            <h2 className="text-base font-semibold flex items-center text-foreground">
              <Lock className="h-5 w-5 mr-2 text-indigo-500" />
              Security
            </h2>
          </div>
          <div className="p-6">
            <button
              onClick={() => supabase.auth.resetPasswordForEmail(profile?.email || "", {
                redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
              })}
              className="text-xs font-semibold uppercase tracking-wider bg-card border border-border text-foreground px-4 py-2.5 rounded-lg hover:bg-muted/50 transition-all cursor-pointer"
            >
              Reset Account Password
            </button>
          </div>
        </section>

        {/* Danger Zone Section */}
        <section id="danger-zone" className="scroll-mt-24 bg-red-500/5 rounded-xl border border-red-500/20 shadow-sm overflow-hidden transition-all">
          <div className="px-6 py-4 border-b border-red-500/20 bg-red-500/10">
            <h2 className="text-base font-semibold flex items-center text-red-500">
              <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
              Danger Zone
            </h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-foreground font-medium">Delete Account</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Permanently remove your account, all credentials, data instances, and workspace mappings. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDeleteAccountModal(true);
                  setDeleteAccountConfirmText("");
                  setDeleteAccountError("");
                }}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Delete Account
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* P1-C Workspace Deletion Confirmation Modal */}
      {deleteWsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl border border-border overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Workspace
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                This will permanently delete the workspace <strong>{deleteWsModal.name}</strong>, along with its associated records and metrics.
              </p>
              
              {deleteWsError && (
                <div className="mb-4 p-3 bg-red-500/10 text-red-500 text-sm rounded-lg border border-red-500/20">
                  {deleteWsError}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Type <strong>{deleteWsModal.name}</strong> to confirm deletion
                </label>
                <input
                  type="text"
                  value={deleteWsConfirmText}
                  onChange={(e) => setDeleteWsConfirmText(e.target.value)}
                  className="w-full text-foreground bg-background px-3 py-2 rounded-lg border border-border focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                  placeholder={deleteWsModal.name}
                />
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setDeleteWsModal(null)}
                  disabled={deleteWsLoading}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteWorkspace}
                  disabled={deleteWsConfirmText !== deleteWsModal.name || deleteWsLoading}
                  className="px-4 py-2 bg-red-650 hover:bg-red-755 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {deleteWsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Delete Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* P1-C Account Deletion Confirmation Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl border border-border overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Account
              </h3>
              
              {/* Check if user is the owner of any workspace */}
              {workspaces.some(w => w.role === "owner") ? (
                <div className="space-y-4">
                  <div className="p-3 bg-red-500/10 text-red-500 text-sm rounded-lg border border-red-500/20 font-medium">
                    Account deletion is currently unavailable.
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-foreground font-semibold">You own the following workspace(s):</p>
                    <ul className="text-sm text-foreground space-y-1 pl-1">
                      {workspaces
                        .filter(w => w.role === "owner")
                        .map(w => (
                          <li key={w.id} className="font-semibold text-foreground">• {w.name}</li>
                        ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-foreground font-semibold">Before deleting your account you must:</p>
                    <div className="text-sm text-muted-foreground space-y-1 pl-1">
                      <p className="text-foreground">1. Transfer ownership to another member</p>
                      <p className="text-xs font-bold text-slate-500 pl-4 py-0.5">OR</p>
                      <p className="text-foreground">2. Delete the workspace and its data</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Once you no longer own any workspaces, account deletion will become available.
                  </p>

                  <div className="flex gap-3 justify-end mt-6 border-t border-border pt-4">
                    <button
                      onClick={() => setShowDeleteAccountModal(false)}
                      className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteAccountModal(false);
                        scrollToSection("workspaces");
                      }}
                      className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      Manage Workspaces
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm mb-4">
                    This will permanently delete your account, remove your workspace memberships, and wipe your data.
                  </p>
                  
                  {deleteAccountError && (
                    <div className="mb-4 p-3 bg-red-500/10 text-red-500 text-sm rounded-lg border border-red-500/20">
                      {deleteAccountError}
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Type <strong>DELETE</strong> to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteAccountConfirmText}
                      onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
                      className="w-full text-foreground bg-background px-3 py-2 rounded-lg border border-border focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                      placeholder="DELETE"
                    />
                  </div>

                  <div className="flex gap-3 justify-end mt-6">
                    <button
                      onClick={() => setShowDeleteAccountModal(false)}
                      disabled={deleteAccountLoading}
                      className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setDeleteAccountLoading(true);
                        setDeleteAccountError("");
                        try {
                          const session = await getSession();
                          const res = await apiFetch(`${API_BASE_URL}/api/account/delete`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${session?.access_token}` }
                          });
                          if (!res.ok) {
                            const data = await res.json();
                            throw new Error(data.detail || "Failed to delete account");
                          }
                          
                          // Sign out on success
                          await supabase.auth.signOut();
                          localStorage.clear();
                          window.location.href = "/login";
                        } catch (err: any) {
                          setDeleteAccountError(err.message);
                          setDeleteAccountLoading(false);
                        }
                      }}
                      disabled={deleteAccountConfirmText !== "DELETE" || deleteAccountLoading}
                      className="px-4 py-2 bg-red-650 hover:bg-red-755 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                      {deleteAccountLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      Delete Account
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
