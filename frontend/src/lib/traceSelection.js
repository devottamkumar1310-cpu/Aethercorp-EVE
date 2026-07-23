/**
 * Pure selection logic for Decision Traceability deep-links, extracted out of
 * traceability/page.tsx so it can be unit tested without a React/Next.js test
 * harness (and so the same function that runs in prod is the one under test).
 *
 * Regression this guards against: every "Open Decision Traceability" link
 * elsewhere in the app (Reorder Center rows, Tasks AI cards, Recommendation
 * History) passes a `sku` and/or `traceId` query param naming exactly which
 * decision it means. The traceability page used to only read `type`, so
 * every link — regardless of which SKU's row you clicked — landed on
 * whichever trace of that type happened to be first in the list.
 */

/** @type {Record<string, string[]>} */
const TYPE_FILTER_MAP = {
  low_stock: ["reorder", "low_stock"],
  dead_stock: ["dead_stock", "markdown"],
  reorder: ["reorder"],
  optimization: ["optimization"],
};

/**
 * @template {{id: string, recommendation_type: string, related_skus?: string[] | null}} T
 * @param {T[]} traces
 * @param {{ traceId?: string | null, sku?: string | null, type?: string | null }} params
 * @returns {T | null} the selected trace, or null if `traces` is empty
 */
function selectTrace(traces, params) {
  if (!traces || traces.length === 0) return null;

  const { traceId, sku, type } = params || {};
  const allowed = type ? TYPE_FILTER_MAP[type] : null;

  if (traceId) {
    const byId = traces.find((t) => t.id === traceId);
    if (byId) return byId;
  }

  if (sku) {
    const bySku = traces.find(
      (t) =>
        Array.isArray(t.related_skus) &&
        t.related_skus.includes(sku) &&
        (!allowed || allowed.includes((t.recommendation_type || "").toLowerCase()))
    );
    if (bySku) return bySku;
  }

  if (allowed) {
    const byType = traces.find((t) => allowed.includes((t.recommendation_type || "").toLowerCase()));
    if (byType) return byType;
  }

  return traces[0];
}

module.exports = { selectTrace, TYPE_FILTER_MAP };
