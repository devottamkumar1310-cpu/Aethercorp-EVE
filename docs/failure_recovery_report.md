# EVE Failure Recovery Report & Operations Manual (Phase 8.4)

This document outlines the failure modes, fallback procedures, and resiliency structures built into EVE to maintain service continuity during infrastructure disruptions.

---

## 1. Summary of Resiliency Architectures

| Failure Scenario | Impact | Mitigation Strategy | Recovery Status |
| :--- | :--- | :--- | :--- |
| **Gemini API Down / Rate Limited** | Loss of LLM Chat | Automatic fallback to local keyword-matching heuristics engine. Returns deterministic forecasts and alerts. | **Operational** |
| **Database Connection Timeout** | Complete Service Outage | Connection pooling (NullPool in serverless/highly-concurrent testing, QueuePool with pre-ping in production) + 503 HTTP status. | **Operational** |
| **Corrupted CSV File Upload** | Invalid Data Ingest | Two-pass schema and row validation (using ImporterService). Rollback of transaction if any errors are found. | **Operational** |
| **JWT Decryption/Verification Fail** | Request Hijacking | Reject with 401 Unauthorized immediately. Bypasses database lookup overhead for fake tokens. | **Operational** |

---

## 2. LLM Outage Fallback Mechanism
When the external Gemini API is unreachable, rate limited (HTTP 429), or fails:
1. The `AgentOrchestrator` catches the exception (`GeminiOutageError` or generic `Exception`).
2. The orchestrator transitions routing to the local `eve_fallback` heuristics controller.
3. Chat response returns structured analysis based on local database queries (e.g. calculation of actual margins, low stock SKU extraction) instead of abstract LLM generations.
4. Response metadata incorporates `confidence_category` and `confidence_score` dynamically to ensure frontend rendering remains consistent.

---

## 3. Database Resilience & Health Diagnostics
- **Health Checks**:
  - The route `/healthz` performs a raw SQL ping (`SELECT 1`) on the active database connection.
  - If the database is unresponsive, `/healthz` returns `HTTP 503 Service Unavailable`, allowing load balancers (e.g., Google Cloud Load Balancer) to redirect traffic or trigger container restarts.
- **SQLite vs Postgres**:
  - For local development and test automation, SQLite connection sharing issues are bypassed via file-based connection pooling.
  - In production, Postgres connection pooling limits are set with pre-ping validation to clean dead connections.
