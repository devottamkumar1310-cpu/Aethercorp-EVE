"use client";
import { logger } from "@/lib/logger";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Store,
  Send,
  MessageCircle,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Link2,
  Unlink,
  Copy,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ChannelsStatus,
  LinkCode,
  ShopifyStatus,
  createLinkCode,
  disconnectShopify,
  fetchChannelsStatus,
  fetchShopifyStatus,
  startShopifyInstall,
  triggerShopifySync,
  unlinkChannel,
} from "@/services/integrationsService";

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown";
  }
}

/** Maps a sync state to the badge treatment used across the EVE dashboard. */
function syncBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "running":
      return {
        label: "Syncing",
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      };
    case "success":
      return {
        label: "Synced",
        className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      };
    case "failed":
      return {
        label: "Sync failed",
        className: "bg-red-500/10 text-red-700 dark:text-red-400",
      };
    default:
      return {
        label: "Idle",
        className: "bg-muted text-muted-foreground",
      };
  }
}

interface SectionProps {
  id: string;
  title: string;
  icon: React.ElementType;
  connected: boolean;
  children: React.ReactNode;
}

function IntegrationCard({ id, title, icon: Icon, connected, children }: SectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-24 bg-card rounded-xl border border-border shadow-sm overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-border bg-secondary flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center text-foreground tracking-wide font-sans">
          <Icon className="h-4 w-4 mr-2.5 text-indigo-500" />
          {title}
        </h2>
        <span
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
            connected
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </section>
  );
}

