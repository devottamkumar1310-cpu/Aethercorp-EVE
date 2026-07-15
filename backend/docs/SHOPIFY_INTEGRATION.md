# Shopify Integration Architecture

## Current State

EVE has a complete **mapping layer** that translates between Shopify's data format and EVE's internal models. The integration service operates in mock mode — live API calls require OAuth implementation.

## Architecture

```
Shopify Admin API
       ↓
ShopifyService (API interaction layer)
       ↓
ShopifyMapper (data transformation)
  ├── ShopifyProductMapper  → EVE Product (with parent_product_id, size, color)
  ├── ShopifyInventoryMapper → EVE InventoryItem
  └── ShopifyOrderMapper    → EVE SalesRecord
       ↓
EVE Database
```

## What's Implemented

| Component | Status | File |
|-----------|--------|------|
| Product Mapper | ✅ Complete | `app/services/shopify_mapper.py` |
| Inventory Mapper | ✅ Complete | `app/services/shopify_mapper.py` |
| Order Mapper | ✅ Complete | `app/services/shopify_mapper.py` |
| Connection Config | ✅ Complete | `app/services/shopify_mapper.py` |
| Integration Service | ✅ Mock Mode | `app/services/shopify_service.py` |
| Variant Detection | ✅ Complete | `app/fashion/variant_detector.py` |

## Remaining Work for Live Integration

### 1. OAuth 2.0 Flow (Priority: HIGH)
- Implement Shopify OAuth 2.0 authorization code flow
- Store encrypted access tokens per organization
- Handle token refresh and revocation
- Add `ShopifyConnection` model to database
- Estimated effort: **3-5 days**

### 2. Webhook Subscriptions (Priority: HIGH)
- Subscribe to `products/update`, `orders/create`, `inventory_levels/update`
- Add webhook endpoint at `POST /api/integrations/shopify/webhook`
- Verify HMAC signatures for security
- Process webhooks asynchronously via background task queue
- Estimated effort: **2-3 days**

### 3. Initial Sync (Priority: HIGH)
- Paginated bulk import of all products, inventory, and historical orders
- Rate limiting (Shopify allows 2 requests/second for REST API)
- Progress tracking and error recovery
- Estimated effort: **2-3 days**

### 4. Ongoing Delta Sync (Priority: MEDIUM)
- Scheduled job to sync inventory levels every 15 minutes
- Order sync via webhooks (real-time) + polling fallback
- Conflict resolution for concurrent updates
- Estimated effort: **2-3 days**

### 5. Price Push-Back (Priority: LOW)
- Push EVE pricing recommendations back to Shopify
- Requires `write_products` scope
- Should be opt-in with confirmation step
- Estimated effort: **1-2 days**

### 6. App Store Listing (Priority: LOW)
- Create Shopify App listing for public distribution
- App review and approval process
- Estimated effort: **3-5 days**

## Total Estimated Remaining Work: 13-21 days

## Shopify API Reference

- Products API: `GET /admin/api/2024-07/products.json`
- Inventory Levels: `GET /admin/api/2024-07/inventory_levels.json`
- Orders API: `GET /admin/api/2024-07/orders.json`
- OAuth: https://shopify.dev/docs/apps/auth/oauth
- Webhooks: https://shopify.dev/docs/apps/webhooks
