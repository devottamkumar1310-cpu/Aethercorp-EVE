import { API_BASE_URL, apiFetch } from "@/lib/api";
import { DashboardSummary, Client, Project, Task, Revenue, Expense, ActivityLog, BusinessKPIs } from "@/types/business";

export function getHeaders(token: string, contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  };
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (typeof window !== "undefined") {
    const activeWorkspace = localStorage.getItem("active_workspace_id");
    if (activeWorkspace) {
      headers["X-Workspace-Id"] = activeWorkspace;
    }
  }
  return headers;
}

export async function fetchDashboardSummary(token: string): Promise<DashboardSummary> {
  const res = await apiFetch(`${API_BASE_URL}/api/dashboard/summary`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch dashboard summary");
  return res.json();
}

export async function fetchBusinessKPIs(token: string): Promise<BusinessKPIs> {
  const res = await apiFetch(`${API_BASE_URL}/api/dashboard/kpis`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch KPIs");
  return res.json();
}

export async function fetchClients(token: string): Promise<Client[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/clients/`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch clients");
  return res.json();
}

export async function fetchProjects(token: string): Promise<Project[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/projects/`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function fetchTasks(token: string): Promise<Task[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/tasks/`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

export async function fetchRevenues(token: string): Promise<Revenue[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/finance/revenue`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch revenues");
  return res.json();
}

export async function fetchExpenses(token: string): Promise<Expense[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/finance/expenses`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch expenses");
  return res.json();
}

export async function fetchActivityLogs(token: string): Promise<ActivityLog[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/activity/`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch activity logs");
  return res.json();
}

// Mutations
async function apiCall(url: string, method: string, token: string, body?: any) {
  const res = await apiFetch(`${API_BASE_URL}${url}`, {
    method,
    headers: getHeaders(token, "application/json"),
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (!res.ok) {
    let errorMsg = `Failed to ${method} ${url}`;
    try {
      const errorData = await res.json();
      errorMsg = errorData.detail || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }
  return res.json();
}

// Clients
export const createClientAPI = (token: string, data: any) => apiCall('/api/clients/', 'POST', token, data);
export const updateClientAPI = (token: string, id: string, data: any) => apiCall(`/api/clients/${id}`, 'PUT', token, data);
export const deleteClientAPI = (token: string, id: string) => apiCall(`/api/clients/${id}`, 'DELETE', token);

// Projects
export const createProjectAPI = (token: string, data: any) => apiCall('/api/projects/', 'POST', token, data);
export const updateProjectAPI = (token: string, id: string, data: any) => apiCall(`/api/projects/${id}`, 'PUT', token, data);
export const deleteProjectAPI = (token: string, id: string) => apiCall(`/api/projects/${id}`, 'DELETE', token);

// Tasks
export const createTaskAPI = (token: string, data: any) => apiCall('/api/tasks/', 'POST', token, data);
export const updateTaskAPI = (token: string, id: string, data: any) => apiCall(`/api/tasks/${id}`, 'PUT', token, data);
export const deleteTaskAPI = (token: string, id: string) => apiCall(`/api/tasks/${id}`, 'DELETE', token);

// Finance
export const createRevenueAPI = (token: string, data: any) => apiCall('/api/finance/revenue', 'POST', token, data);
export const createExpenseAPI = (token: string, data: any) => apiCall('/api/finance/expenses', 'POST', token, data);

// Inventory
export async function fetchInventoryDashboard(token: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/inventory/dashboard`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch inventory dashboard");
  return res.json();
}

export async function fetchInventoryAlerts(token: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/inventory/alerts`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch inventory alerts");
  return res.json();
}

// Recommendation Traceability
export async function updateRecommendationStatusAPI(token: string, traceId: string, statusValue: "Reviewed" | "Accepted" | "Dismissed" | "Completed"): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/api/recommendations/${traceId}/status`, {
    method: "PATCH",
    headers: getHeaders(token, "application/json"),
    body: JSON.stringify({ status: statusValue })
  });
  if (!res.ok) {
    let detail = "Failed to update recommendation status";
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

async function uploadCSVFile(url: string, token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const headers = getHeaders(token);

  const res = await apiFetch(`${API_BASE_URL}${url}`, {
    method: "POST",
    headers,
    body: formData
  });

  if (!res.ok) {
    let errorMsg = `Failed to upload file to ${url}`;
    try {
      const errorData = await res.json();
      // The importer reports a failed import as a structured body (status,
      // missing_columns, errors) with no `detail` key. Reading only `detail`
      // discarded it and left the caller with a generic string, so the
      // "your CSV is missing these columns" summary could never render.
      // Forward the whole body; callers JSON.parse it back.
      errorMsg =
        typeof errorData?.detail === "string"
          ? errorData.detail
          : errorData
            ? JSON.stringify(errorData)
            : errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }
  return res.json();
}

export const uploadInventoryCSVAPI = (token: string, file: File) => uploadCSVFile('/api/inventory/upload/inventory', token, file);
export const uploadSalesCSVAPI = (token: string, file: File) => uploadCSVFile('/api/inventory/upload/sales', token, file);
export const uploadCostsCSVAPI = (token: string, file: File) => uploadCSVFile('/api/inventory/upload/costs', token, file);
/**
 * Import mode for the master CSV.
 *
 * "merge"   — upsert by SKU into the active workspace (the default, unchanged).
 * "replace" — clear the workspace first. Only valid on a demo workspace; the
 *             backend refuses it on a workspace holding the merchant's own data.
 */
export type MasterImportMode = "merge" | "replace";

export const uploadMasterCSVAPI = (
  token: string,
  file: File,
  mode: MasterImportMode = "merge"
) =>
  uploadCSVFile(
    `/api/inventory/upload/master?mode=${encodeURIComponent(mode)}`,
    token,
    file
  );

/**
 * Re-runs the proactive analysis for a workspace. Backs the "Try again" action
 * on a failed or timed-out run, so a merchant never has to re-import a
 * catalogue that imported correctly just to get a first insight.
 */
export async function retryAnalysis(token: string, organizationId: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/api/organization/${organizationId}/analysis/retry`,
    { method: "POST", headers: getHeaders(token) }
  );
  if (!res.ok) throw new Error("Couldn't restart the analysis. Please try again shortly.");
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
  member_count: number;
  /** True while the workspace still holds the seeded demo catalogue. */
  is_demo: boolean;
}

export async function fetchWorkspaces(token: string): Promise<WorkspaceSummary[]> {
  const res = await apiFetch(`${API_BASE_URL}/api/organization/workspaces`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch workspaces");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Creates an empty workspace and returns its id. Used when a merchant chooses
 * to import their catalogue into a workspace of their own rather than over the
 * demo they were exploring.
 */
export async function createWorkspace(token: string, name: string): Promise<string> {
  const res = await apiFetch(`${API_BASE_URL}/api/organization/onboard`, {
    method: "POST",
    headers: getHeaders(token, "application/json"),
    body: JSON.stringify({ name })
  });
  if (!res.ok) {
    let message = "Failed to create workspace";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
    } catch {}
    throw new Error(message);
  }
  const data = await res.json();
  return data.organization_id as string;
}

export const submitFeedbackAPI = (
  token: string,
  data: { rating: number; category: string; description: string; page_url?: string }
) => apiCall('/api/feedback/', 'POST', token, data);
