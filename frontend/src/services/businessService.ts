import { API_BASE_URL } from "@/lib/api";
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
  const res = await fetch(`${API_BASE_URL}/api/dashboard/summary`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch dashboard summary");
  return res.json();
}

export async function fetchBusinessKPIs(token: string): Promise<BusinessKPIs> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/kpis`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch KPIs");
  return res.json();
}

export async function fetchClients(token: string): Promise<Client[]> {
  const res = await fetch(`${API_BASE_URL}/clients/`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch clients");
  return res.json();
}

export async function fetchProjects(token: string): Promise<Project[]> {
  const res = await fetch(`${API_BASE_URL}/projects/`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function fetchTasks(token: string): Promise<Task[]> {
  const res = await fetch(`${API_BASE_URL}/tasks/`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

export async function fetchRevenues(token: string): Promise<Revenue[]> {
  const res = await fetch(`${API_BASE_URL}/finance/revenue`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch revenues");
  return res.json();
}

export async function fetchExpenses(token: string): Promise<Expense[]> {
  const res = await fetch(`${API_BASE_URL}/finance/expenses`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch expenses");
  return res.json();
}

export async function fetchActivityLogs(token: string): Promise<ActivityLog[]> {
  const res = await fetch(`${API_BASE_URL}/activity-logs/`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch activity logs");
  return res.json();
}

// Mutations
async function apiCall(url: string, method: string, token: string, body?: any) {
  const res = await fetch(`${API_BASE_URL}${url}`, {
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
export const createClientAPI = (token: string, data: any) => apiCall('/clients/', 'POST', token, data);
export const updateClientAPI = (token: string, id: string, data: any) => apiCall(`/clients/${id}`, 'PUT', token, data);
export const deleteClientAPI = (token: string, id: string) => apiCall(`/clients/${id}`, 'DELETE', token);

// Projects
export const createProjectAPI = (token: string, data: any) => apiCall('/projects/', 'POST', token, data);
export const updateProjectAPI = (token: string, id: string, data: any) => apiCall(`/projects/${id}`, 'PUT', token, data);
export const deleteProjectAPI = (token: string, id: string) => apiCall(`/projects/${id}`, 'DELETE', token);

// Tasks
export const createTaskAPI = (token: string, data: any) => apiCall('/tasks/', 'POST', token, data);
export const updateTaskAPI = (token: string, id: string, data: any) => apiCall(`/tasks/${id}`, 'PUT', token, data);
export const deleteTaskAPI = (token: string, id: string) => apiCall(`/tasks/${id}`, 'DELETE', token);

// Finance
export const createRevenueAPI = (token: string, data: any) => apiCall('/finance/revenue', 'POST', token, data);
export const createExpenseAPI = (token: string, data: any) => apiCall('/finance/expenses', 'POST', token, data);

// Inventory
export async function fetchInventoryDashboard(token: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/inventory/dashboard`, {
    headers: getHeaders(token)
  });
  if (!res.ok) throw new Error("Failed to fetch inventory dashboard");
  return res.json();
}

async function uploadCSVFile(url: string, token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  
  const headers = getHeaders(token);
  
  const res = await fetch(`${API_BASE_URL}${url}`, {
    method: "POST",
    headers,
    body: formData
  });
  
  if (!res.ok) {
    let errorMsg = `Failed to upload file to ${url}`;
    try {
      const errorData = await res.json();
      errorMsg = errorData.detail || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }
  return res.json();
}

export const uploadInventoryCSVAPI = (token: string, file: File) => uploadCSVFile('/api/inventory/upload/inventory', token, file);
export const uploadSalesCSVAPI = (token: string, file: File) => uploadCSVFile('/api/inventory/upload/sales', token, file);
export const uploadCostsCSVAPI = (token: string, file: File) => uploadCSVFile('/api/inventory/upload/costs', token, file);

export const submitFeedbackAPI = (
  token: string,
  data: { rating: number; category: string; description: string; page_url?: string }
) => apiCall('/api/feedback/', 'POST', token, data);
