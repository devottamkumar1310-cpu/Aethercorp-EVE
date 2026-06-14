# EVE Public Beta Readiness & Pre-Flight Checklist (Phase 8.6)

This document presents the final readiness evaluation and operations checklist before onboarding the first cohort of 50–100 real business owners to EVE.

---

## 1. Beta Readiness Evaluation Matrix

| Domain | Assessment Criterion | Readiness Status | Evidence |
| :--- | :--- | :--- | :--- |
| **Security** | Zero IDOR (multi-tenant leaks), verified JWT signature & expiry controls, and admin privilege checking. | **READY** | Validated via automated integration tests (`test_phase8_readiness.py`). |
| **Performance** | Latency within SLA: greetings < 100ms, fallbacks < 200ms, dashboard queries < 100ms. | **READY** | Avg greeting latency 7.0ms, fallback 15.2ms, dashboard 7.4ms. |
| **Scalability** | Database scales efficiently to 10k products & 100k transactions without lockups or N+1 queries. | **READY** | Products seeded in 0.3s, transactions in 3.2s, product analytics completes in < 520ms. |
| **Fault Tolerance** | Graceful fallback when Gemini API fails or limits are exceeded. | **READY** | Fallback routing returns deterministic answers without crashing the chat session. |
| **Observability** | Tracking token usage, errors, server latencies, and business analytics. | **READY** | Restructured observability endpoints guarded by RBAC checks. |
| **Data Ingestion** | Support CSV imports containing whitespace anomalies, duplicate rows, and varying dates. | **READY** | Checked via `scratch_dataset_validation.py` (successfully handles format anomalies). |

---

## 2. Pre-Deployment Checklists

### A. Environment Configuration
- [ ] Verify that `ENV` or `ENVIRONMENT` is set to `"production"` or `"staging"` to activate API rate limiting.
- [ ] Ensure `SUPABASE_JWT_SECRET` is populated with a cryptographically secure key matching the authentication provider.
- [ ] Bind `DATABASE_URL` to a clustered PostgreSQL instance (SQLite fallback is blocked in production config).
- [ ] Set `FOUNDER_MODE=True` in production settings to sanitize administrative telemetry fields from public responses.

### B. Database Operations
- [ ] Execute database migrations using Alembic (`alembic upgrade head`) before launching containers.
- [ ] Verify database connection pool metrics: default `pool_size=20`, `max_overflow=10`, and `pool_pre_ping=True` activated.
- [ ] Configure PostgreSQL daily backups with 30-day retention policies.

### C. Monitoring & Alarms
- [ ] Hook up `/healthz` endpoint to Google Cloud Load Balancer HTTP health checks.
- [ ] Configure alerting threshold: alert if `/healthz` returns non-200 status for more than 2 consecutive minutes.
- [ ] Set up logging export to Cloud Logging (Stackdriver) with alert triggers on backend error trace occurrences.
