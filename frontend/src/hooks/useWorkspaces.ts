"use client";
import { logger } from "@/lib/logger";
import { useState, useEffect, useCallback } from "react";
import { apiFetch, API_BASE_URL } from "@/lib/api";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const token = session?.access_token;
      
      if (!token) {
        setLoading(false);
        return;
      }

      const headers = {
        "Authorization": `Bearer ${token}`
      };

      const resp = await apiFetch(`${API_BASE_URL}/api/organization/workspaces`, { headers });
      
      if (!resp.ok) {
        throw new Error("Failed to load workspaces");
      }

      const data = await resp.json();
      setWorkspaces(data || []);
    } catch (err: any) {
      logger.error("Failed to load workspaces", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return { workspaces, loading, error, refetch: fetchWorkspaces };
}
