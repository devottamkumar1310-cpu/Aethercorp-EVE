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
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center text-slate-800 dark:text-slate-100 font-sans">
            <User className="h-5 w-5 mr-2 text-indigo-650 dark:text-indigo-400" />
            Profile Settings
          </h2>
        </div>
        <div className="p-6 space-y-6">
          
          {/* Avatar Upload block */}
          <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
            <div className="relative h-20 w-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl.startsWith("gs://") ? "/favicon.ico" : avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                fullName ? fullName.slice(0, 2).toUpperCase() : "U"
              )}
            </div>
            <div>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-350">Avatar Image</span>
              <p className="text-xs text-slate-400 mt-1">Accepts PNG, JPG, JPEG. Max size 2MB.</p>
              
              <div className="mt-3 flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-slate-700 dark:text-slate-300">
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
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-sm rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                <Check className="h-4 w-4" /> Profile options updated successfully.
              </div>
            )}
            {profileError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
                {profileError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-450 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-slate-900 dark:text-slate-100 font-medium bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-450 mb-1">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full text-slate-900 dark:text-slate-100 font-medium bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
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
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-450 mb-1">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-slate-900 dark:text-slate-100 font-medium bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
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
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center text-slate-800 dark:text-slate-100">
            <Mail className="h-5 w-5 mr-2 text-indigo-650 dark:text-indigo-400" />
            Email Management
          </h2>
          {profile?.email_verified ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-450">
              <Check className="h-3 w-3" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-450">
              Verification Pending
            </span>
          )}
        </div>
        <div className="p-6 space-y-4">
          <form onSubmit={handleSaveEmail} className="space-y-4">
            {emailSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-sm rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                <Check className="h-4 w-4" /> {emailSuccess}
              </div>
            )}
            {emailError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
                {emailError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-450 mb-1">Current Email</label>
                <div className="text-slate-450 bg-slate-150/40 dark:bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-850 cursor-not-allowed">
                  {profile?.email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-450 mb-1">New Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-slate-900 dark:text-slate-100 font-medium bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={updatingEmail || email === profile?.email}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-lg transition disabled:bg-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-550 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
              >
                {updatingEmail && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Change Email Address
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Workspaces Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-lg font-semibold flex items-center text-slate-800 dark:text-slate-100">
            <Building2 className="h-5 w-5 mr-2 text-indigo-650 dark:text-indigo-400" />
            Workspaces
          </h2>
        </div>
        <div className="p-6">
          {workspaces.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">No workspaces found.</p>
          ) : (
            <div className="space-y-3">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/10 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{ws.name}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 font-mono">{ws.slug}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        ws.role === "owner"
                          ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-400"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300"
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
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-red-650 dark:text-red-400 hover:text-red-750 dark:hover:text-red-300 px-3 py-1.5 rounded-md border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
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
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-lg font-semibold flex items-center text-slate-800 dark:text-slate-100">
            <Lock className="h-5 w-5 mr-2 text-indigo-650 dark:text-indigo-400" />
            Security
          </h2>
        </div>
        <div className="p-6">
          <button
            onClick={() => supabase.auth.resetPasswordForEmail(profile?.email || "", {
              redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            })}
            className="text-sm font-medium bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-750 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Reset Account Password
          </button>
        </div>
      </div>

    </main>
  );
}
