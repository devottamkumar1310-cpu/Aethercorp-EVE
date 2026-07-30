# Sales history duplication — audit and architecture options

**Status:** decision pending. No code changed. Written 2026-07-30.

**The bug, reproduced:** uploading the same CSV three times into one workspace.

```
after upload 1: products=1 sales_rows=1 total_qty=5
after upload 2: products=1 sales_rows=2 total_qty=10
after upload 3: products=1 sales_rows=3 total_qty=15
```

Products upsert correctly by SKU. Sales rows accumulate. Sales velocity is the
input to days-of-cover, stockout dates, revenue-at-risk and reorder quantities,
so a merchant who imports twice gets confidently wrong numbers on every screen
with nothing indicating it.

---

## 1. Audit: every path that writes a SalesRecord

| # | Path | Trigger | Dedup? |
|---|---|---|---|
| 1 | `ImporterService.import_master` (`importer_service.py:844`) | Master CSV upload — **the activation path** | None. `db.add_all(sales_to_add)` |
| 2 | `ImporterService.import_sales` (`importer_service.py:546`) | Sales CSV upload | None. Same append |
| 3 | `ingestion_service.py:240` | Document AI classifies an upload as a **Sales Invoice** | None. One row per invoice line |
| 4 | `ingestion_service.py:348` | Document AI extracts sales records | None |

**All four append. None reconcile against what is already stored. There is no
database constraint preventing it.**

Reachability today: path 1 is the one merchants hit (both upload controls on
Inventory Intelligence). Paths 2 and 4 have no UI caller. Path 3 fires whenever a
document is classified as a sales invoice — so **re-uploading the same invoice
PDF double-counts that sale too**. This is not purely a CSV problem.

### The root cause is a declared invariant that nothing enforces

`SalesRecord`'s own docstring (`models/inventory.py:39`):

> Represents an aggregated sales record for a given day and product.

That is a uniqueness claim on `(organization_id, product_id, date)`. The schema
has no such constraint, and no writer honours it. **The fix is not inventing new
semantics — it is enforcing the ones the model already declares.**

### A misleading field, worth knowing before you read the API

`import_master` and `import_sales` both return `duplicate_rows` in the import
summary. It is computed as `df.duplicated(subset=["sku"])` — duplicates *within
the uploaded file, keyed on SKU alone*. It:

- never deduplicates anything, only counts;
- ignores `date` entirely, so a legitimate sales file with 90 days per SKU
  reports 89 "duplicates" per SKU;
- says nothing about collisions with rows already in the database, which is the
  actual bug.

Whatever we choose, this field should be corrected or removed — it currently
reads as reassurance that duplicates are handled.

---

## 2. Options

### A. Status quo — append everything
Keep as is.
- **For:** zero work, zero migration risk.
- **Against:** the numbers are wrong after any re-import, silently. Every other
  option beats this.
- **Verdict:** not viable now that the failure is confirmed.

### B. Unique constraint on `(organization_id, product_id, date)` + upsert
Add the DB constraint the model already implies; change writers to
`INSERT ... ON CONFLICT (org, product, date) DO UPDATE`. A re-imported day is
treated as a **restatement** — last write wins.
- **For:** enforces the documented invariant at the only level that cannot be
  bypassed. Idempotent: importing the same file ten times gives one row. Matches
  merchant intent — re-exporting from Shopify means *corrected* data, not
  additional sales. Fixes all four write paths at once.
- **Against:** requires a data migration over existing rows, and existing
  workspaces may already hold duplicates — you must decide what those collapse
  to before the constraint can be applied (see §3). Loses the ability to record
  two genuinely separate same-day batches as separate rows (they'd merge).
- **Risk:** medium, concentrated entirely in the one-time migration.

### C. Delete-then-insert the date window the file covers
For each import, compute `[min(date), max(date)]` in the file and delete existing
rows in that range for the affected products before inserting.
- **For:** idempotent. Handles a merchant re-exporting a corrected month cleanly
  — the old month is fully replaced, including rows that were removed from the
  new export.
- **Against:** destructive in a way that surprises. A file containing one row for
  2026-01-01 and one for 2026-12-31 deletes the entire year in between. Partial
  exports silently destroy history. Needs per-product scoping to be even
  arguably safe, and even then the blast radius is hard to explain in a UI.
- **Risk:** high. This is the option most likely to lose real data.

### D. Application-level pre-check
Query existing `(product, date)` keys before insert; skip or update in Python.
- **For:** no migration, no schema change. Can ship behind a flag. Easy to
  reason about per-importer.
- **Against:** not enforced — every future writer must remember to do it, and we
  already have four writers that forgot. Races under concurrent imports (two
  simultaneous uploads both see "not present" and both insert). Fixes symptoms,
  leaves the invariant unenforced.
- **Risk:** low to ship, but it does not actually close the hole.

### E. Import batches with supersede
Add an `import_batch` table; every row carries `batch_id`. Re-importing marks the
previous batch superseded rather than mutating rows. Reads filter to live
batches.
- **For:** fully auditable — you can see exactly what each upload changed, and
  roll one back. Answers "why did my numbers change?", which merchants *will*
  ask. Natural fit with EVE's existing decision-traceability positioning.
- **Against:** materially larger build. Every read path that touches
  `sales_records` must learn about batches, or you need a materialized view.
  Overkill for the current scale.
- **Risk:** low correctness risk, high scope.

### F. Event-sourced raw imports + materialized aggregates
Store raw uploaded rows immutably; recompute aggregates on read.
- **For:** most correct and most flexible long term.
- **Against:** a re-architecture, not a fix. Wrong thing to do before customer
  usage teaches you the access patterns.
- **Risk:** unjustifiable at 20 users.

---

## 3. Recommendation

**Target: B — the unique constraint plus upsert, with last-write-wins semantics.**

It enforces the invariant the model already declares, at the level that cannot be
bypassed, and it fixes all four write paths including the document-AI ones that a
per-importer fix would miss. "Re-importing a day restates that day" is also the
behaviour a merchant assumes without being told.

Sequenced so the risky part is separated from the useful part:

1. **Measure first, change nothing.** Run a read-only query in production:
   how many `(org, product, date)` groups have >1 row, in how many workspaces,
   and what do the duplicate rows look like — identical (a re-upload artifact) or
   differing (possibly genuine separate batches)? *This query answers whether the
   migration is trivial or delicate, and it is the only thing that should happen
   before you decide.*
2. **Interim, if step 1 shows real exposure:** surface it rather than mutate it —
   the import summary already exists, so tell the merchant "this file covers
   dates you've already imported; importing again will double-count them."
   No behaviour change, no migration, and it protects the first 20 users while
   the decision is made.
3. **Then migrate**, with the collapse rule chosen from step 1's evidence. My
   prior is *keep the most recent row per key* (duplicates are overwhelmingly
   re-upload artifacts, and summing them would bake today's wrong numbers in
   permanently) — but that must be confirmed against real data, not assumed.
4. **Then add the constraint and switch writers to upsert.**

Do not take C. It is the only option that can destroy history a merchant cannot
recover, and the blast radius is not explainable in a dialog.

E remains the right destination *if* traceability of imports becomes a product
requirement. B does not block it — a batch table can be layered on later.

---

## 4. What is not affected

`mode=replace` (the demo-import guard) is safe: `clean_org_data` deletes
`sales_records` for the workspace before importing, so it cannot duplicate.

The double-click vector into `import_master` was closed on 2026-07-30 by the
re-entry lock in `app/dashboard/inventory/page.tsx`. What remains is deliberate
re-upload, and re-uploading the same sales invoice PDF (path 3).
