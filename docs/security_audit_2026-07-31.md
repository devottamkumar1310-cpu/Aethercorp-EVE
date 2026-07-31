# Production security audit — 31 July 2026

Audited against live production: frontend `www.eveinventory.in` (Vercel),
backend `eve-backend` (Cloud Run). Two Medium findings were fixed and deployed
during the audit; everything else is reported below.

---

## Verified clean

These were tested, not assumed.

| Area | Result |
|---|---|
| **SQL injection** | No f-string or concatenated SQL anywhere. All raw SQL uses bound parameters. |
| **IDOR** | Swept every route for fetch-by-id without tenant scoping. The only matches are a server-initiated background task (id not attacker-controlled) and lookups already scoped by validated tenant context. |
| **Secrets in client bundle** | No service-role key, no Gemini key, no private tokens in `.next/static`. Only the six expected `NEXT_PUBLIC_*` vars; the Supabase anon key is public by design. |
| **Supabase RLS exposure** | Not load-bearing. The client uses Supabase for **auth only** — no direct table queries — so all data access goes through the backend, which enforces tenant scoping itself. |
| **AI cross-tenant leakage** | Memory, recommendations and conversation retrieval are consistently filtered by `organization_id`. |
| **Owner analytics** | 13 `/api/internal` routes all gated on `verify_owner_admin`, which compares the **cryptographically verified JWT email** against `OWNER_EMAIL` — never a header, cookie or query param. |
| **Backend security headers** | Full set: nosniff, `X-Frame-Options: DENY`, HSTS with preload, referrer-policy, and a CSP with `default-src 'self'; frame-ancestors 'none'; object-src 'none'`. |
| **Route auth coverage** | Every data route carries an auth dependency. The only unauthenticated endpoints are health and the public waitlist join, which is rate limited to 3/60s. |
| **File upload** | 10 MB cap enforced on all four CSV endpoints, extension checked, parse errors handled without leaking internals. |
| **XSS** | Three `dangerouslySetInnerHTML` uses, all static developer-authored JSON-LD or a theme script. No user input reaches any of them. No `eval` or `new Function`. |

---

## Fixed during this audit (deployed)

### 1. No security headers on the frontend — Medium

**Impact.** App pages were served with nothing but Vercel's default HSTS. Any
site could iframe the dashboard and run a UI-redress attack against a signed-in
founder.

**Exploitation.** Attacker hosts a page framing `www.eveinventory.in/dashboard`,
overlays it with decoy UI, and induces a founder to click through to a real
destructive control (e.g. "Replace demo data").

**Fix.** `X-Frame-Options: DENY`, `frame-ancestors 'none'`, nosniff,
referrer-policy, Permissions-Policy, and `poweredByHeader: false` via
`next.config.ts`. Verified live.

**Blocks production?** No — fixed.

### 2. `/analysis/retry` had no rate limit — Medium

**Impact.** Every other endpoint that can start a paid AI run is rate limited;
this one shipped without it, so an authenticated caller could loop retries and
burn a workspace's AI budget.

**Exploitation.** Authenticated user scripts repeated POSTs between runs. Bounded
by the in-progress check and daily cost cap, but wasteful within those bounds.

**Fix.** `rate_limit(requests=5, window_seconds=60)`, matching the existing
executive-analysis limit. Verified live.

**Blocks production?** No — fixed.

---

## High severity — remediation plan, not auto-applied

### 3. Next.js 16.2.7 carries nine advisories — High

Per your instruction, I did not upgrade the framework unsupervised.

**Advisories** (all affect `>=16.0.0 <16.2.11`; installed is **16.2.7**):

| Severity | Advisory |
|---|---|
| High | Middleware / Proxy bypass in App Router (Turbopack, single locale) |
| High | SSRF in Server Actions on custom servers |
| High | SSRF in rewrites via attacker-controlled destination hostname |
| High | DoS in App Router using Server Actions |
| Moderate | Unauthenticated disclosure of internal Server Function endpoints |
| Moderate | ×4 — cache confusion, unbounded Edge payload, image-optimization DoS |

**Real impact here is lower than the raw severity suggests.** The middleware
bypass is the one that matters, and EVE's middleware only gates *page shells*:
every dashboard page re-checks the session client-side, and **all data comes from
the backend, which validates the Supabase JWT on every request**. So a bypass
costs defence-in-depth, not data. The app has no custom server, no rewrites and
no i18n config, which reduces the SSRF advisories' applicability.

