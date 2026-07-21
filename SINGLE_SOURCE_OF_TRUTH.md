# Architectural Policy: Recommendation Traceability

## Permanent Single Source of Truth

As of the final engineering phase, `RecommendationTrace` is the **canonical recommendation entity** for the entire platform.

All subsystems, pages, and components—including Inventory Intelligence, Decision Traceability, Executive Summary, Business Health, and AI CEO—**must** read their recommendations from the `recommendation_traces` database table.

## Future Development Rule
> [!WARNING]
> **No other service should independently generate recommendation lists.**

Any new feature that displays recommendations must consume `RecommendationTrace`. Do not create independent recommendation pipelines or dynamically synthesize new recommendations in future API routes. 

## Recommendation Lifecycle & Versioning
Every recommendation will now progress through an explicit lifecycle (e.g. `Generated`, `Reviewed`, `Accepted`, `Dismissed`, `Completed`, `Expired`). 

If inventory changes and recommendations need to be regenerated:
1. **Preserve** historical `RecommendationTrace` records.
2. **Create** new versions (incrementing the `version` field) rather than overwriting history.

This enables persistent auditability, historical trend analysis, and complete tracking of business decision rationale over time.
