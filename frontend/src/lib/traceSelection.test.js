/**
 * Regression tests for selectTrace() — run with Node's built-in test runner,
 * no framework/deps required: `node --test src/lib/traceSelection.test.js`
 *
 * These guard against the bug where every "Open Decision Traceability" link
 * (Reorder Center row, Tasks AI card, Recommendation History item) landed on
 * whichever trace was first in the list, regardless of which SKU or specific
 * record the link actually pointed at.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS on purpose,
   so this runs directly under `node --test` with zero bundler/framework involved. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { selectTrace } = require("./traceSelection");

const TRACES = [
  { id: "trace-turtleneck", recommendation_type: "reorder", related_skus: ["LM-1003"] },
  { id: "trace-blazer", recommendation_type: "reorder", related_skus: ["LM-1001"] },
  { id: "trace-dress", recommendation_type: "reorder", related_skus: ["LM-1002"] },
  { id: "trace-trenchcoat", recommendation_type: "optimization", related_skus: ["LM-2005"] },
];

test("returns null for an empty trace list", () => {
  assert.equal(selectTrace([], { sku: "LM-1001" }), null);
});

test("falls back to the first trace when no params are given", () => {
  assert.equal(selectTrace(TRACES, {}).id, "trace-turtleneck");
});

test("an exact traceId always wins, regardless of sku/type", () => {
  const result = selectTrace(TRACES, { traceId: "trace-blazer", sku: "LM-1002", type: "reorder" });
  assert.equal(result.id, "trace-blazer");
});

test("selects the trace matching the specific SKU, not just the first of that type", () => {
  // Regression case: three "reorder" traces exist; asking for LM-1003 must not
  // silently return trace-turtleneck just because it happens to be first.
  const result = selectTrace(TRACES, { sku: "LM-1003", type: "reorder" });
  assert.equal(result.id, "trace-turtleneck");

  const result2 = selectTrace(TRACES, { sku: "LM-1002", type: "reorder" });
  assert.equal(result2.id, "trace-dress");
});

test("a sku match is still constrained by an explicit type filter", () => {
  // LM-2005 only exists on an "optimization" trace — asking for it under the
  // "reorder" filter must not match it.
  const result = selectTrace(TRACES, { sku: "LM-2005", type: "reorder" });
  assert.notEqual(result.id, "trace-trenchcoat");
});

test("falls back to the first trace of the requested type when sku is unknown", () => {
  const result = selectTrace(TRACES, { sku: "SKU-DOES-NOT-EXIST", type: "optimization" });
  assert.equal(result.id, "trace-trenchcoat");
});

test("low_stock type filter also matches reorder-type traces (legacy alias)", () => {
  const result = selectTrace(TRACES, { type: "low_stock" });
  assert.equal(result.recommendation_type, "reorder");
});

test("an unknown traceId falls through to sku/type matching instead of failing", () => {
  const result = selectTrace(TRACES, { traceId: "does-not-exist", sku: "LM-1001" });
  assert.equal(result.id, "trace-blazer");
});
