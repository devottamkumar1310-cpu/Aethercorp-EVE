import { API_BASE_URL, apiFetch } from "@/lib/api";
import { getHeaders } from "./businessService";

export interface PlanInfo {
  key: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  annual_savings: number;
  max_shopify_stores: number;
  max_skus: number | null;
  ai_interactions_per_month: number | null;
  telegram: boolean;
  whatsapp: boolean;
  proactive_alerts: boolean;
  hourly_sync: boolean;
  support_level: string;
  features: string[];
}

export interface BillingStatus {
  active: boolean;
  source: "stripe" | "founder" | "trial" | "none";
  status: string;
  plan: PlanInfo;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_interval: string | null;
  configured: boolean;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.detail || body.message || fallback;
}

/** Public — no auth required. Same three plans shown on /pricing. */
export async function fetchPlans(): Promise<PlanInfo[]> {
  const res = await fetch(`${API_BASE_URL}/api/billing/plans`);
  if (!res.ok) throw new Error(await readError(res, "Failed to load plans"));
  const data = await res.json();
  return data.plans;
}

export async function fetchBillingStatus(token: string): Promise<BillingStatus> {
  const res = await apiFetch(`${API_BASE_URL}/api/billing/status`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load billing status"));
  return res.json();
}

/** Returns the Stripe Checkout URL to redirect the browser to. */
export async function startCheckout(
  token: string,
  plan: string,
  interval: "month" | "year"
): Promise<string> {
  const res = await apiFetch(`${API_BASE_URL}/api/billing/checkout`, {
    method: "POST",
    headers: getHeaders(token, "application/json"),
    body: JSON.stringify({ plan, interval }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to start checkout"));
  const data = await res.json();
  return data.checkout_url;
}

/** Returns the Stripe Billing Portal URL — upgrade, downgrade, cancel, payment method. */
export async function openBillingPortal(token: string): Promise<string> {
  const res = await apiFetch(`${API_BASE_URL}/api/billing/portal`, {
    method: "POST",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to open billing portal"));
  const data = await res.json();
  return data.portal_url;
}