export default function IntegrationsPage() {
  const [shopify, setShopify] = useState<ShopifyStatus | null>(null);
  const [channels, setChannels] = useState<ChannelsStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [shopDomain, setShopDomain] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [shopifyError, setShopifyError] = useState<string | null>(null);
  const [shopifyNotice, setShopifyNotice] = useState<string | null>(null);

  const [linkCodes, setLinkCodes] = useState<Record<string, LinkCode | null>>({});
  const [channelBusy, setChannelBusy] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const searchParams = useSearchParams();

  const getToken = useCallback(async () => {
    const { data } = await createClient().auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [shopifyStatus, channelStatus] = await Promise.all([
        fetchShopifyStatus(token),
        fetchChannelsStatus(token),
      ]);
      setShopify(shopifyStatus);
      setChannels(channelStatus);
    } catch (e) {
      logger.error("Failed to load integrations", e);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  // Surface the outcome of the Shopify OAuth round trip, which returns the
  // browser here with a query parameter rather than through the SPA router.
  useEffect(() => {
    const outcome = searchParams.get("shopify");
    if (!outcome) return;
    if (outcome === "connected") {
      setShopifyNotice("Shopify connected. The first sync is running now.");
    } else if (outcome === "error") {
      const detail = searchParams.get("detail");
      setShopifyError(
        detail
          ? `Could not connect Shopify: ${detail.replace(/_/g, " ")}`
          : "Could not connect Shopify. Please try again."
      );
    }
  }, [searchParams]);

  // While a sync is running the founder has no other signal that it finished,
  // so poll until it settles. Stops as soon as the state is no longer "running".
  useEffect(() => {
    if (shopify?.sync_status !== "running") return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [shopify?.sync_status, load]);

  const handleConnect = async () => {
    setShopifyError(null);
    setShopifyNotice(null);
    const trimmed = shopDomain.trim();
    if (!trimmed) {
      setShopifyError("Enter your Shopify store domain.");
      return;
    }

    setConnecting(true);
    try {
      const token = await getToken();
      if (!token) return;
      const authorizeUrl = await startShopifyInstall(token, trimmed);
      // Full navigation, not a router push: the destination is Shopify's own
      // consent screen on a different origin.
      window.location.href = authorizeUrl;
    } catch (e: any) {
      setShopifyError(e.message || "Could not start the Shopify connection.");
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setShopifyError(null);
    setSyncing(true);
    try {
      const token = await getToken();
      if (!token) return;
      await triggerShopifySync(token);
      await load();
    } catch (e: any) {
      setShopifyError(e.message || "Could not start the sync.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setShopifyError(null);
    setDisconnecting(true);
    try {
      const token = await getToken();
      if (!token) return;
      await disconnectShopify(token);
      setShopifyNotice(
        "Shopify disconnected. Your synced products and sales history are kept."
      );
      await load();
    } catch (e: any) {
      setShopifyError(e.message || "Could not disconnect Shopify.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleGenerateCode = async (channel: string) => {
    setChannelError(null);
    setChannelBusy(channel);
    try {
      const token = await getToken();
      if (!token) return;
      const code = await createLinkCode(token, channel);
      setLinkCodes((prev) => ({ ...prev, [channel]: code }));
    } catch (e: any) {
      setChannelError(e.message || "Could not generate a link code.");
    } finally {
      setChannelBusy(null);
    }
  };

  const handleUnlink = async (channel: string) => {
    setChannelError(null);
    setChannelBusy(channel);
    try {
      const token = await getToken();
      if (!token) return;
      await unlinkChannel(token, channel);
      setLinkCodes((prev) => ({ ...prev, [channel]: null }));
      await load();
    } catch (e: any) {
      setChannelError(e.message || "Could not unlink the channel.");
    } finally {
      setChannelBusy(null);
    }
  };

  const handleCopy = async (channel: string, code: string) => {
    try {
      await navigator.clipboard.writeText(`/connect ${code}`);
      setCopied(channel);
      setTimeout(() => setCopied(null), 2000);
    } catch (e) {
      logger.error("Clipboard write failed", e);
    }
  };

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto w-full space-y-6 animate-pulse">
        <div className="bg-card rounded-xl border border-border h-48" />
        <div className="bg-card rounded-xl border border-border h-40" />
        <div className="bg-card rounded-xl border border-border h-40" />
      </main>
    );
  }

  const badge = syncBadge(shopify?.sync_status ?? "idle");

  const renderChannel = (
    channel: "telegram" | "whatsapp",
    title: string,
    icon: React.ElementType,
    botHint: string
  ) => {
    const state = channels?.[channel];
    const code = linkCodes[channel];
    const busy = channelBusy === channel;

    return (
      <IntegrationCard
        id={channel}
        title={title}
        icon={icon}
        connected={Boolean(state?.connected)}
      >
        <p className="text-sm text-muted-foreground">
          Ask EVE anything about your business from {title}. Answers come from the
          same EVE intelligence as your dashboard, using your workspace data.
        </p>

        {!state?.configured && (
          <div className="flex items-start gap-2.5 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-2.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {title} is not configured on this EVE deployment yet. Ask your
              administrator to add the bot credentials.
            </span>
          </div>
        )}

        {state?.connected && state.linked_accounts.length > 0 && (
          <div className="rounded-lg border border-border divide-y divide-border">
            {state.linked_accounts.map((account, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span className="text-foreground font-medium">
                  {account.display_hint || "Linked account"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Last message: {formatTimestamp(account.last_message_at)}
                </span>
              </div>
            ))}
          </div>
        )}

        {code && (
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <code className="text-lg font-mono font-bold tracking-widest text-foreground">
                {code.code}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(channel, code.code)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 border border-border rounded-lg hover:bg-muted/50 transition cursor-pointer text-foreground"
              >
                {copied === channel ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied === channel ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send <span className="font-mono">/connect {code.code}</span> to {botHint}.
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Expires in {code.expires_in_minutes} minutes. Single use.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleGenerateCode(channel)}
            disabled={busy || !state?.configured}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            {state?.connected ? "Link another account" : "Link account"}
          </button>

          {state?.connected && (
            <button
              type="button"
              onClick={() => handleUnlink(channel)}
              disabled={busy}
              className="flex items-center gap-2 text-xs font-semibold px-3 py-2 border border-red-500/30 hover:bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              <Unlink className="h-3.5 w-3.5" />
              Unlink
            </button>
          )}
        </div>
      </IntegrationCard>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-xl font-bold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect your store so EVE analyses live data, and ask EVE anything from
          Telegram or WhatsApp.
        </p>
      </header>

      {channelError && (
        <div className="flex items-start gap-2.5 text-sm bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{channelError}</span>
        </div>
      )}

      {/* Shopify */}
      <IntegrationCard
        id="shopify"
        title="Shopify"
        icon={Store}
        connected={Boolean(shopify?.connected)}
      >
        {shopifyNotice && (
          <div className="flex items-start gap-2.5 text-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg px-4 py-3">
            <Check className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{shopifyNotice}</span>
          </div>
        )}
        {shopifyError && (
          <div className="flex items-start gap-2.5 text-sm bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg px-4 py-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{shopifyError}</span>
          </div>
        )}

        {!shopify?.configured && (
          <div className="flex items-start gap-2.5 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-2.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Shopify is not configured on this EVE deployment yet. Ask your
              administrator to add the Shopify app credentials.
            </span>
          </div>
        )}

        {shopify?.connected ? (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted-foreground">Store</dt>
                <dd className="text-sm font-medium text-foreground mt-0.5">
                  {shopify.shop_domain}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Sync status</dt>
                <dd className="mt-1">
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Last successful sync</dt>
                <dd className="text-sm font-medium text-foreground mt-0.5">
                  {formatTimestamp(shopify.last_successful_sync_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Last attempt</dt>
                <dd className="text-sm font-medium text-foreground mt-0.5">
                  {formatTimestamp(shopify.last_sync_at)}
                </dd>
              </div>
            </dl>

            {shopify.last_error && (
              <div className="flex items-start gap-2.5 text-xs bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{shopify.last_error}</span>
              </div>
            )}

            {shopify.recent_jobs.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-2 bg-secondary text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Recent syncs
                </div>
                <div className="divide-y divide-border">
                  {shopify.recent_jobs.map((job) => (
                    <div
                      key={job.id}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-foreground font-medium capitalize">
                        {job.job_type}
                      </span>
                      <span className="text-muted-foreground">
                        {job.variants_synced} variants · {job.inventory_synced} stock ·{" "}
                        {job.sales_records_synced} sales
                      </span>
                      <span
                        className={`font-semibold ${
                          job.status === "success"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : job.status === "failed"
                              ? "text-red-700 dark:text-red-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing || shopify.sync_status === "running"}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing || shopify.sync_status === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {shopify.sync_status === "running" ? "Syncing…" : "Sync now"}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 border border-red-500/30 hover:bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg transition cursor-pointer disabled:opacity-50"
              >
                {disconnecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unlink className="h-3.5 w-3.5" />
                )}
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your store and EVE imports your products, variants, stock
              levels and recent orders, then analyses them automatically.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                disabled={!shopify?.configured}
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting || !shopify?.configured}
                className="flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Store className="h-3.5 w-3.5" />
                )}
                Connect Shopify
              </button>
            </div>
          </>
        )}
      </IntegrationCard>

      {renderChannel("telegram", "Telegram", Send, "the EVE bot on Telegram")}
      {renderChannel("whatsapp", "WhatsApp", MessageCircle, "EVE's WhatsApp number")}
    </div>
  );
}
