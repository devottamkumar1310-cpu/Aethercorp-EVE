import { API_BASE_URL, apiFetch } from "@/lib/api";
import { DashboardMetrics } from "@/types/dashboard";

export async function fetchDashboardMetrics(token: string): Promise<DashboardMetrics> {
  const response = await apiFetch(`${API_BASE_URL}/api/dashboard`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    // We can add cache: "no-store" to ensure we get live data for the dashboard
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
  }

  const data = await response.json();
  return data as DashboardMetrics;
}
