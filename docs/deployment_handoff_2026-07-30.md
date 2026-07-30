# Deployment handoff — 30 July 2026

**Shipped to production.** Backend `eve-backend` (Cloud Run, build
`f2fcb301`), frontend `www.eveinventory.in` (Vercel, from `main` @ `9f8e7c5`).

Backend was deployed **before** the frontend deliberately: the frontend's demo
guard depends on an `is_demo` field the old backend does not return, and a
missing field reads as falsy — which would have silently disabled the guard and
re-opened the data-contamination bug for the length of the gap.

---

## Features delivered

**Self-serve trial as the primary conversion path.** Landing → free trial →
Google → demo workspace → upload → first insight. `StartFreeTrialButton` starts
OAuth directly rather than routing through the signup form. Booking a founder
call is demoted to an assistance link, never above the fold. The Operator tier
self-serves like every other plan.

**Demo-import guard.** Importing a real catalogue into a workspace still holding
seeded demo data now prompts for a destination: a clean workspace of your own
(recommended) or replacing the demo outright.

**Analysis recovery.** A failed or timed-out AI run is no longer terminal. New
`POST /api/organization/{org_id}/analysis/retry`, plus a persistent banner so a
result survives a missed toast.

**Activation funnel instrumentation.** See `docs/activation_funnel.md`.

## Bugs fixed

| Bug | Impact before |
|---|---|
| Real catalogues merged into demo data | Inventory valuation, dead stock and revenue-at-risk were part real and part fiction, with nothing on screen saying which |
| CSV template escaped its newlines as `\\n` | Every downloaded template was a single unusable line |
| Analysis timeout stopped silently | Founder waited indefinitely for a first insight that never announced itself |
| Raw `str(e)` shown on analysis failure | Provider stack traces rendered in front of merchants |
| `uploadCSVFile` read only `errorData.detail` | The "your CSV is missing these columns" summary could never render |
| Double-click on upload | Two concurrent imports; the importer appends sales rows, so velocity doubled |
| Analysis flag re-read after upload | A mid-upload workspace switch stamped the run against the wrong org |
| `signup_completed` / `login_completed` never fired for Google | The acquisition funnel was blind for the primary path |
| Proactive analysis emitted no events | The activation moment was unmeasured |
| `workspace_created` missing from in-app modal and demo switcher | Workspace creation under-counted |

## Security fixes

**`/analysis-status` had no membership check.** Any authenticated user could
read any organization's analysis status by id, exposing recommendation counts
and failure messages. Both analysis endpoints now resolve through a
membership-scoped lookup returning 404 (not 403), so a non-member cannot probe
which workspace ids exist.

**`mode=replace` is constrained, not trusted.** Refused on any workspace whose
`scenario_type IS NULL`, so a merchant's own data cannot be wiped through this
endpoint whatever the client sends. Validated before deleting. Covered by four
bypass tests including a cross-tenant workspace id and a forged token.

**Malformed org id returned 500.** Now coerced explicitly and 404s.

## Database changes

**None.** No migrations. `scenario_type` and `analysis_status` already existed;
`is_demo` is derived at response time. Rollback needs no DB work.

## API changes

| Change | Compatible? |
|---|---|
| `GET /api/organization/workspaces` returns `is_demo` | Additive |
| `POST /api/inventory/upload/master` accepts `?mode=merge\|replace` | Defaults to `merge` — existing callers unchanged |
| `POST /api/organization/{org_id}/analysis/retry` | New |
| `GET /api/organization/{org_id}/analysis-status` now membership-scoped | **Behaviour change** — returns 404 for non-members where it previously returned data |

## Breaking changes

**None for merchants.** The one behavioural change is the `analysis-status`
tenant scoping, which only affects callers reading a workspace they don't belong
to — previously a leak.

