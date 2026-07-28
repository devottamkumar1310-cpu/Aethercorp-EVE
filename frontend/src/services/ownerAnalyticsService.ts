import { apiFetch, API_BASE_URL } from "@/lib/api";

export interface OverviewMetrics {
  total_users: number;
  new_users_24h: number;
  new_users_7d: number;
  new_users_30d: number;
  active_users_5m: number;
  active_users_15m: number;
  active_users_24h: number;
  retention_d7_pct: number;
  total_organizations: number;
  total_memberships: number;
  demo_workspaces: number;
  custom_workspaces: number;
  plan_distribution: Record<string, number>;
  total_events: number;
  events_24h: number;
  calculated_at: string;
}

export interface UserAnalytics {
  users: Array<{
    id: string;
    email: string;
    full_name: string | null;
    created_at: string | null;
    last_active_at: string | null;
    is_active: boolean;
    subscription_status: string;
    plan_type: string;
    organizations_count: number;
  }>;
  signup_trend: Array<{
    date: string;
    count: number;
  }>;
}

export interface AIAnalytics {
  total_conversations: number;
  total_prompts: number;
  avg_response_time_ms: number;
  ai_errors_24h: number;
  total_recommendation_traces: number;
  accepted_traces: number;
  acceptance_rate_pct: number;
  most_common_workflows: Array<{
    name: string;
    share_pct: number;
  }>;
}

export interface SystemAlert {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  action: string;
}

export interface FeatureUsage {
  feature_counts: Record<string, number>;
  top_endpoints: Array<{
    endpoint: string;
    avg_latency_ms: number;
    count: number;
  }>;
}

export interface PlatformHealth {
  status: string;
  deployment: {
    environment: string;
    cloud_run_revision: string;
    backend_version: string;
    frontend_version: string;
  };
  database: {
    status: string;
    latency_ms: number;
  };
  storage: {
    status: string;
  };
  system: {
    cpu_percent: number;
    memory_percent: number;
  };
  error_count_24h: number;
  checked_at: string;
}

export interface InternalEvent {
  id: string;
  event_type: string;
  user_id: string | null;
  organization_id: string | null;
  endpoint: string | null;
  status_code: number | null;
  latency_ms: number | null;
  metadata: Record<string, any> | null;
  created_at: string | null;
}

export const ownerAnalyticsService = {
  async getOverview(token: string): Promise<OverviewMetrics> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error("Access Denied: Owner privileges required.");
      throw new Error(`Failed to fetch overview: ${res.statusText}`);
    }
    return res.json();
  },

  async getUsers(token: string, limit = 50): Promise<UserAnalytics> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/users?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch user analytics: ${res.statusText}`);
    return res.json();
  },

  async getAIAnalytics(token: string): Promise<AIAnalytics> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/ai`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch AI analytics: ${res.statusText}`);
    return res.json();
  },

  async getAlerts(token: string): Promise<SystemAlert[]> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/alerts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch system alerts: ${res.statusText}`);
    return res.json();
  },

  async getFeatureUsage(token: string): Promise<FeatureUsage> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/feature-usage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch feature usage: ${res.statusText}`);
    return res.json();
  },

  async getHealth(token: string): Promise<PlatformHealth> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch platform health: ${res.statusText}`);
    return res.json();
  },

  async getEvents(token: string, limit = 50): Promise<InternalEvent[]> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/events?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch internal events: ${res.statusText}`);
    return res.json();
  },
};
