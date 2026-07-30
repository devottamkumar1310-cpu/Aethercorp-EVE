# EVE activation funnel

The measurable path from a stranger on the landing page to a founder acting on a
recommendation about their own catalogue.

```
Landing → Sign Up → Workspace Created → CSV Uploaded
        → Analysis Started → Analysis Completed → First Recommendation Viewed
```

Event names are **append-only**. Renaming one orphans every saved PostHog
insight built on it. `frontend/src/lib/funnelEvents.test.js` asserts that every
step below is declared, is actually fired somewhere, and sends only properties
that survive the privacy allowlist — unlisted keys are dropped silently, so a
breakdown by a non-allowlisted property returns empty with no error anywhere.

---

## Step 0 — Landing

| | |
|---|---|
| **Event** | `landing_view` |
| **Trigger** | Landing page mount (`app/page.tsx`) |
| **Properties** | Attribution only: `utm_*`, `ref`, `referrer`, `landing_path` |
| **Fires once** | Per mount. Attribution is captured first-touch into `sessionStorage` and attached to every later event, so the whole funnel stays attributable to the original campaign |
| **Success** | Advances to `signup_started` |
| **Failure** | Session ends with no `signup_started` — the hero or the offer is not landing |

## Step 1a — Sign-up intent

| | |
|---|---|
| **Event** | `signup_started` |
| **Trigger** | Click on `StartFreeTrialButton` (hero, workflow, bottom CTA, pricing, contact) or the Google button on `/signup` and `/demo` |
| **Properties** | `method` (`google` \| `email`), `source` (the CTA location) |
| **Fires once** | Per click. Deliberately not deduplicated — repeat clicks mean the OAuth handoff is failing, which is worth seeing |
| **Success** | Advances to `signup_completed` |
| **Failure** | `signup_started` with no `signup_completed` = **the OAuth drop-off**. Expect some: it includes everyone who cancels at Google's consent screen |

## Step 1b — Sign-up complete

| | |
|---|---|
| **Event** | `signup_completed` |
| **Trigger** | First authenticated arrival at `/onboarding` (`lib/authEvents.ts`), for every auth method. Also `/signup` when the account needs email verification and therefore never reaches `/onboarding` |
| **Properties** | `method`, `requires_verification` |
| **Fires once** | Guarded in `sessionStorage` keyed by user id, so a refresh of `/onboarding` cannot add a second signup |
| **Success** | Advances to `workspace_created` / `demo_workspace_created` |
| **Failure** | Signed up but no workspace — they abandoned the brand picker |

**New vs returning** is decided from Supabase's own `created_at` vs
`last_sign_in_at`, not from anything on the device, so a founder who signs up on
a laptop and later signs in on a phone still counts as returning. Accounts under
60s old count as a signup.

## Step 1c — Returning user

| | |
|---|---|
| **Event** | `login_completed` |
| **Trigger** | Returning authenticated arrival at `/onboarding` (Google), or a successful password sign-in on `/login` (email, which routes straight to the dashboard) |
| **Properties** | `method` |
| **Fires once** | Per tab session, keyed by user id |
| **Success** | Retention signal. `login_completed` in week 2 is the real measure of whether EVE stuck |
| **Failure** | Signups that never produce a second `login_completed` — the product was never worth returning to |

## Step 2 — Workspace created

| | |
|---|---|
| **Events** | `workspace_created`, `demo_workspace_created`, plus `free_trial_started` |
| **Trigger** | Brand picker on `/onboarding`; the in-app create-workspace modal; the demo switcher; the demo-import guard's "Create my workspace" |
| **Properties** | `source` (`blank` \| `demo` \| `in_app_modal` \| `workspace_switcher` \| `demo_import_guard`), `workspace_id`, `demo_company` |
| **Fires once** | Per created workspace. Emitted **before** the page reload that some paths perform, which would otherwise discard it |
| **Success** | Advances to `csv_upload_started` |
| **Failure** | Workspace exists but no upload — they looked at the demo and never brought their own data. **This is the step to watch: it separates a tourist from a trial** |

`free_trial_started` fires here rather than at signup, because this is the one
point every trial passes through regardless of auth method.

