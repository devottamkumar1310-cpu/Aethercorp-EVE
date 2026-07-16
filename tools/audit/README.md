# EVE Audit Benchmarking Suite

This directory contains standalone benchmarking and AI quality evaluation tools for EVE.
These scripts are **NOT part of the production application** and have no connection to the production backend.

## Tools

- `seeder.py` — Downloads benchmark datasets from public URLs and seeds them into a local SQLite DB
- `evaluator.py` — Runs AI quality/accuracy evaluation against a Supabase Postgres instance
- `ground_truth.py` — Calculates ground truth metrics from benchmark datasets
- `bi_layer.py` — Business intelligence layer for audit analysis

## Setup

Set required environment variables before running:

```bash
export AUDIT_DATABASE_URL="postgresql://user:pass@host:port/db"
export AUDIT_USER_ID="<benchmark-user-uuid>"
export AUDIT_ORG_ID="<benchmark-org-uuid>"
```

## Usage

```bash
# 1. Seed the local benchmark database (downloads datasets from public GitHub URLs)
python seeder.py

# 2. Run evaluation against the configured Supabase instance
python -m asyncio evaluator
```

> **Note:** Datasets are downloaded on demand by `seeder.py`. Do not commit CSV/DB files to git.
