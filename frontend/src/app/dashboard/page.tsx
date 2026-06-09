"use client";

import { useEffect, useState } from "react";
import { DashboardMetrics } from "@/types/dashboard";
import { ChatResponse } from "@/types/chat";
import { fetchDashboardMetrics } from "@/services/dashboardService";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL } from "@/lib/api";

import { ExecutiveKPICards } from "@/components/dashboard/ExecutiveKPICards";
import { InventoryHealthTable } from "@/components/dashboard/InventoryHealthTable";
import { PricingRecommendationsTable } from "@/components/dashboard/PricingRecommendationsTable";
import { ExecutiveSummaryCard } from "@/components/dashboard/ExecutiveSummaryCard";
import { ExecutiveScenarioPlannerCard } from "@/components/dashboard/ExecutiveScenarioPlannerCard";
import { CashFlowForecastCard } from "@/components/dashboard/CashFlowForecastCard";
import { AgentActivityMonitor } from "@/components/dashboard/AgentActivityMonitor";
import { CEOChatConsole } from "@/components/chat/CEOChatConsole";

import { InventoryRiskChart } from "@/components/charts/InventoryRiskChart";
import { StockoutPredictionChart } from "@/components/charts/StockoutPredictionChart";
import { ProfitImpactChart } from "@/components/charts/ProfitImpactChart";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<ChatResponse | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    async function initializeDashboard() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          window.location.href = "/login";
          return;
        }

        // 1. Fetch Profile
        const profileRes = await fetch(`${API_BASE_URL}/api/profile/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfile(profileData);
          
          if (!profileData.organization_id) {
            console.log("[Auth] User missing organization_id. Initiating redirect to /onboarding...");
            setNeedsOnboarding(true);
            setLoading(false);
            setTimeout(() => {
              window.location.href = "/onboarding";
            }, 2000);
            return;
          }
        } else {
          throw new Error("Failed to authenticate profile");
        }

        // 2. Fetch Metrics (only if workspace exists)
        const data = await fetchDashboardMetrics(session.access_token);
        setMetrics(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to connect to backend");
      } finally {
        setLoading(false);
      }
    }
    initializeDashboard();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold tracking-tighter">
            EVE
          </div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Enterprise Virtual Executive</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <div className="flex flex-col items-end">
            <span className="font-semibold text-slate-800">
              Welcome back, {profile?.full_name || "Founder"}
            </span>
            <span className="text-xs">Workspace: {profile?.organization_id ? "Active" : "No Workspace"}</span>
          </div>
          <a href="/dashboard/settings" className="px-3 py-1.5 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors">
            Settings
          </a>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>
              {error}. Ensure the Python backend is running on port 8000.
            </AlertDescription>
          </Alert>
        )}

        {needsOnboarding ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
            <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-4 shadow-sm border border-indigo-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Workspace Setup Required</h2>
            <p className="text-slate-500 max-w-md">
              EVE requires a dedicated workspace to generate accurate business intelligence. Redirecting you to the onboarding flow...
            </p>
            <div className="mt-8 animate-pulse text-indigo-600 text-sm font-medium">Redirecting...</div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-6">
              <ExecutiveKPICards metrics={metrics} loading={loading} />
              
              <div className="grid lg:grid-cols-2 gap-6">
                <ExecutiveScenarioPlannerCard actions={metrics?.top_3_actions} loading={loading} />
                <div className="space-y-6">
                  <ExecutiveSummaryCard 
                    summary={chatData ? chatData.executive_summary : null} 
                    loading={false} 
                  />
                  <CashFlowForecastCard forecast={metrics?.cash_flow_forecast} loading={loading} />
                </div>
              </div>

              <Tabs defaultValue="inventory" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                  <TabsTrigger value="inventory">Inventory Intelligence</TabsTrigger>
                  <TabsTrigger value="pricing">Pricing & Margin</TabsTrigger>
                </TabsList>
                
                <TabsContent value="inventory" className="space-y-6 mt-6">
                  <div className="grid lg:grid-cols-2 gap-6">
                    <InventoryRiskChart metrics={metrics} />
                    <StockoutPredictionChart metrics={metrics} />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-4">Stockout & Reorder Analysis</h3>
                    <InventoryHealthTable metrics={metrics} loading={loading} />
                  </div>
                </TabsContent>

                <TabsContent value="pricing" className="space-y-6 mt-6">
                  <div className="grid lg:grid-cols-2 gap-6">
                    <ProfitImpactChart metrics={metrics} />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-4">Elasticity Recommendations</h3>
                    <PricingRecommendationsTable metrics={metrics} loading={loading} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="w-full lg:w-[450px] space-y-6 flex flex-col">
              <CEOChatConsole onChatResponse={setChatData} />
              <div className="flex-1 min-h-[300px]">
                <AgentActivityMonitor chatData={chatData} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
