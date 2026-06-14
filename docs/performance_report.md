# EVE Performance Benchmark Report (Phase 8.2)

This document presents the latency SLA verification results conducted on EVE's FastAPI application. Benchmarks were collected over 50 mock client iterations executing ASGI request cycles.

---

## 1. Methodology & Environmental Setup
- **Database Engine**: In-memory SQLite (`sqlite:///:memory:`) using `StaticPool` to represent single-tenant configuration.
- **Client Implementation**: FastAPI `TestClient` mimicking HTTP request processing pipelines.
- **AI Service Configuration**: Gemini API calls mocked to throw `429 Quota Exceeded` to test local fallback execution paths.

---

## 2. Latency Metrics Summary
Benchmarks were executed across three key workloads to measure responsiveness:

| Workload | Target SLA | Avg Latency | P95 Latency | P99 Latency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Greeting Intent Classification** | < 100 ms | **7.06 ms** | 7.45 ms | 20.44 ms | **PASS** |
| **Scenario Fallback Execution** | < 200 ms | **15.22 ms** | 19.13 ms | 35.87 ms | **PASS** |
| **Inventory Dashboard Query** | < 100 ms | **7.49 ms** | 8.80 ms | 13.45 ms | **PASS** |

---

## 3. Workload Breakdown Analysis

### A. Greeting Intent Classification
- **Description**: Fast classification of basic greetings (e.g. `"hi"`, `"hello"`) using local keyword heuristic trees instead of invoking the LLM.
- **Performance**: Completing under 8ms on average, bypassing the 1.5s network round-trip of Gemini LLM.

### B. Scenario Fallback Execution
- **Description**: Local deterministic simulation execution triggered automatically when the Gemini API returns a 429 quota exception.
- **Performance**: Average execution time of 15ms ensures that users do not experience system hangs or delays even when the remote LLM is down.

### C. Inventory Dashboard Query
- **Description**: Database query aggregation summarizing overall inventory value, counts, low stock alerts, and best/worst sellers.
- **Performance**: Sub-10ms response times indicate excellent index alignment and query efficiency.
