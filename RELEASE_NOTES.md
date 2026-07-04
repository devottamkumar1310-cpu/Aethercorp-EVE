# EVE v1.1.1 Release Notes — Production Authentication & CORS Stabilization

## Overview
This patch release addresses production domain-migration issues, stabilizing Google OAuth redirects and CORS preflight request processing for the custom domain `https://eveinventory.in`.

## Key Improvements

### 1. Production CORS Preflight Fix
- Added `https://eveinventory.in` and `https://www.eveinventory.in` to CORS allowed origins in the FastAPI backend.
- Resolved preflight `OPTIONS` failure where missing auth/workspace headers on unrecognized origins triggered a `400 Bad Request` before CORS validation occurred. Now, OPTIONS queries return a `200 OK` preflight response with appropriate headers.

### 2. Google OAuth Redirect Security
- Configured verbose server telemetry in Next.js middleware and callback routes to audit query param passing, code exchanges, and cookie states in production.
- Documented configuration changes needed in the Supabase Dashboard Redirect URL settings to whitelist custom domain endpoints and prevent redirects from looping back to the landing page.

### 3. Build & Archive Optimization
- Created `.gcloudignore` files to prevent large development cache files (`node_modules/`, `.next/`), SQLite test databases (`*.db`), and CSV datasets from being uploaded during deployment. This reduced Cloud Build payload upload sizes by over 99% (from 114MB to less than 1MB).

---

# EVE v1.1.0 Release Notes — Inventory Intelligence Repositioning

## Overview
This release repositions EVE from an AI COO-first platform to an **Inventory Intelligence-first** platform with a supporting AI assistant, aligning the user experience with our strongest product wedge for founder validation.

## Key Improvements

### 1. Default Post-Login Routing
- Default post-login, signup, callback, and email verification redirects updated from `/dashboard/eve` to `/dashboard/inventory`.
- Supabase session middleware updated to default to the inventory intelligence homepage.

### 2. Sidebar Navigation Reordering
- Reordered navigation priority: Inventory Intelligence -> Document Intelligence -> Decision Traceability -> AI Assistant -> Operations Dashboard -> Finance -> Activity Feed.
- Updated sidebar brand logo click to redirect directly to the inventory dashboard.
- Product tour steps updated to highlight Inventory Intelligence first.

### 3. Inventory Dashboard Redesign
- Implemented high-visibility **Executive Summary KPI Strip** (Inventory Value, Low Stock SKUs, Dead Stock Candidates, Reorder Recommendations).
- Rearranged top layout placing **Executive Insights** next to the **Spreadsheet Integration** panel.
- Added a 3-step visual empty state onboarding guide (`Upload Data` -> `Get Insights` -> `Take Action`) for clean workspaces.

### 4. AI Assistant Contextualization
- Changed welcome message and quick action prompt chips in the chat assistant to focus on inventory tasks (stockout risks, dead stock, replenishment plans).
- Aligned landing page taglines to showcase the "Inventory Intelligence Platform".

---

# EVE v1.0.0-beta Release Notes

## Overview
This beta release marks the transition of EVE into a Founder-Ready platform, focusing on robust business logic, frictionless onboarding, and a streamlined data ingestion process. 

## Key Improvements

### 1. Inventory Intelligence Stabilization
- **Dead Stock Thresholds**: Increased the default `threshold_days` for dead stock detection from 30 days to 180 days. This prevents healthy core basics with long lifecycles from triggering false-positive alerts, building immediate trust with founders.
- **Pricing Elasticity & Profit Margins**: Refactored `AnalyticsService` to ensure `projected_qty_sold` is capped by actual `stock_on_hand`. EVE will no longer recommend mathematically impossible price drops that falsely project massive negative profit impacts.

### 2. Streamlined Onboarding
- **Workspace Navigation Fixes**: Removed the "Skip to Command Center" onboarding loophole that previously placed users into a null workspace state and resulted in a broken dashboard experience. 

### 3. Unified Data Ingestion
- **Master CSV Workflow**: Replaced the fragmented multi-step data upload process with a unified `uploadMasterCSVAPI`. Founders can now drop a single master spreadsheet containing `sku`, `name`, `quantity`, `cost`, and `sales` into EVE, and it will automatically map and ingest the data across all modules seamlessly.

### 4. Codebase Cleanup & Performance
- Removed legacy development scripts and temporary `scratch/` directories.
- Addressed 150+ frontend TypeScript and React Hooks warnings.
- Linted and stabilized backend models.

## Founder Validation Readiness
EVE is now fully stabilized, logically sound, and ready for live user validation with real D2C fashion founders!
