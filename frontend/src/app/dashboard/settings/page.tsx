"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, Lock, Building2, Trash2, AlertTriangle, Shield, Upload, Check, Loader2, Mail } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

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

  const [fullName, setFullName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [language, setLanguage] = useState("en");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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

  const router = useRouter();
  const supabase = createClient();

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
      const response = await fetch(`${API_BASE_URL}/api/organization/workspaces`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });
      if (response.ok) {
        setWorkspaces(await response.json());
      }
    } catch (e) {
      console.error("Failed to fetch workspaces", e);
    }
  }, [getSession]);

  useEffect(() => {
    async function fetchData() {
      const session = await getSession();
      if (!session) return;

      try {
        const [profileRes, workspacesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/profile/me`, {
            headers: { "Authorization": `Bearer ${session.access_token}` },
          }),
          fetch(`${API_BASE_URL}/api/organization/workspaces`, {
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileSuccess(false);
    setProfileError(null);

    const session = await getSession();
    if (!session) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me`, {
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
    if (email === profile?.email) return;

    setUpdatingEmail(true);
    setEmailSuccess(null);
    setEmailError(null);

    const session = await getSession();
    if (!session) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/me/email`, {
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
      setEmailSuccess(data.message || "Verification email sent.");
    } catch (err: any) {
      setEmailError(err.message || "An error occurred.");
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Front-end sanity check
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("File size cannot exceed 2MB.");
      return;
    }

    setUploadingAvatar(true);
    setAvatarSuccess(false);
    setAvatarError(null);

    const session = await getSession();
    if (!session) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/api/profile/me/avatar`, {
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

      const response = await fetch(`${API_BASE_URL}/api/organization/${deleteWsModal.id}`, {
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

  const handleDeleteAccount = async () => {
    if (deleteAccountConfirmText !== "DELETE") return;

    setDeleteAccountLoading(true);
    setDeleteAccountError("");

    try {
      const session = await getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE_URL}/api/profile/me`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete account");
      }

      await supabase.auth.signOut();
      router.push("/");
    } catch (e: any) {
      setDeleteAccountError(e.message || "An unexpected error occurred");
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto w-full space-y-8 animate-pulse">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-48 flex flex-col justify-between" />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-52" />
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto w-full space-y-8 transition-colors duration-200">

      {/* Profile Section */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center text-foreground font-sans">
            <User className="h-5 w-5 mr-2 text-indigo-650" />
            Profile Settings
          </h2>
        </div>
        <div className="p-6 space-y-6">
          
          {/* Avatar Upload block */}
          <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-border pb-6">
            <div className="relative h-20 w-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl.startsWith("gs://") ? "/favicon.ico" : avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                fullName ? fullName.slice(0, 2).toUpperCase() : "U"
              )}
            </div>
            <div>
              <span className="block text-sm font-medium text-slate-700">Avatar Image</span>
              <p className="text-xs text-slate-400 mt-1">Accepts PNG, JPG, JPEG. Max size 2MB.</p>
              
              <div className="mt-3 flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold px-3 py-2 border border-border rounded-lg hover:bg-muted transition cursor-pointer text-foreground">
                  <Upload className="h-3.5 w-3.5" />
                  Select File
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
                
                {uploadingAvatar && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}
                {avatarSuccess && <span className="text-xs text-emerald-500 font-medium flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Updated!</span>}
                {avatarError && <span className="text-xs text-red-500 font-medium">{avatarError}</span>}
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {profileSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200 flex items-center gap-2">
                <Check className="h-4 w-4" /> Profile options updated successfully.
              </div>
            )}
            {profileError && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                {profileError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-foreground font-medium bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full text-foreground font-medium bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
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
                <label className="block text-sm font-medium text-slate-500 mb-1">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-foreground font-medium bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value="en">English (US)</option>
                  <option value="es">Español (ES)</option>
                  <option value="fr">Français (FR)</option>
                  <option value="de">Deutsch (DE)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Premium Theme</label>
                <select
                  value={typeof window !== "undefined" ? localStorage.getItem("theme") || "dark" : "dark"}
                  onChange={(e) => {
                    const selected = e.target.value;
                    localStorage.setItem("theme", selected);
                    document.documentElement.setAttribute("data-theme", selected);
                    if (selected !== "executive-light") {
                      document.documentElement.classList.add("dark");
                    } else {
                      document.documentElement.classList.remove("dark");
                    }
                    window.dispatchEvent(new Event("theme-changed"));
                  }}
                  className="w-full text-foreground font-medium bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none animate-pulse-once"
                >
                  <option value="dark">Executive Dark (Slate/Graphite)</option>
                  <option value="executive-light">Executive Light (Minimalist Silver)</option>
                  <option value="midnight-blue">Midnight Blue (Deep Navy/Cyan)</option>
                  <option value="emerald-intelligence">Emerald Growth (Green/Emerald)</option>
                  <option value="royal-purple">Royal Purple (Premium AI Indigo)</option>
                  <option value="carbon-red">Carbon Red (Command Center Red)</option>
                  <option value="aurora">Aurora (Nebula Gradients)</option>
                </select>
              </div>

            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={updatingProfile}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-lg transition disabled:bg-indigo-650"
              >
                {updatingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>

        </div>
      </div>

      {/* Email Address Section */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center text-foreground">
            <Mail className="h-5 w-5 mr-2 text-indigo-650" />
            Email Management
          </h2>
          {profile?.email_verified ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <Check className="h-3 w-3" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              Verification Pending
            </span>
          )}
        </div>
        <div className="p-6 space-y-4">
          <form onSubmit={handleSaveEmail} className="space-y-4">
            {emailSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200 flex items-center gap-2">
                <Check className="h-4 w-4" /> {emailSuccess}
              </div>
            )}
            {emailError && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                {emailError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Current Email</label>
                <div className="text-slate-450 bg-slate-150/40 px-3 py-2 rounded-lg border border-slate-100 cursor-not-allowed">
                  {profile?.email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">New Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-foreground font-medium bg-background px-3 py-2 rounded-lg border border-border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={updatingEmail || email === profile?.email}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-lg transition disabled:bg-slate-100:bg-slate-800/60:text-slate-550 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
              >
                {updatingEmail && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Change Email Address
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Workspaces Section */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-slate-50/50">
          <h2 className="text-lg font-semibold flex items-center text-foreground">
            <Building2 className="h-5 w-5 mr-2 text-indigo-650" />
            Workspaces
          </h2>
        </div>
        <div className="p-6">
          {workspaces.length === 0 ? (
            <p className="text-muted-foreground text-sm">No workspaces found.</p>
          ) : (
            <div className="space-y-3">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-slate-50/30 hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{ws.name}</div>
                    <div className="text-sm text-muted-foreground font-mono">{ws.slug}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
 ws.role === "owner"
 ? "bg-indigo-100 text-indigo-800"
 : "bg-muted text-slate-800"
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
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-red-650 hover:text-red-750:text-red-300 px-3 py-1.5 rounded-md border border-red-200 hover:bg-red-50:bg-red-950/20 transition-colors cursor-pointer"
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
      </div>

      {/* Security Section */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-slate-50/50">
          <h2 className="text-lg font-semibold flex items-center text-foreground">
            <Lock className="h-5 w-5 mr-2 text-indigo-650" />
            Security
          </h2>
        </div>
        <div className="p-6">
          <button
            onClick={() => supabase.auth.resetPasswordForEmail(profile?.email || "", {
              redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            })}
            className="text-sm font-medium bg-card border border-slate-300 text-foreground px-4 py-2 rounded-md hover:bg-slate-50:bg-slate-900 transition-colors cursor-pointer"
          >
            Reset Account Password
          </button>
        </div>
      </div>

      {/* Danger Zone Section */}
      <div className="bg-red-50/30 rounded-xl border border-red-200 shadow-sm overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-red-200 bg-red-50/80">
          <h2 className="text-lg font-semibold flex items-center text-red-700">
            <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
            Danger Zone
          </h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-foreground font-medium">Delete Account</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Permanently remove your account, data, and workspace memberships. This action cannot be undone.
              </p>
            </div>
            <button
              onClick={() => {
                setShowDeleteAccountModal(true);
                setDeleteAccountConfirmText("");
                setDeleteAccountError("");
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl border border-border overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Delete Account
              </h3>
              <p className="text-slate-500 text-sm mb-4">
                This will permanently delete your account, remove your workspace memberships, and wipe your data. If you are the sole owner of a workspace, you must delete or transfer it first.
              </p>
              
              {deleteAccountError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                  {deleteAccountError}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
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
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setDeleteAccountLoading(true);
                    setDeleteAccountError("");
                    try {
                      const session = await getSession();
                      const res = await fetch(`${API_BASE_URL}/api/account/delete`, {
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
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {deleteAccountLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
