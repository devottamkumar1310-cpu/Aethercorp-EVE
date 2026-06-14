# EVE Observability & Operations Report (Phase 8.5)

This document describes EVE's administrative monitoring features, cost governance, error logging, and product analytics endpoints designed for organization admins and operations teams.

---

## 1. Observability Endpoints
EVE exposes several administrative endpoints under `/api/observability/*` to monitor system health and operations. Access is strictly restricted to users with `"admin"` or `"owner"` roles in the active organization.

### A. Cost Monitoring (`/api/observability/costs`)
- **Metrics Collected**: Daily, weekly, and monthly API cost estimates.
- **Granular Breakdown**: Tracks costs, prompt tokens, completion tokens, and call volumes per agent (e.g. Forecasting Agent, Executive Board).
- **Data Flow**: Scans database history of `ExecutiveMessage` records containing token usage and latency telemetry.

### B. Performance Analytics (`/api/observability/performance`)
- **Metrics Collected**: Overall average and P95 latency (in milliseconds) and call counts.
- **Agent Performance**: Lists latencies and call counts for each individual agent involved in processing requests.

### C. Error Logging & Diagnostics (`/api/observability/errors`)
- **Methodology**: Standard members can post client-side errors to `POST /api/observability/errors`.
- **Admin Access**: Only workspace admins can view the aggregated list of backend and frontend system errors via `GET /api/observability/errors`.
- **Attributes**: Logs component (frontend/backend), error type, message, stack trace, and JSON metadata.

### D. System Usage Stats (`/api/observability/analytics`)
- **Onboarding Progress**: Calculates organization setup percentages based on the presence of clients, projects, tasks, inventory, and sales records.
- **User Activity**: Tracks total conversations, total queries, query modes (smart vs deterministic), and recent user prompt text histories.

---

## 2. Product Operations Analytics (`/analytics/products` - Phase 8.5A)
To enable active inventory supervision, EVE implements a dedicated `/analytics/products` endpoint for workspace admins:
- **Category Breakdown**: Aggregates quantities sold, total revenue, COGS, and profit margin percentages per category.
- **Dead Stock Identification**: Lists products containing positive stock on hand but exactly 0 sales records, signaling slow moving inventory.
- **Low-Margin Alerts**: Triggers warnings for items where the profit margin is under **15.0%**, helping owners adjust pricing.
