import { logger } from "@/lib/logger";
import { useState, useEffect, useCallback } from "react";
import { apiFetch, API_BASE_URL } from "@/lib/api";

export interface InventoryData {
  total_inventory_value: number;
  total_skus: number;
  best_sellers: any[];
  worst_sellers: any[];
  low_stock_alerts: any[];
  dead_stock_alerts: any[];
}

export interface InventoryAlerts {
  low_stock: any[];
  low_stock_count: number;
  dead_stock: any[];
  dead_stock_count: number;
}

export function useInventory() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [alerts, setAlerts] = useState<InventoryAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const token = session?.access_token;
      const workspaceId = localStorage.getItem("active_workspace_id");
      
      if (!token || !workspaceId) {
        setLoading(false);
        return;
      }

      const headers = {
        "Authorization": `Bearer ${token}`,
        "X-Workspace-Id": workspaceId
      };

      const [metricsRes, alertsRes] = await Promise.all([
        apiFetch(`${API_BASE_URL}/api/inventory/metrics`, { headers }),
        apiFetch(`${API_BASE_URL}/api/inventory/alerts`, { headers })
      ]);

      if (!metricsRes.ok || !alertsRes.ok) {
        throw new Error("Failed to load inventory data");
      }

      const [metricsData, alertsData] = await Promise.all([
        metricsRes.json(),
        alertsRes.json()
      ]);

      setData(metricsData);
      setAlerts(alertsData);
    } catch (err: any) {
      logger.error("Failed to load inventory", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  return { data, alerts, loading, error, refetch: fetchInventory };
}