## Step 3 — CSV uploaded

| | |
|---|---|
| **Events** | `csv_upload_started` → `csv_upload_completed` \| `csv_upload_failed` |
| **Trigger** | Master CSV upload on Inventory Intelligence, after the demo-import guard resolves |
| **Properties** | `file_size_kb`, `mode` (`merge` \| `replace`), `row_count`, `valid_row_count`, `invalid_row_count`, `upload_duration_ms`, `success`; on failure `error_type` and `missing_columns` (CSV *headers*, never row data) |
| **Fires once** | Per upload. A re-entry lock prevents a double-click producing two imports |
| **Success** | `csv_upload_completed` |
| **Failure** | `csv_upload_failed`. `missing_columns` names the exact columns — the single most actionable diagnostic in the funnel, since a fixable schema mismatch is invisible otherwise |

## Step 4 — Analysis started

| | |
|---|---|
| **Event** | `analysis_started` |
| **Trigger** | The proactive run kicked off by a successful upload, watched by `useProactiveAnalysis`; also a manual retry |
| **Properties** | `source` (`proactive_upload`), `organization_id` |
| **Fires once** | Keyed by a per-run id in `localStorage`, cleared when the run ends. A refresh mid-run cannot re-fire it; a retry correctly counts as a new run |
| **Success** | Advances to `analysis_completed` |
| **Failure** | See below — a start with no terminal event means the tab closed mid-run |

## Step 5 — Analysis completed

| | |
|---|---|
| **Events** | `analysis_completed` \| `analysis_failed`, then `recommendation_generated` |
| **Trigger** | Terminal status from `/analysis-status`, or the client-side timeout |
| **Properties** | `organization_id`, `duration_ms`, `success`, `recommendation_count`; on failure `error_type` (`backend_reported` \| `client_timeout`) |
| **Fires once** | Keyed by run id, emitted before the run flags are cleared |
| **Success** | `analysis_completed`. `recommendation_generated` fires **only when `recommendation_count > 0`** — a run that finishes having found nothing is a different outcome, and only the latter can activate anyone |
| **Failure** | `analysis_failed`. Split by `error_type`: `client_timeout` means slow, `backend_reported` means broken. `duration_ms` on completions tells you whether the "first insight in about two minutes" claim is true |

## Step 6 — First recommendation viewed

| | |
|---|---|
| **Events** | `recommendations_viewed` (exposure), `recommendation_clicked` (intent) |
| **Trigger** | `recommendations_viewed` fires when Inventory Intelligence renders with at least one real risk or dead-stock item. `recommendation_clicked` fires when the founder clicks through from the analysis toast or the persistent banner |
| **Properties** | `dead_stock_count`, `low_stock_count`; `source` (`analysis_toast` \| `analysis_banner`), `page` |
| **Fires once** | `recommendations_viewed` once per mount via `useTrackOnce` (StrictMode-safe), and only once data has loaded — never on an empty state |
| **Success** | **`recommendation_clicked` is activation.** The founder had a recommendation about their own catalogue and chose to act on it |
| **Failure** | `recommendations_viewed` without `recommendation_clicked` — we showed them something and they didn't believe it, or didn't understand it |

---

## The funnel to build in PostHog

```
landing_view
  → signup_started
  → signup_completed
  → workspace_created OR demo_workspace_created
  → csv_upload_completed
  → analysis_started
  → analysis_completed
  → recommendation_clicked
```

**Breakdowns worth having from day one**

- `signup_started` by `source` — which CTA actually converts
- `csv_upload_failed` by `missing_columns` — the schema mismatches to fix first
- `analysis_completed` by `duration_ms` — whether the two-minute promise holds
- `analysis_failed` by `error_type` — slow versus broken
- the whole funnel by `utm_source` — which outreach channel produces activations,
  not just visits

**Known gaps, deliberate**

- Anonymous visitors have no person profile (`person_profiles: "identified_only"`),
  so `landing_view` → `signup_started` is measured on anonymous ids and stitches
  to a person only at `identify()`, which happens at `signup_completed`.
- Autocapture is off. Every event above is explicit, because inside the app a
  captured click label would be a SKU name or a cash figure.
