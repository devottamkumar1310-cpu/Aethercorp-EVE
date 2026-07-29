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

export interface ExecutiveSummary {
  health_score: number;
  security_score: number;
  summary_text: string;
  generated_at: string;
}

export interface AdvancedUserAnalytics {
  dau: number;
  wau: number;
  mau: number;
  stickiness_pct: number;
  retention_cohorts: {
    d1_pct: number;
    d7_pct: number;
    d30_pct: number;
  };
  avg_session_duration_mins: number;
  active_hours: Array<{ hour: string; active_users: number }>;
  devices: Array<{ name: string; share_pct: number }>;
  browsers: Array<{ name: string; share_pct: number }>;
  os_dist: Array<{ name: string; share_pct: number }>;
}

export interface ProductFunnel {
  funnel: Array<{
    stage: string;
    users: number;
    conversion_pct: number;
  }>;
  feature_adoption: Array<{
    name: string;
    adoption_pct: number;
    avg_time_mins: number;
  }>;
  overall_activation_rate_pct: number;
}

export interface SecuritySOC {
  auth_summary: {
    successful_logins: number;
    failed_logins: number;
    google_logins_pct: number;
    password_logins_pct: number;
    active_sessions: number;
  };
  security_events: {
    http_401: number;
    http_403: number;
    http_404: number;
    http_429: number;
    http_500: number;
  };
  threat_flags: Array<{
    id: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    category: string;
    title: string;
    status: string;
    detail: string;
  }>;
}

export interface PredictiveAnalytics {
  user_forecast: {
    current: number;
    forecast_30d: number;
    lower_bound: number;
    upper_bound: number;
    confidence_pct: number;
  };
  api_load_forecast: {
    current_rpm: number;
    forecast_30d_rpm: number;
    confidence_pct: number;
  };
  ai_token_forecast: {
    current_daily_tokens: number;
    forecast_30d_daily_tokens: number;
    estimated_monthly_cost_usd: number;
    confidence_pct: number;
  };
  scaling_recommendation: {
    cloud_run_instances: string;
    database_pool_size: string;
    storage_growth_est_mb: number;
  };
}

export interface LivePerformance {
  system_resources: {
    cpu_percent: number;
    memory_percent: number;
  };
  latencies: {
    db_ping_ms: number;
    api_avg_ms: number;
    api_p95_ms: number;
    api_p99_ms: number;
  };
  services: {
    cloud_run: string;
    supabase_auth: string;
    database: string;
    gemini_api: string;
    gcs_storage: string;
  };
  error_rate_pct: number;
  requests_per_minute: number;
}

async function handleResponse<T>(res: Response, endpointName: string): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const json = await res.json();
      detail = json.detail || json.message || "";
    } catch {
      // Ignore JSON parse failure
    }

    if (res.status === 403) {
      throw new Error(detail || "Access Denied: Owner privileges required (HTTP 403).");
    }
    if (res.status === 401) {
      throw new Error(detail || "Session Expired: Please log in again (HTTP 401).");
    }

    const statusFallback = res.statusText ? `HTTP ${res.status} ${res.statusText}` : `HTTP ${res.status} Error`;
    throw new Error(detail || `Failed to fetch ${endpointName}: ${statusFallback}`);
  }
  return res.json();
}

export const ownerAnalyticsService = {
  async getOverview(token: string): Promise<OverviewMetrics> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<OverviewMetrics>(res, "overview");
  },

  async getUsers(token: string, limit = 50): Promise<UserAnalytics> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/users?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<UserAnalytics>(res, "user analytics");
  },

  async getAIAnalytics(token: string): Promise<AIAnalytics> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/ai`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<AIAnalytics>(res, "AI analytics");
  },

  async getAlerts(token: string): Promise<SystemAlert[]> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/alerts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<SystemAlert[]>(res, "system alerts");
  },

  async getFeatureUsage(token: string): Promise<FeatureUsage> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/feature-usage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<FeatureUsage>(res, "feature usage");
  },

  async getHealth(token: string): Promise<PlatformHealth> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<PlatformHealth>(res, "platform health");
  },

  async getEvents(token: string, limit = 50): Promise<InternalEvent[]> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/events?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<InternalEvent[]>(res, "recent events");
  },

  async getExecutiveSummary(token: string): Promise<ExecutiveSummary> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/executive-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<ExecutiveSummary>(res, "executive summary");
  },

  async getAdvancedUserAnalytics(token: string): Promise<AdvancedUserAnalytics> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/user-advanced`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<AdvancedUserAnalytics>(res, "advanced user analytics");
  },

  async getProductFunnel(token: string): Promise<ProductFunnel> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/product-funnel`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<ProductFunnel>(res, "product funnel");
  },

  async getSecuritySOC(token: string): Promise<SecuritySOC> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/security-soc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<SecuritySOC>(res, "security SOC");
  },

  async getPredictiveAnalytics(token: string): Promise<PredictiveAnalytics> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/predictive`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<PredictiveAnalytics>(res, "predictive analytics");
  },

  async getLivePerformance(token: string): Promise<LivePerformance> {
    const res = await apiFetch(`${API_BASE_URL}/api/internal/performance-live`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse<LivePerformance>(res, "live performance");
  },
};

