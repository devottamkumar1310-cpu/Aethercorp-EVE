# EVE Integrations — Shopify, Telegram, WhatsApp

How the three integrations are wired, what has to be configured outside this
repository, and how to run them locally and in production.

---

## 1. Architecture

```
                    ┌──────────────┐
                    │   Shopify    │
                    └──────┬───────┘
                           │ OAuth + webhooks
                           ↓
                  ┌────────────────────┐
                  │    EVE Backend     │
                  │                    │
                  │ Product / Inventory│
                  │ SalesRecord        │
                  │ AgentOrchestrator  │
                  │ RecommendationTrace│
                  └────────┬───────────┘
                           │
             ┌─────────────┼─────────────┐
             ↓             ↓             ↓
        Dashboard      Telegram      WhatsApp
```

**One brain, three surfaces.** Telegram and WhatsApp do not analyse anything.
Both adapters call `EveChannelService.answer()`, which calls
`AgentOrchestrator.orchestrate()` — the same entry point `/api/executive/chat`
uses. Inventory maths, forecasting, agent prompts, workspace context,
confidence governance and recommendation traceability are shared, not
reimplemented.

Shopify data lands in EVE's **existing canonical models** (`Product`,
`InventoryItem`, `SalesRecord`). Nothing downstream branches on data origin, so
every agent works on Shopify data exactly as it works on CSV-uploaded data.

### Key modules

| Concern | Module |
|---|---|
| Channel → EVE bridge | `backend/app/services/channels/eve_channel_service.py` |
| Account linking | `backend/app/services/channels/link_service.py` |
| Message idempotency | `backend/app/services/channels/idempotency.py` |
| Telegram transport | `backend/app/services/channels/telegram_service.py` |
| WhatsApp transport | `backend/app/services/channels/whatsapp_service.py` |
| Proactive alerts | `backend/app/services/channels/alert_engine.py` |
| Shopify REST client | `backend/app/services/shopify/client.py` |
| Shopify OAuth | `backend/app/services/shopify/oauth_service.py` |
| Shopify sync | `backend/app/services/shopify/sync_service.py` |
| Shopify webhooks | `backend/app/services/shopify/webhook_service.py` |
| Credential encryption | `backend/app/core/crypto.py` |
| Field mapping (pre-existing) | `backend/app/services/shopify_mapper.py` |

---

## 2. Endpoints

Authenticated routes use EVE's existing dependencies (`get_current_user`,
`get_required_workspace_id`, `require_workspace_role`) and therefore inherit the
existing tenant-isolation rules unchanged.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/integrations/shopify/status` | member | Connection + sync state |
| POST | `/api/integrations/shopify/install` | admin | Begin OAuth, returns authorize URL |
| GET | `/api/integrations/shopify/callback` | Shopify HMAC + state | OAuth redirect target |
| POST | `/api/integrations/shopify/sync` | admin | Trigger a delta sync |
| GET | `/api/integrations/shopify/reconcile` | admin | Report EVE↔Shopify stock drift (read-only) |
| DELETE | `/api/integrations/shopify/disconnect` | admin | Remove credential + mappings |
| POST | `/api/integrations/shopify/webhook` | Shopify HMAC | Inbound webhooks |
| GET | `/api/integrations/channels/status` | member | Telegram/WhatsApp link state |
| POST | `/api/integrations/channels/link-code` | admin | Issue a single-use link code |
| POST | `/api/integrations/channels/alerts/send` | admin | Build + dispatch proactive alerts |
| DELETE | `/api/integrations/channels/{channel}` | admin | Revoke links |
| POST | `/api/integrations/telegram/webhook` | secret token | Telegram updates |
| GET | `/api/integrations/whatsapp/webhook` | verify token | Meta subscription handshake |
| POST | `/api/integrations/whatsapp/webhook` | X-Hub-Signature-256 | WhatsApp messages |

### URLs to register externally

Replace `<BACKEND>` with `BACKEND_PUBLIC_URL`
(production: `https://eve-backend-68416570138.us-central1.run.app`).

- Shopify redirect / callback: `<BACKEND>/api/integrations/shopify/callback`
- Shopify webhooks: `<BACKEND>/api/integrations/shopify/webhook` *(registered
  automatically after a successful connection — no manual setup)*
- Telegram webhook: `<BACKEND>/api/integrations/telegram/webhook`
- WhatsApp webhook: `<BACKEND>/api/integrations/whatsapp/webhook`

---

## 3. External configuration required

None of this can be done from the repository — it needs accounts and consoles.

### Shopify

