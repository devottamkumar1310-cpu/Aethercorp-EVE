"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
  Menu,
  Monitor,
  Sun,
  Moon
} from "lucide-react";
import { API_BASE_URL, apiFetch } from "@/lib/api";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  member_count?: number;
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

  // Theme states
  const [themeState, setThemeState] = useState("executive-light");
  
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDeveloperMode(localStorage.getItem("developer_mode") === "true");
      
      let activeTheme = localStorage.getItem("theme") || "executive-light";
      if (!["system", "executive-light", "dark"].includes(activeTheme)) {
        activeTheme = "executive-light";
        localStorage.setItem("theme", "executive-light");
        document.documentElement.setAttribute("data-theme", "executive-light");
        window.dispatchEvent(new Event("theme-changed"));
      }
      setThemeState(activeTheme);
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

  // Robust Captured Scroll Spy for settings sections
  useEffect(() => {
    if (loading) return;

    const sections = ["profile", "appearance", "email", "workspaces", "security", "danger-zone"];

    const handleScroll = () => {
      const container = document.querySelector("main") || document.documentElement;
      const containerHeight = container.clientHeight;
      const scrollHeight = container.scrollHeight;
      const scrollTop = container.scrollTop;

      // Force danger-zone active when near the bottom of the scroll area
      if (scrollTop + containerHeight >= scrollHeight - 30) {
        setActiveSection("danger-zone");
        return;
      }

      let active = "profile";
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          // If the top of the section is scrolled above 150px threshold from top of viewport
          if (rect.top <= 150) {
            active = id;
          }
        }
      }
      setActiveSection(active);
    };

    // capture: true intercepts scroll events from overflow-auto elements
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    handleScroll();

    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
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
      // Smooth scroll
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      
      // Accessibility focus helper
      element.setAttribute("tabindex", "-1");
      element.focus({ preventScroll: true });
      element.addEventListener("blur", () => element.removeAttribute("tabindex"), { once: true });
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    
    // Resolve system preference
    const resolved = newTheme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "executive-light")
      : newTheme;
      
    document.documentElement.setAttribute("data-theme", resolved);
    window.dispatchEvent(new Event("theme-changed"));
  };

  if (loading) {
    return (
      <main className="p-6 max-w-5xl mx-auto w-full space-y-8 animate-pulse">
        <div className="bg-card rounded-xl border border-border h-48 flex flex-col justify-between" />
        <div className="bg-card rounded-xl border border-border h-52" />
      </main>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6 flex flex-col lg:flex-row gap-6">
      
      {/* Sticky Sidebar Navigation */}
      <aside className="lg:w-60 lg:shrink-0 lg:sticky lg:top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none">
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm space-y-1">
          <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-2">
            <Menu size={12} className="text-muted-foreground" />
            System settings
          </div>
          {[
            { id: "profile", label: "Profile Settings", icon: User },
            { id: "appearance", label: "Appearance", icon: Palette },
            { id: "email", label: "Email Management", icon: Mail },
            { id: "workspaces", label: "Workspaces", icon: Building2 },
            ...(!isGoogleUser ? [{ id: "security", label: "Security & Keys", icon: Lock }] : []),
            { id: "danger-zone", label: "Danger Zone", icon: AlertTriangle }
          ].map((sec) => {
            const IconComponent = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left cursor-pointer group ${
                  active
                    ? "bg-indigo-600/15 !text-white [&_svg]:!text-white [&_svg]:!stroke-white border-l-2 border-indigo-500 pl-[10px]"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent pl-3"
                }`}
              >
                <IconComponent size={15} className={active ? "text-indigo-400" : "text-muted-foreground group-hover:text-muted-foreground"} />
                {sec.label}
              </button>
            );
          })}
        </div>
      </aside>
      {/* Main Settings Form Scroll Area */}
      <main className="flex-1 space-y-8 pb-20">
        
        {/* Profile Section */}
        <section id="profile" className="scroll-mt-24 bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all">
          <div className="px-6 py-4 border-b border-border bg-secondary flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center text-foreground tracking-wide font-sans">
              <User className="h-4 w-4 mr-2.5 text-indigo-500" />
              Profile Settings
            </h2>
          </div>
          <div className="p-6 space-y-6">
            
            {/* Avatar Upload UI with interactive preview and local draft review */}
            <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-border pb-6">
              <div className="relative h-20 w-20 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-foreground text-2xl font-bold overflow-hidden border-2 border-border shadow-md group">
                {avatarPreview ? (
                  <Image src={avatarPreview} alt="Preview avatar" width={80} height={80} unoptimized className="h-full w-full object-cover" />
                ) : avatarUrl ? (
                  <Image src={avatarUrl.startsWith("gs://") ? "/favicon.ico" : avatarUrl} alt="Avatar" width={80} height={80} unoptimized className="h-full w-full object-cover" />
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
                    {avatarPreview || avatarUrl ? "Change Image" : "Select Image"}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleAvatarFileSelect}
                      className="hidden"
                    />
                  </label>

                  {avatarPreview && (
                    <>
                      <button
                        type="button"
                        onClick={handleAvatarUpload}
                        disabled={uploadingAvatar}
                        className="flex items-center gap-2 text-xs font-semibold px-3 py-2 bg-indigo-600 !text-white [&_svg]:!text-white [&_svg]:!stroke-white rounded-lg hover:bg-indigo-700 transition cursor-pointer"
                      >
                        {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Save Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarPreview(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="flex items-center gap-2 text-xs font-semibold px-3 py-2 border border-red-500/30 hover:bg-red-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white rounded-lg transition cursor-pointer"
                      >
                        Remove Avatar
                      </button>
                    </>
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
                    className="w-full text-foreground bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
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
                    className="w-full text-foreground bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
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
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-lg transition cursor-pointer"
                >
                  {updatingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Appearance / Themes Section */}
        <section id="appearance" className="scroll-mt-24 bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all">
          <div className="px-6 py-4 border-b border-border bg-secondary">
            <h2 className="text-sm font-semibold flex items-center text-foreground tracking-wide font-sans">
              <Palette className="h-4 w-4 mr-2.5 text-indigo-500" />
              Theme Appearance
            </h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="max-w-md">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Interface Mode</label>
              
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "system", label: "System", icon: Monitor },
                  { value: "executive-light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon }
                ].map((t) => {
                  const Icon = t.icon;
                  const active = themeState === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleThemeChange(t.value)}
                      className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-sm font-medium transition-all gap-1.5 cursor-pointer ${
                        active
                          ? "bg-indigo-600/15 !text-white [&_svg]:!text-white [&_svg]:!stroke-white border-indigo-500/80 shadow-xs"
                          : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    >
                      <Icon size={16} className={active ? "text-indigo-400" : "text-muted-foreground"} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Selecting System Mode coordinates automatically with your system dark or light configuration preferences.
              </p>
            </div>

            <div className="border-t border-border/60 pt-6 max-w-md">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <label className="text-xs font-bold text-foreground block">Developer Telemetry Mode</label>
                  <span className="text-[11px] text-muted-foreground block leading-relaxed">
                    Show advanced token counts, estimated costs, and agent logical breakdowns in EVE Chat.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleDeveloperMode(!developerMode)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer outline-none ${
                    developerMode ? "bg-indigo-600" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-foreground transition-transform ${
                      developerMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* Email Address Section */}
        <section id="email" className="scroll-mt-24 bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all">
          <div className="px-6 py-4 border-b border-border bg-secondary flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center text-foreground tracking-wide font-sans">
              <Mail className="h-4 w-4 mr-2.5 text-indigo-500" />
              Email Management
            </h2>
            {isGoogleUser ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white">
                <Check className="h-3 w-3" />
                Managed by Google
              </span>
            ) : profile?.email_verified ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white">
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
              <div className="p-4 bg-muted/30 border border-border rounded-lg flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-2.5">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Managed by Google</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This email is controlled by your Google account ({email}).
                    </p>
                  </div>
                  <div className="text-xs border-t border-border/50 pt-2 text-muted-foreground">
                    <p className="font-semibold text-foreground mb-0.5">Need to switch to another Google account?</p>
                    <p className="leading-relaxed">During beta, contact support and we can help migrate your login credentials.</p>
                  </div>
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
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
          <div className="px-6 py-4 border-b border-border bg-secondary">
            <h2 className="text-sm font-semibold flex items-center text-foreground tracking-wide font-sans">
              <Building2 className="h-4 w-4 mr-2.5 text-indigo-500" />
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
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary hover:bg-muted/10 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{ws.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{ws.slug}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          ws.role === "owner"
                            ? "bg-indigo-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white"
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
        {!isGoogleUser && (
          <section id="security" className="scroll-mt-24 bg-card rounded-xl border border-border shadow-sm overflow-hidden transition-all">
            <div className="px-6 py-4 border-b border-border bg-secondary">
              <h2 className="text-sm font-semibold flex items-center text-foreground tracking-wide font-sans">
                <Lock className="h-4 w-4 mr-2.5 text-indigo-500" />
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
        )}

        {/* Danger Zone Section */}
        <section id="danger-zone" className="scroll-mt-24 bg-red-500/5 rounded-xl border border-red-500/20 shadow-sm overflow-hidden transition-all">
          <div className="px-6 py-4 border-b border-red-500/20 bg-red-500/10">
            <h2 className="text-sm font-semibold flex items-center text-red-500 tracking-wide font-sans">
              <AlertTriangle className="h-4 w-4 mr-2.5 text-red-500" />
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
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-foreground text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Delete Account
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* Workspace Deletion Confirmation Modal */}
      {deleteWsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background backdrop-blur-sm">
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
                <div className="mb-4 p-3 bg-red-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white text-sm rounded-lg border border-red-500/20">
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
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {deleteWsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Delete Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Deletion Confirmation Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl border border-border overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Account
              </h3>
              
              {/* Check if user is the sole owner of any workspace with other members */}
              {(() => {
                const blockedWorkspaces = workspaces.filter(
                  (w) => w.role === "owner" && w.member_count !== undefined && w.member_count > 1
                );
                const isBlocked = blockedWorkspaces.length > 0;

                return isBlocked ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-red-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white text-sm rounded-lg border border-red-500/20 font-medium">
                      Account deletion is currently unavailable.
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-foreground font-semibold">You own workspace(s) with other active members:</p>
                      <ul className="text-sm text-foreground space-y-1 pl-1">
                        {blockedWorkspaces.map((w) => (
                          <li key={w.id} className="font-semibold text-foreground">• {w.name}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-foreground font-semibold">Before deleting your account you must:</p>
                      <div className="text-sm text-muted-foreground space-y-1 pl-1">
                        <p className="text-foreground">1. Transfer ownership to another member</p>
                        <p className="text-xs font-bold text-muted-foreground pl-4 py-0.5">OR</p>
                        <p className="text-foreground">2. Remove all members from the workspace</p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Once ownership is transferred or the workspaces have no other members, account deletion will become available.
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
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 !text-white [&_svg]:!text-white [&_svg]:!stroke-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        Manage Workspace
                      </button>
                    </div>
                  </div>
                ) : (
                <>
                  <p className="text-muted-foreground text-sm mb-4">
                    This will permanently delete your account, remove your workspace memberships, and wipe your data.
                  </p>
                  
                  {deleteAccountError && (
                    <div className="mb-4 p-3 bg-red-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white text-sm rounded-lg border border-red-500/20">
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
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                      {deleteAccountLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      Delete Account
                    </button>
                  </div>
                </>
              ) })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
