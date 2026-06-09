import { API_BASE_URL } from "@/lib/api";

export async function fetchHealth(token: string) {
  const res = await fetch(`${API_BASE_URL}/intelligence/health`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch health");
  return res.json();
}

export async function fetchExecutiveSummary(token: string) {
  const res = await fetch(`${API_BASE_URL}/intelligence/executive-summary`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

export async function fetchRisks(token: string) {
  const res = await fetch(`${API_BASE_URL}/intelligence/risks`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch risks");
  return res.json();
}

export async function fetchOpportunities(token: string) {
  const res = await fetch(`${API_BASE_URL}/intelligence/opportunities`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch opportunities");
  return res.json();
}

export async function fetchTrends(token: string) {
  const res = await fetch(`${API_BASE_URL}/intelligence/trends`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch trends");
  return res.json();
}

export async function fetchActions(token: string) {
  const res = await fetch(`${API_BASE_URL}/intelligence/actions`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch actions");
  return res.json();
}

export async function createSnapshot(token: string) {
  const res = await fetch(`${API_BASE_URL}/intelligence/snapshot`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to create snapshot");
  return res.json();
}