**Exploitation scenario.** An unauthenticated request crafted to skip middleware
renders an empty dashboard shell. No workspace data is returned, because the API
rejects the request without a valid JWT.

**Recommended fix.** Bump `next` 16.2.7 → **16.2.12**. This is a patch within the
same minor (`isSemVerMajor: false`), and it is the vendor's own security release.

**Plan:**
1. `npm i next@16.2.12` on a branch.
2. Full verification: typecheck, lint, 22 frontend tests, production build.
3. Smoke the auth-gated paths locally — `/login`, `/dashboard/inventory`,
   `/onboarding` — since middleware is what changed upstream.
4. Deploy frontend only; the backend is untouched.
5. Rollback is a Vercel redeploy of the prior build.

**Blocks production?** Not for a free trial, given the mitigation above. **Yes for
paying customers** — it is a one-line, same-minor patch and there is no good
reason to carry nine known advisories once money is involved.

---

## Medium severity — reported

### 4. CORS trusts every `*.vercel.app` origin with credentials

`allow_origin_regex=r"https://.*\.vercel\.app"` with `allow_credentials=True`.
Anyone can deploy a free Vercel app and become a trusted origin.

**Mitigating.** API auth is a bearer token from `localStorage` on
`eveinventory.in`, which a foreign origin cannot read, and Supabase cookies are
scoped to the frontend domain so they are never sent to the Cloud Run host. So
this is not currently exploitable for data theft — it becomes serious the moment
any endpoint accepts cookie auth.

**Fix.** Narrow the regex to this project's own preview deployments. Not applied
automatically because a wrong pattern silently breaks preview deploys.

**Blocks production?** No.

### 5. Prompt-injection guard exists but is barely wired in

`PromptInjectionGuard.detect()` is called in exactly one place
(`recommendation_trace_service.py`). `scan_document_content()` is defined and
**never called anywhere** — it is dead code. So the two highest-risk paths are
unguarded: free-text executive chat, and the content of uploaded documents that
feeds the AI pipeline.

**Exploitation.** A member of a shared workspace uploads a document containing
instructions aimed at the model, skewing recommendations another member sees.
Cross-tenant leakage is prevented separately by org-scoped context, and the AI is
read-only, so the ceiling is manipulated advice within one workspace.

**Fix.** Wire `detect()` into the chat entry point and `scan_document_content()`
into ingestion. **Not applied automatically**: rejecting on detection risks false
positives on legitimate merchant questions, which would break the core feature
during active outreach. Needs a log-only rollout first to measure the false
positive rate.

**Blocks production?** No.

### 6. No exact dependency pins in `requirements.txt`

Every line is `>=`. Two builds of the same commit can resolve different
dependency sets, and a malicious or broken upstream release is picked up
automatically on the next Cloud Run build.

**Fix.** Generate a lockfile / pin to resolved versions. Not applied
automatically — pinning changes what actually ships and needs a full test cycle
to validate.

**Blocks production?** No, but it makes builds non-reproducible, which will
eventually cost an unexplained outage.

### 7. No `script-src` CSP on the frontend

Only `frame-ancestors` is set. A meaningful `script-src` needs nonce plumbing
because the root layout runs an inline theme script before paint. Setting
`unsafe-inline` instead would read as protection while providing almost none.

**Fix.** Nonce-based CSP, rolled out `Content-Security-Policy-Report-Only` first.

**Blocks production?** No.

---

## Low / informational

- **36-second cold start.** First request to the backend after idle took 36s
  (subsequent: 1.5s). `min-instances` is effectively 0. A founder's first click
  can hit this. Not a security issue; a conversion one.
- **Backend test suite runs against production Supabase**, creating and deleting
  real organizations. Should have its own database.
- **Transitive npm advisories** (postcss, sharp, brace-expansion, js-yaml,
  fast-uri, hono) all arrive via build tooling rather than runtime-served code,
  and all resolve with the same `next` bump.
- **No automated dependency scanning** in either pipeline. `pip-audit` is not
  installed, so backend CVEs are currently unmonitored.

---

## Summary

| Severity | Found | Fixed | Outstanding |
|---|---|---|---|
| Critical | 0 | — | 0 |
| High | 1 | 0 | 1 (Next.js patch) |
| Medium | 6 | 2 | 4 |
| Low | 4 | 0 | 4 |

No critical findings. No authentication bypass, no tenant isolation failure, no
injection vector, and no secret exposure. The one High is a framework patch with
a documented mitigation, and the remaining Mediums are hardening rather than
active exposure.