**One internal analytics change:** `free_trial_started` moved from signup to
`/onboarding`, and `signup_completed` no longer fires on `/signup` for sessions
that continue to onboarding. Expect volumes to *rise* (they now cover Google,
which is most users). Do not read the step change as growth.

## Manual testing checklist

Nothing below has been exercised against a live backend. Highest value first.

1. Google sign-in from the landing hero → lands in `/onboarding`, not the signup form.
2. Pick Luma → dashboard shows Luma data, "Demo Dataset" badge in header.
3. **Upload a real Shopify export → the guard dialog must appear.** If it does not, stop and roll back the frontend; the P0 is live.
4. Choose "Create my workspace" → new workspace holds only your SKUs, a toast names it, Luma still intact in the switcher.
5. Back into Luma → "Replace demo data" → Luma's SKUs gone, yours present, demo badge gone, re-upload no longer prompts.
6. Double-click upload → must not start two imports.
7. Force an analysis failure (revoke the Gemini key briefly, or let the daily cap trip) → readable message, not a stack trace; "Try again" restarts it; banner survives a refresh.
8. PostHog: one `signup_completed` for a new Google user; sign out and back in gives `login_completed`, **not** a second signup.
9. On a phone: guard dialog buttons tappable, no sideways scroll.

## Rollback considerations

No database changes, so rollback is code-only in both directions.

**Order matters, reversed:** roll back the **frontend first**, then the backend.
A new frontend against an old backend disables the demo guard silently.

- Frontend: redeploy the previous Vercel deployment, or `git revert 9f8e7c5..4b9a5b6` and push.
- Backend: `gcloud run services update-traffic eve-backend --to-revisions=<previous>=100 --region us-central1`.
- Partial rollback is viable: the backend is fully backward compatible, so the frontend can be reverted alone. That restores the old behaviour **including the contamination bug** — acceptable only briefly.

## Known limitations

- **Sales history duplicates on re-upload.** Proven: three imports of one file give one product and three sales rows, tripling velocity and every figure derived from it. Affects `merge` only; `replace` is safe. Deliberately not fixed — see `docs/sales_deduplication_decision.md`, which recommends a read-only production query before any migration.
- **`replace` is not atomic.** Clean, marker clear and import are three transactions. A crash between them leaves an empty workspace. Only demo data can be lost, never customer data.
- **The guard fails open.** If `/workspaces` errors, the import proceeds as a merge. Deliberate — a lookup outage shouldn't block imports — but it means an outage re-opens the contamination window.
- **Only the master CSV is guarded.** `/upload/inventory`, `/sales`, `/costs` are unguarded; currently unreachable from the UI.
- **Anonymous `landing_view`** stitches to a person only at `identify()`, which happens at `signup_completed`.
- **"First insight in about two minutes" is still unverified** end to end. `analysis_completed.duration_ms` will now answer it with real data.

## Outstanding technical debt

1. **Sales dedup** — the decision doc is written; the next step is a read-only production query, not code.
2. **20 pre-existing test failures** unrelated to this work: missing local secrets and a Postgres without `internal_analytics_events`. Verified identical on the pre-branch baseline. The suite cannot go green locally until the test environment is fixed.
3. **The backend test suite runs against production Supabase**, creating and deleting real orgs. This should have its own database.
4. **Five test files leak dependency overrides** (`test_coo_experience`, `test_executive`, `test_governance`, `test_internal_analytics`, `test_profile_migration`), which is why the new suites had to clear the table defensively. Some downstream tests may be passing *because* of the leak, so fixing it needs care.
5. **`duplicate_rows` in the import summary is misleading** — counted within-file by SKU alone, ignoring date, and never deduplicates.
6. **`NEXT_PUBLIC_BOOKING_URL` is unset**, so every "Book 15 minutes with the founder" link opens a mailto. Either set it or change the label.
7. **The GitHub remote is stale** — the repo has moved to `EVE-Inventory-Intelligence`; pushes currently work via redirect.
8. **No staging environment.** `main` deploys straight to production.
