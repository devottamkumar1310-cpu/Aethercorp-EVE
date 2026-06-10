"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, LogOut, Lock, Building2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/profile/me`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });
        
        if (response.ok) {
          setProfile(await response.json());
        }
      } catch (e) {
        console.error("Failed to fetch profile", e);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProfile();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
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

        {/* Workspace Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-lg font-semibold flex items-center text-slate-800">
              <Building2 className="h-5 w-5 mr-2 text-indigo-600" />
              Workspace Configuration
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Workspace ID</label>
              <div className="text-slate-900 font-mono text-sm bg-slate-50 px-3 py-2 rounded border border-slate-100">
                {profile?.organization_id || "No Workspace Linked"}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Role</label>
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
                {profile?.role || "N/A"}
              </div>
            </div>
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

    </main>
  );
}
