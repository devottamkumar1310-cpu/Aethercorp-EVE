# Shopify Integration Architecture

> **Superseded by [`docs/INTEGRATIONS.md`](../../docs/INTEGRATIONS.md)**, which
> covers Shopify alongside the Telegram and WhatsApp channels, external app
> configuration, and deployment. This file is kept for the mapping-layer detail.

## Current State

The integration is live. OAuth, synchronisation and webhooks are implemented;
the previous mock-mode service has been removed.

## Architecture

```
Shopify Admin API
       ↓
ShopifyAdminClient          app/services/shopify/client.py
  rate-limit aware, cursor pagination
       ↓
ShopifySyncService          app/services/shopify/sync_service.py
       ↓
ShopifyMapper               app/services/shopify_mapper.py
  ├── ShopifyProductMapper   → EVE Product (parent_product_id, size, color)
  └── ShopifyOrderMapper     → EVE SalesRecord
       ↓
EVE canonical models
```

Inventory levels are aggregated in `ShopifySyncService.upsert_inventory_levels`
rather than in the mapper: Shopify reports availability per
(inventory_item, location) while EVE stores one figure per product, so the sum
needs the product mappings that only the sync layer holds.

## Components

| Component | Status | File |
|-----------|--------|------|
| Product mapper | Complete | `app/services/shopify_mapper.py` |
| Order mapper | Complete | `app/services/shopify_mapper.py` |
| Inventory aggregation | Complete | `app/services/shopify/sync_service.py` |
| Variant detection | Complete | `app/fashion/variant_detector.py` |
| OAuth 2.0 flow | Complete | `app/services/shopify/oauth_service.py` |
| Admin API client | Complete | `app/services/shopify/client.py` |
| Initial + delta sync | Complete | `app/services/shopify/sync_service.py` |
| Webhooks (HMAC + idempotent) | Complete | `app/services/shopify/webhook_service.py` |
| Reconciliation | Complete | `app/services/shopify/sync_service.py` |
| Token encryption at rest | Complete | `app/core/crypto.py` |
| HTTP routes | Complete | `app/routes/integrations_shopify.py` |

## Data model

| Table | Purpose |
|---|---|
| `shopify_connections` | One connected store per workspace; encrypted token |
| `shopify_sync_jobs` | Per-run counts, status, errors |
| `shopify_webhook_events` | Delivery-id idempotency ledger |
| `shopify_product_mappings` | Shopify variant ↔ EVE Product identity |
| `shopify_oauth_states` | Single-use OAuth `state` nonces |

Mapping lives in its own table rather than as columns on `Product`: `Product` is
read by every agent and by the startup schema validator, so keeping external
identity out of it leaves the canonical model untouched by this integration.

## Not implemented

- **Price push-back to Shopify.** Requires `write_products` and should be an
  explicit, confirmed action rather than a side effect of a recommendation.
- **App Store listing.** The app works as a custom/private app today.
- **GraphQL bulk operations.** REST with cursor pagination is sufficient at
  D2C fashion catalogue sizes; revisit past a few thousand variants.

## Shopify API reference

- Products: `GET /admin/api/2024-07/products.json`
- Inventory levels: `GET /admin/api/2024-07/inventory_levels.json`
- Orders: `GET /admin/api/2024-07/orders.json`
- OAuth: https://shopify.dev/docs/apps/auth/oauth
- Webhooks: https://shopify.dev/docs/apps/webhooks
