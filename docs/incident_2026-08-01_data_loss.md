# Incident: production application data loss — 2026-08-01

**Status:** contained. Recurrence prevented in code. Recovery decision is open and
time-sensitive.

This document exists to be acted on, not to assign blame. Root-cause work is
closed; do not reopen it.

---

## What is established

Verified by direct observation:

- Cloud Run and local development use **the same database**. `DATABASE_URL` is a
  Secret Manager secret with **exactly one version ever** (v1, 2026-06-21),
  resolving to the shared Supabase connection pooler (host and project
  identifier redacted — this repository is public).
- **All application tables in `public` are empty.** `profiles`, `organizations`,
  `memberships`, `products`, `inventory_items`, `sales_records`,
  `recommendation_traces`, `recommendations` — all `count(*) = 0`.
- **The tables are new.** Their OIDs sit 21 positions from the current allocation
  pointer, versus 29,119 since `alembic_version`. They were created minutes
  before inspection, not weeks.
- **They have never held a row.** `pg_stat_user_tables` reports `n_tup_ins = 0`
  and `n_tup_del = 0` across all of them, while showing **632 scans** — the live
  application is actively querying them and finding nothing.
- **Data existed on 31 July.** At `2026-07-31 04:58:22`, `GET /api/profile/me`
  returned 200. That endpoint either finds a profile row or provisions one, so a
  row existed in `profiles` at that moment. The table standing today has never
  held a row, so it is not that table.
- **`auth.users` is intact: 49 accounts**, sign-ins spanning 21–31 July. It lives
  in Supabase's `auth` schema, which is not part of `Base.metadata` and was
  therefore untouched — the same reason `alembic_version` survived.

**Mechanism (inferred, not proven by logs):**
`tests/test_demo_workspace_consistency.py` binds `Base.metadata.drop_all()` to
the production engine in fixture teardown. Running the backend test suite on a
developer machine executes it against production. No `DROP` statement is
recoverable from Cloud Run logs — the connection originates locally, not from the
service. Supabase's Postgres logs would hold the proof.

**Why nothing alerted:** `init_db()` calls `create_all()` at startup, so the next
backend cold start silently recreated the schema — empty. No error, no failed
request, no alert. The application continued returning 200s against empty tables.

## Impact

- **49 accounts can still sign in.** Supabase auth is unaffected.
- **Everything behind those accounts is gone**: profiles, workspaces, uploaded
  catalogues, inventory, sales history, recommendations, waitlist entries.
- A returning founder will authenticate successfully and land in a product that
  has forgotten them. The onboarding flow will provision a fresh demo workspace,
  so it will look like a new account rather than an error.
- No customer-facing outage: the application is healthy and serving.

---

## Branch A — if PITR or backups ARE available

Check first: **Supabase Dashboard → Database → Backups.** Point-in-Time Recovery
is a paid-plan feature; daily backups and PITR availability depend on the current
plan. If neither is listed, go to Branch B.

**Recover to a separate target, not in place.** A whole-database restore rolls
back `auth.users` as well — and `auth.users` is currently *intact*. Restoring in
place would revert the one thing that survived and could destroy accounts created
since the restore point.

1. **Do not write to production in the meantime.** Every new signup widens the
   gap between restored data and current `auth.users`.
2. Restore the snapshot to a **new Supabase project** (or a database branch),
   targeting a point **before 2026-07-31 04:58** — the last timestamp at which
   application data is confirmed present.
3. In the restored copy, confirm the data is actually there:
   ```sql
   select count(*) from public.profiles;
   select count(*) from public.organizations;
   select count(*) from public.products;
   ```
   If these are also zero, the snapshot predates nothing useful — go to Branch B.
4. Export the application tables from the restored copy (`pg_dump --data-only`
   restricted to the `public` schema). **Exclude `auth`** — production's is
   current and must not be overwritten.
5. Load that data into production `public`. Resolve foreign keys to `auth.users`
   by user id; ids are stable, so restored `profiles.id` values should still
   match live accounts.
6. Verify: row counts non-zero, and a signed-in founder sees their own workspace
   rather than a demo brand.

**Time sensitivity:** PITR windows roll. Every day of delay can move the recovery
point past 31 July and make this irrecoverable.

## Branch B — if PITR and backups are NOT available

The data is unrecoverable. Plan accordingly.

- **Accounts are fine; their content is not.** Treat all 49 as needing
  re-onboarding, not as churned users.
- **Before contacting anyone**, separate real prospects from your own test
  accounts. Only a subset of 49 are people.
- **What a returning user experiences:** normal sign-in, then a fresh demo
  workspace. They are most likely to read this as "the product reset" rather
  than a failure — an honest short note lands better than silence, and re-upload
  is a two-minute action since EVE imports a Shopify export directly.
- **The cost is trust, not revenue** — nobody is paying yet. That is the one
  favourable fact about the timing.

---

## Prevention

**Shipped (commit `1a6c505`):** `backend/tests/conftest.py` aborts the entire test
suite at collection time if `DATABASE_URL` is not local, before any module import
or fixture can reach the engine. It resolves the URL the way the app does —
reading `os.environ` alone gave a false all-clear on the first attempt, because
`DATABASE_URL` lives in `backend/.env` and is loaded by pydantic-settings.

Verified: aborts against the Supabase host; SQLite-backed suites still run.

Override, for the rare case it is genuinely wanted:
```bash
EVE_ALLOW_NONLOCAL_TEST_DB=1 pytest
```

**Not implemented — recorded for after customer feedback.** None of these are
required for the product to work, and all are deliberately deferred:

1. **A dedicated test database.** The guard blocks the accident; it does not
   remove the underlying condition that `app.database.engine` points at
   production from a laptop.
2. **Remove `drop_all` from the test suite.** No test needs to drop tables
   against a shared engine; per-test transaction rollback is sufficient.
3. **Alembic as the real source of truth.** `create_all()` currently owns the
   production schema — it is what silently recreated it here, and what masked the
   loss. `alembic_version` sits at `a4b2091b9563` while code head is
   `b7c1d2e3f4a5`. Until this is fixed, do **not** remove `create_all()` from
   startup: it is the only thing creating the schema, and removing it would take
   production down entirely.
4. **An alert on empty core tables.** A single check — "profiles table has zero
   rows while auth.users has many" — would have caught this in minutes instead of
   during an unrelated performance audit.
5. **Enable PITR** if it is not already on. This incident is the argument for it.

---

## Closing note

The application is healthy and correctly deployed. The engineering phase is
closed. The only open item is the recovery decision above, and it belongs to the
Supabase dashboard rather than the codebase.