1. Shopify Partner Dashboard → **Apps** → create app.
2. Copy **Client ID** → `SHOPIFY_API_KEY`, **Client secret** → `SHOPIFY_API_SECRET`.
3. App setup → **Allowed redirection URL(s)**: add
   `<BACKEND>/api/integrations/shopify/callback` (must match exactly).
4. Scopes: `read_products`, `read_inventory`, `read_orders`.

> **COGS is not available.** The Shopify Admin API does not expose cost of
> goods, so synced products land with `unit_cost = 0.0`. Margin-based
> recommendations stay degraded until a cost CSV is uploaded. EVE does not
> invent a cost figure.

### Telegram

1. Message **@BotFather** → `/newbot` → copy the token → `TELEGRAM_BOT_TOKEN`.
2. Choose a long random `TELEGRAM_WEBHOOK_SECRET`.
3. Register the webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -H "Content-Type: application/json" -d '{"url":"<BACKEND>/api/integrations/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>","allowed_updates":["message"]}'
```

### WhatsApp (Meta Cloud API)

1. Meta App Dashboard → add **WhatsApp** product.
2. Copy the phone number ID → `WHATSAPP_PHONE_NUMBER_ID`, a permanent access
   token → `WHATSAPP_ACCESS_TOKEN`, and the App Secret → `WHATSAPP_APP_SECRET`.
3. Configuration → **Webhook**: callback URL
   `<BACKEND>/api/integrations/whatsapp/webhook`, verify token =
   `WHATSAPP_VERIFY_TOKEN`. Subscribe to the **messages** field.

> **24-hour window.** Meta only permits free-form messages within 24 hours of
> the user's last message. Replies to inbound questions are always inside it.
> Proactive alerts outside that window require an approved message template;
> until one exists, `AlertEngine.dispatch` reports those sends as failed rather
> than assuming delivery.

---

## 4. Environment variables

See `backend/.env.example` for the full annotated list. Summary:

| Variable | Required for | Notes |
|---|---|---|
| `BACKEND_PUBLIC_URL` | all three | Public HTTPS base URL of the backend |
| `INTEGRATION_ENCRYPTION_KEY` | optional | Falls back to `SECRET_KEY`; rotating it invalidates stored tokens |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Shopify | App client credentials |
| `SHOPIFY_SCOPES` / `SHOPIFY_API_VERSION` | Shopify | Defaults are sensible |
| `SHOPIFY_ORDER_SYNC_DAYS` | Shopify | Backfill window, default 90 |
| `TELEGRAM_BOT_TOKEN` | Telegram | From @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram | Required; without it the webhook rejects everything |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp | Permanent token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp | Sender identity |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp | Subscription handshake |
| `WHATSAPP_APP_SECRET` | WhatsApp | Verifies `X-Hub-Signature-256` |
| `WHATSAPP_API_VERSION` | WhatsApp | Default `v21.0` |

Every one is optional in the sense that the app **boots without them**; a
missing block disables that integration and the Integrations page reports it as
unconfigured.

### Production (Cloud Run)

`app/config.py` pulls each of these from **GCP Secret Manager** when
`ENVIRONMENT=production`, so create them as secrets:

```bash
printf 'VALUE' | gcloud secrets create SHOPIFY_API_SECRET --data-file=-
```

Then add them to `backend/cloudbuild.yaml`'s `--set-secrets` list. They are not
added by default because a deployment with no Shopify app must still deploy.

---

## 5. Local development

Shopify and Meta both require a public HTTPS callback, so a tunnel is needed:

```bash
cloudflared tunnel --url http://localhost:8000
```

Set `BACKEND_PUBLIC_URL` to the tunnel URL, register that URL in the Shopify app
and Meta webhook config, then run the backend as usual. Telegram's `setWebhook`
also accepts the tunnel URL.

Without a tunnel, everything except the inbound webhooks still works: the
Integrations page renders, link codes are issued, and the authenticated API
behaves normally.

---

## 6. Founder flow

```
Connect Shopify → initial sync runs → EVE analyses the store →
inventory intelligence appears → ask EVE from Dashboard / Telegram / WhatsApp
```

Linking a chat account:

1. Dashboard → **Integrations** → *Link account* on Telegram or WhatsApp.
2. A single-use 8-character code appears (valid 10 minutes).
3. Send `/connect <CODE>` to the bot.
4. Ask anything: *"Which products are at risk of stockout?"*

Bot commands: `/start`, `/help`, `/connect <code>`, `/workspace`, `/status`.

---

## 7. Security model

| Control | Where |
|---|---|
| Tenant isolation | Every table carries `organization_id`; authenticated routes use the existing workspace dependencies |
| Webhook → workspace resolution | From the stored connection (`shop_domain`) or `ChannelLink`, **never** from the request payload |
| Shopify callback authenticity | HMAC-SHA256 over the query string, constant-time compare |
| OAuth replay protection | `state` is a single-use DB row, bound to the shop, 10-minute TTL |
| Shopify webhook authenticity | HMAC-SHA256 over the **raw** body, constant-time compare |
| Telegram authenticity | `X-Telegram-Bot-Api-Secret-Token`, fails closed when unconfigured |
| WhatsApp authenticity | `X-Hub-Signature-256` over the raw body, fails closed when unconfigured |
| Idempotency | Unique constraints on `webhook_id` and `(channel, external_event_id)`; the DB arbitrates, not a read-then-write check |
| Credentials at rest | Fernet (AES-128-CBC + HMAC) via `app/core/crypto.py`; keys domain-separated from JWT signing |
| External identifiers | Stored as salted SHA-256; delivery addresses (phone numbers) encrypted, never returned by the API |
| Prompt injection | External messages pass through the existing `PromptInjectionGuard` before reaching any agent |
| Rate limiting | Existing `rate_limit` dependency on install/sync/link-code/alerts |
| Shop domain validation | Strict `*.myshopify.com` allowlist — the domain determines where the access token is sent |

A store already connected to another workspace is **refused**, not reassigned.

---

## 8. Synchronisation semantics

- **Products/variants** — idempotent via `ShopifyProductMapping` keyed on
  `(organization_id, shopify_variant_id)`. SKU is not the key: Shopify permits
  blank and duplicate SKUs, which would collapse distinct variants.
- **Inventory** — summed across locations into one `InventoryItem.stock_on_hand`.
  A null `available` (untracked item) is skipped, not treated as zero, so it
  cannot raise a false stockout.
- **Orders** — netted for refunds, then aggregated per `(product, date)`.
  Re-syncing **restates** that day rather than appending. See
  `docs/sales_deduplication_decision.md`: this is that document's recommended
  option B applied to this writer only. It deliberately does not delete a date
  *range* (option C, rejected there as able to destroy unrecoverable history) —
  only the exact `(product, date)` pairs Shopify reported are touched.
- **Not imported**: customer records, addresses, payment details, fulfilment.
  EVE has no use for them, and holding them would widen the breach surface.
- **Reconciliation** — `GET /reconcile` reports drift without writing, for the
  case where a webhook was missed.
- **Disconnect keeps data.** Products, inventory and sales history are ordinary
  EVE business data referenced by recommendation traces; deleting them would
  rewrite the founder's past reports. Only the credential and mappings go.

---

## 9. Proactive alerts

`AlertEngine` is a **dispatcher, not a second intelligence**. It reads the
workspace's existing `RecommendationTrace` rows through
`AnalyticsService.get_dashboard_metrics` and formats them. It never recomputes
stockout risk, so an alert cannot disagree with the dashboard.

Alert types: stockout risk (≤14 days), reorder attention, dead stock.

If metrics are unavailable it sends **nothing** rather than fabricating an
alert. Delivery goes only to accounts linked to that workspace.

To run on a schedule, point Cloud Scheduler at
`POST /api/integrations/channels/alerts/send`.

---

## 10. Database

Migration `c1a2b3d4e5f7` adds eight tables, all reversible:

`shopify_connections`, `shopify_sync_jobs`, `shopify_webhook_events`,
`shopify_product_mappings`, `shopify_oauth_states`, `channel_links`,
`channel_link_codes`, `channel_message_events`.

```bash
cd backend && alembic upgrade head
```

> **Note:** the migration chain does not replay from zero on a blank SQLite
> database — an earlier revision (`a1b2c3d4e5f6`) alters `audit_logs` before any
> revision creates it. This is pre-existing and unrelated to these tables;
> production schema is bootstrapped by `init_db()`/`create_all` at startup with
> Alembic applied on top. Revision `c1a2b3d4e5f7` itself upgrades and downgrades
> cleanly against a current schema.

---

## 11. Limitations

- **COGS** is not available from Shopify; margin analysis needs a cost upload.
- **Multi-location inventory**: the `inventory_levels/update` webhook carries one
  location's figure. For multi-location stores the full total is refreshed on
  the next sync/reconcile rather than being overwritten with a partial number.
- **WhatsApp proactive alerts** outside Meta's 24-hour window need an approved
  template.
- **Rate limiting** is in-process (existing `rate_limiter.py`); with more than
  one Cloud Run instance the effective limit scales with instance count.
- **Sync scheduling** is manual or webhook-driven; no cron is registered yet.
  The `/sync` endpoint is ready for Cloud Scheduler.
- **Telegram group chats**: the linking identity is the Telegram *user*, so a
  second member of a group cannot use the bot without linking separately.
