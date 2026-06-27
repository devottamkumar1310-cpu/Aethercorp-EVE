"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, Lock, Building2, Trash2, AlertTriangle, Shield } from "lucide-react";
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDeveloperMode(localStorage.getItem("developer_mode") === "true");
    }
  }, []);

  const handleToggleDeveloperMode = (enabled: boolean) => {
    setDeveloperMode(enabled);
    localStorage.setItem("developer_mode", String(enabled));
  };

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
          setProfile(await profileRes.json());
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

      // Close modal and refresh workspaces
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

      // Sign out and redirect to landing page
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
        {/* Profile Card Skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-48 flex flex-col justify-between">
          <div className="h-12 bg-slate-100 border-b border-slate-200" />
          <div className="p-6 space-y-4 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-10 bg-slate-100 rounded border border-slate-200" />
              <div className="h-10 bg-slate-100 rounded border border-slate-200" />
            </div>
          </div>
        </div>

        {/* Workspaces Card Skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-52">
          <div className="h-12 bg-slate-100 border-b border-slate-200" />
          <div className="p-6 space-y-3">
            <div className="h-14 bg-slate-50 border border-slate-200 rounded-lg w-full" />
            <div className="h-14 bg-slate-50 border border-slate-200 rounded-lg w-full" />
          </div>
        </div>

        {/* Security Skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-36">
          <div className="h-12 bg-slate-100 border-b border-slate-200" />
          <div className="p-6">
            <div className="h-10 bg-slate-100 border border-slate-300 rounded w-44" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto w-full space-y-8 transition-colors duration-200">

      {/* Profile Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-lg font-semibold flex items-center text-slate-850 dark:text-slate-100">
            <User className="h-5 w-5 mr-2 text-indigo-650 dark:text-indigo-400" />
            Profile Information
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Full Name</label>
              <div className="text-slate-900 dark:text-slate-100 font-medium bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded border border-slate-100 dark:border-slate-850">
                {profile?.full_name || "N/A"}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Email Address</label>
              <div className="text-slate-900 dark:text-slate-100 font-medium bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded border border-slate-100 dark:border-slate-850">
                {profile?.email || "N/A"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workspaces Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-lg font-semibold flex items-center text-slate-850 dark:text-slate-100">
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
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-750 dark:hover:text-red-300 px-3 py-1.5 rounded-md border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
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
          <h2 className="text-lg font-semibold flex items-center text-slate-850 dark:text-slate-100">
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
            Send Password Reset Email
          </button>
        </div>
      </div>

      {/* Developer Settings Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <h2 className="text-lg font-semibold flex items-center text-slate-850 dark:text-slate-100">
            <Lock className="h-5 w-5 mr-2 text-indigo-650 dark:text-indigo-400" />
            Developer Settings
          </h2>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Developer Mode</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Enable advanced telemetry monitoring, sub-agent latency stats, routing classifications, and developer logs.
            </p>
          </div>
          <button
            onClick={() => handleToggleDeveloperMode(!developerMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
              developerMode ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-800"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-950 transition-transform ${
                developerMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Danger Zone Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-red-200 dark:border-red-905 bg-red-50/50 dark:bg-red-955/15">
          <h2 className="text-lg font-semibold flex items-center text-red-700 dark:text-red-400">
            <Shield className="h-5 w-5 mr-2 text-red-650" />
            Danger Zone
          </h2>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Delete Account</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Deleting your account permanently removes all associated data and cannot be undone.
              </p>
            </div>
            <button
              onClick={() => {
                setShowDeleteAccountModal(true);
                setDeleteAccountConfirmText("");
                setDeleteAccountError("");
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors shrink-0 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Workspace Confirmation Modal */}
      {deleteWsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <h3 className="text-lg font-semibold flex items-center text-slate-850 dark:text-slate-100">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                Delete Workspace
              </h3>
            </div>
            <div className="p-6 space-y-4 text-slate-800 dark:text-slate-200">
              <p className="text-sm text-slate-600 dark:text-slate-350">
                This will permanently delete the workspace{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">{deleteWsModal.name}</span>{" "}
                and all of its data. This action cannot be undone.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Type <span className="font-semibold text-red-650">{deleteWsModal.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteWsConfirmText}
                  onChange={(e) => setDeleteWsConfirmText(e.target.value)}
                  placeholder={deleteWsModal.name}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-955 text-slate-900 dark:text-slate-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              {deleteWsError && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-955/20 px-3 py-2 rounded-md border border-red-100 dark:border-red-900/60">
                  {deleteWsError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeleteWsModal(null)}
                  disabled={deleteWsLoading}
                  className="text-sm font-medium bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteWorkspace}
                  disabled={deleteWsConfirmText !== deleteWsModal.name || deleteWsLoading}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md transition-colors ${
                    deleteWsConfirmText === deleteWsModal.name && !deleteWsLoading
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {deleteWsLoading ? "Deleting..." : "Delete Workspace"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-955/25">
              <h3 className="text-lg font-semibold flex items-center text-red-700 dark:text-red-400">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                Delete Account
              </h3>
            </div>
            <div className="p-6 space-y-4 text-slate-800 dark:text-slate-200">
              <p className="text-sm text-slate-600 dark:text-slate-350">
                Deleting your account permanently removes all associated data and cannot be undone. This will permanently delete your account, all workspaces you own, and all associated data. If you have any questions or require support before deletion, please email us at <a href="mailto:aethercorp.support@gmail.com" className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">aethercorp.support@gmail.com</a>.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Type <span className="font-semibold text-red-600">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteAccountConfirmText}
                  onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-955 text-slate-900 dark:text-slate-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              {deleteAccountError && (
                <p className="text-sm text-red-650 bg-red-50 dark:bg-red-955/20 px-3 py-2 rounded-md border border-red-100 dark:border-red-900/60">
                  {deleteAccountError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteAccountModal(false)}
                  disabled={deleteAccountLoading}
                  className="text-sm font-medium bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteAccountConfirmText !== "DELETE" || deleteAccountLoading}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md transition-colors ${
                    deleteAccountConfirmText === "DELETE" && !deleteAccountLoading
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {deleteAccountLoading ? "Deleting..." : "Delete My Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
