import { API_BASE_URL, apiFetch } from "@/lib/api";
import { getHeaders } from "./businessService";

export interface ShopifySyncJob {
  id: string;
  job_type: string;
  status: string;
  products_synced: number;
  variants_synced: number;
  inventory_synced: number;
  orders_synced: number;
  sales_records_synced: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

export interface ShopifyStatus {
  connected: boolean;
  /** False when this EVE deployment has no Shopify app credentials configured. */
  configured: boolean;
  shop_domain: string | null;
  status: string;
  sync_status: string;
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  last_error: string | null;
  recent_jobs: ShopifySyncJob[];
}

export interface LinkedAccount {
  display_hint: string | null;
  created_at: string;
  last_message_at: string | null;
}

export interface ChannelStatus {
  connected: boolean;
  configured: boolean;
  linked_accounts: LinkedAccount[];
}

export interface ChannelsStatus {
  telegram: ChannelStatus;
  whatsapp: ChannelStatus;
}

export interface LinkCode {
  code: string;
  channel: string;
  expires_at: string;
  expires_in_minutes: number;
  instructions: string;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.detail || body.message || fallback;
}

export async function fetchShopifyStatus(token: string): Promise<ShopifyStatus> {
  const res = await apiFetch(`${API_BASE_URL}/api/integrations/shopify/status`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load Shopify status"));
  return res.json();
}

export async function startShopifyInstall(token: string, shopDomain: string): Promise<string> {
  const res = await apiFetch(`${API_BASE_URL}/api/integrations/shopify/install`, {
    method: "POST",
    headers: getHeaders(token, "application/json"),
    body: JSON.stringify({ shop_domain: shopDomain }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to start Shopify connection"));
  const data = await res.json();
  return data.authorize_url;
}

export async function triggerShopifySync(token: string) {
  const res = await apiFetch(`${API_BASE_URL}/api/integrations/shopify/sync`, {
    method: "POST",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to start sync"));
  return res.json();
}

export async function disconnectShopify(token: string) {
  const res = await apiFetch(`${API_BASE_URL}/api/integrations/shopify/disconnect`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to disconnect Shopify"));
  return res.json();
}

export async function fetchChannelsStatus(token: string): Promise<ChannelsStatus> {
  const res = await apiFetch(`${API_BASE_URL}/api/integrations/channels/status`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load channel status"));
  return res.json();
}

export async function createLinkCode(token: string, channel: string): Promise<LinkCode> {
  const res = await apiFetch(`${API_BASE_URL}/api/integrations/channels/link-code`, {
    method: "POST",
    headers: getHeaders(token, "application/json"),
    body: JSON.stringify({ channel }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to generate link code"));
  return res.json();
}

export async function unlinkChannel(token: string, channel: string) {
  const res = await apiFetch(`${API_BASE_URL}/api/integrations/channels/${channel}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to unlink channel"));
  return res.json();
}
