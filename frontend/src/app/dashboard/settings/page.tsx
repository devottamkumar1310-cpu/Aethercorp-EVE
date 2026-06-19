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
      <div className="flex-1 p-6 flex justify-center items-center h-screen bg-slate-50">
        <div className="animate-pulse text-indigo-600 font-medium">Loading settings...</div>
      </div>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto w-full space-y-8">

      {/* Profile Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-lg font-semibold flex items-center text-slate-800">
            <User className="h-5 w-5 mr-2 text-indigo-600" />
            Profile Information
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Full Name</label>
              <div className="text-slate-900 font-medium bg-slate-50 px-3 py-2 rounded border border-slate-100">
                {profile?.full_name || "N/A"}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Email Address</label>
              <div className="text-slate-900 font-medium bg-slate-50 px-3 py-2 rounded border border-slate-100">
                {profile?.email || "N/A"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workspaces Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-lg font-semibold flex items-center text-slate-800">
            <Building2 className="h-5 w-5 mr-2 text-indigo-600" />
            Workspaces
          </h2>
        </div>
        <div className="p-6">
          {workspaces.length === 0 ? (
            <p className="text-slate-500 text-sm">No workspaces found.</p>
          ) : (
            <div className="space-y-3">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50/30 hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900">{ws.name}</div>
                    <div className="text-sm text-slate-500 font-mono">{ws.slug}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        ws.role === "owner"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-slate-100 text-slate-800"
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
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-md border border-red-200 hover:bg-red-50 transition-colors"
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-lg font-semibold flex items-center text-slate-800">
            <Lock className="h-5 w-5 mr-2 text-indigo-600" />
            Security
          </h2>
        </div>
        <div className="p-6">
          <button
            onClick={() => supabase.auth.resetPasswordForEmail(profile?.email || "")}
            className="text-sm font-medium bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 transition-colors"
          >
            Send Password Reset Email
          </button>
        </div>
      </div>

      {/* Developer Settings Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-lg font-semibold flex items-center text-slate-800">
            <Lock className="h-5 w-5 mr-2 text-indigo-600" />
            Developer Settings
          </h2>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">Developer Mode</h3>
            <p className="text-sm text-slate-500">
              Enable advanced telemetry monitoring, sub-agent latency stats, routing classifications, and developer logs.
            </p>
          </div>
          <button
            onClick={() => handleToggleDeveloperMode(!developerMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
              developerMode ? "bg-indigo-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                developerMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Danger Zone Section */}
      <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-red-200 bg-red-50/50">
          <h2 className="text-lg font-semibold flex items-center text-red-700">
            <Shield className="h-5 w-5 mr-2 text-red-600" />
            Danger Zone
          </h2>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">Delete Account</h3>
              <p className="text-sm text-slate-500">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <button
              onClick={() => {
                setShowDeleteAccountModal(true);
                setDeleteAccountConfirmText("");
                setDeleteAccountError("");
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors shrink-0 ml-4"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Workspace Confirmation Modal */}
      {deleteWsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-lg font-semibold flex items-center text-slate-800">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                Delete Workspace
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                This will permanently delete the workspace{" "}
                <span className="font-semibold text-slate-900">{deleteWsModal.name}</span>{" "}
                and all of its data. This action cannot be undone.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Type <span className="font-semibold text-red-600">{deleteWsModal.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteWsConfirmText}
                  onChange={(e) => setDeleteWsConfirmText(e.target.value)}
                  placeholder={deleteWsModal.name}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              {deleteWsError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-100">
                  {deleteWsError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeleteWsModal(null)}
                  disabled={deleteWsLoading}
                  className="text-sm font-medium bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteWorkspace}
                  disabled={deleteWsConfirmText !== deleteWsModal.name || deleteWsLoading}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md transition-colors ${
                    deleteWsConfirmText === deleteWsModal.name && !deleteWsLoading
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-slate-300 text-slate-500 cursor-not-allowed"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-200 bg-red-50/50">
              <h3 className="text-lg font-semibold flex items-center text-red-700">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                Delete Account
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                This will permanently delete your account, all workspaces you own, and all associated data.{" "}
                <span className="font-semibold text-red-600">This action cannot be undone.</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Type <span className="font-semibold text-red-600">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteAccountConfirmText}
                  onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              {deleteAccountError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-100">
                  {deleteAccountError}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteAccountModal(false)}
                  disabled={deleteAccountLoading}
                  className="text-sm font-medium bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteAccountConfirmText !== "DELETE" || deleteAccountLoading}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md transition-colors ${
                    deleteAccountConfirmText === "DELETE" && !deleteAccountLoading
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-slate-300 text-slate-500 cursor-not-allowed"
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
