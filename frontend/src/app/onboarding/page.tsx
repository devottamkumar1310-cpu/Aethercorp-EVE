"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Building2, ArrowRight, Sparkles, Brain } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

export default function OnboardingPage() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check if user already has a workspace
    async function checkWorkspace() {
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
          const data = await response.json();
          if (data.organization_id) {
            router.push("/dashboard/inventory");
          }
        }
      } catch (e) {
        console.error("Failed to check workspace", e);
      }
    }
    
    checkWorkspace();
  }, [router, supabase]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/organization/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name: workspaceName })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to create workspace");
      }

      const data = await response.json();
      localStorage.setItem("active_workspace_id", data.organization_id);

      router.push("/dashboard/inventory");
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleCreateDemoWorkspace = async () => {
    setLoadingDemo(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/organization/onboard-demo`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to create demo workspace");
      }

      const data = await response.json();
      localStorage.setItem("active_workspace_id", data.organization_id);

      router.push("/dashboard/inventory");
    } catch (e: any) {
      setError(e.message);
      setLoadingDemo(false);
    }
  };



  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Radial Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-xl bg-background/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-border overflow-hidden z-10">
        <div className="p-8 md:p-10">
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-foreground font-bold text-xl tracking-tighter shadow-lg shadow-indigo-600/20">
              EVE
            </div>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center tracking-tight mb-2">
            Welcome to EVE
          </h2>
          <p className="text-muted-foreground text-center mb-8 text-sm md:text-base">
            Set up your brand's intelligence hub to begin forecasting and optimizing operations.
          </p>

          {error && (
            <div className="p-3 mb-6 bg-red-500/10 text-red-300 text-sm rounded-xl border border-red-500/20">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Demo Workspace Card (Option A) */}
            <button
              onClick={handleCreateDemoWorkspace}
              disabled={loading || loadingDemo}
              className="w-full text-left p-5 bg-gradient-to-br from-slate-900 to-slate-950 border border-indigo-500/30 hover:border-indigo-500/80 rounded-xl transition-all shadow-md group relative hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="absolute top-3 right-3 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1">
                <Sparkles size={10} /> Recommended
              </div>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:bg-indigo-500 group-hover:text-foreground transition-colors">
                  <Brain size={24} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                    Explore with Demo Workspace
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Instantly load a model apparel brand preloaded with inventory ledger items, client projects, sample purchase invoices, and chat history.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end text-xs font-bold text-indigo-400 group-hover:text-indigo-300 pt-3 border-t border-border mt-3">
                {loadingDemo ? "Provisioning Sandbox..." : "Get Started Instantly"}
                <ArrowRight size={14} className="ml-1.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Custom Brand Workspace Setup (Option B) */}
            {!showManualForm ? (
              <button
                onClick={() => setShowManualForm(true)}
                disabled={loading || loadingDemo}
                className="w-full text-left p-5 bg-card border border-border hover:border-border rounded-xl transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-secondary text-muted-foreground rounded-lg group-hover:bg-secondary group-hover:text-foreground transition-colors">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground group-hover:text-muted-foreground transition-colors">
                      Configure Clean Workspace
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Start fresh. Create a blank organization database and upload your own sales spreadsheets and supplier invoices.
                    </p>
                  </div>
                </div>
              </button>
            ) : (
              <form onSubmit={handleCreateWorkspace} className="p-5 bg-card border border-border rounded-xl space-y-4 animate-in slide-in-from-bottom-2 duration-200">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Building2 size={16} className="text-indigo-400" /> Enter Workspace Details
                </h3>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Brand / Company Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <input
                      type="text"
                      required
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="pl-10 block w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm outline-none transition-all"
                      placeholder="Acme Wearables"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading || !workspaceName.trim()}
                    className="flex-1 flex justify-center items-center py-2 px-4 border border-transparent rounded-lg text-sm font-semibold text-foreground bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {loading ? "Creating..." : "Create Workspace"}
                    {!loading && <ArrowRight size={14} className="ml-1.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualForm(false)}
                    className="py-2 px-4 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-all"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
