# EVE v1.0.0-beta Release Notes

## Overview
This beta release marks the transition of EVE into a Founder-Ready platform, focusing on robust business logic, frictionless onboarding, and a streamlined data ingestion process. 

## Key Improvements

### 1. Inventory Intelligence Stabilization
- **Dead Stock Thresholds**: Increased the default `threshold_days` for dead stock detection from 30 days to 180 days. This prevents healthy core basics with long lifecycles from triggering false-positive alerts, building immediate trust with founders.
- **Pricing Elasticity & Profit Margins**: Refactored `AnalyticsService` to ensure `projected_qty_sold` is capped by actual `stock_on_hand`. EVE will no longer recommend mathematically impossible price drops that falsely project massive negative profit impacts.

### 2. Streamlined Onboarding
- **Workspace Navigation Fixes**: Removed the "Skip to Command Center" onboarding loophole that previously placed users into a null workspace state and resulted in a broken dashboard experience. 

### 3. Unified Data Ingestion
- **Master CSV Workflow**: Replaced the fragmented multi-step data upload process with a unified `uploadMasterCSVAPI`. Founders can now drop a single master spreadsheet containing `sku`, `name`, `quantity`, `cost`, and `sales` into EVE, and it will automatically map and ingest the data across all modules seamlessly.

### 4. Codebase Cleanup & Performance
- Removed legacy development scripts and temporary `scratch/` directories.
- Addressed 150+ frontend TypeScript and React Hooks warnings.
- Linted and stabilized backend models.

## Founder Validation Readiness
EVE is now fully stabilized, logically sound, and ready for live user validation with real D2C fashion founders!
