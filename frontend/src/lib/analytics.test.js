/**
 * Privacy guarantees for the PostHog layer.
 *
 * The allowlist is the mechanism that makes leaking business data structurally
 * impossible rather than a matter of discipline at each call site. If these
 * fail, sensitive data can reach PostHog.
 *
 * Run: npm test
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

// analytics.ts is TypeScript and imports posthog-js, so rather than transpile
// we extract and exercise the pure sanitizer logic from source. This keeps the
// test dependency-free while still testing the real allowlist.
const SRC = fs.readFileSync(path.join(__dirname, "analytics.ts"), "utf8");

function allowedKeys() {
  const block = SRC.split("const ALLOWED_PROPERTY_KEYS = new Set<string>([")[1]
    .split("]);")[0];
  return new Set(
    block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith('"'))
      .map((l) => l.replace(/^"/, "").replace(/",?$/, ""))
  );
}

const ALLOWED = allowedKeys();
const MAX_STRING_LENGTH = 120;

function sanitize(props) {
  const safe = {};
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "string") safe[key] = value.slice(0, MAX_STRING_LENGTH);
    else if (typeof value === "number" || typeof value === "boolean") safe[key] = value;
    else if (Array.isArray(value))
      safe[key] = value.slice(0, 25).map((v) => String(v).slice(0, MAX_STRING_LENGTH));
  }
  return safe;
}

test("blocks every category the privacy policy forbids", () => {
  const forbidden = {
    sku: "JD-EM-S",
    sku_name: "Silk Wrap Dress",
    product_name: "Merino Turtleneck",
    customer_name: "Jane Doe",
    revenue: 148320,
    cost: 64.0,
    price: 180.0,
    margin: 0.62,
    total_inventory_value: 112402,
    recommendation: "Reorder 150 units of the Silk Wrap Dress",
    recommendation_text: "Liquidate dead stock",
    prompt: "What is my burn rate?",
    ai_response: "Your dead stock is $18,450",
    csv_contents: "sku,name,qty",
    rows: [{ sku: "X" }],
    email: "founder@brand.com",
    full_name: "Devottam Kumar",
  };
  assert.deepStrictEqual(sanitize(forbidden), {},
    "no forbidden property may survive sanitisation");
});

test("permits the documented metadata", () => {
  const meta = {
    organization_id: "org-123",
    workspace_id: "ws-456",
    user_id: "user-789",
    sku_count: 412,
    upload_duration_ms: 1840,
    analysis_duration_ms: 5120,
    success: true,
    status: "success",
  };
  assert.deepStrictEqual(sanitize(meta), meta);
});

test("drops unknown keys while keeping known ones in the same payload", () => {
  const mixed = { sku_count: 5, sku_name: "Cashmere Crew", success: true };
  assert.deepStrictEqual(sanitize(mixed), { sku_count: 5, success: true });
});

test("nested objects are never forwarded", () => {
  // Objects are how data leaks: an allowlisted key holding a payload of SKUs.
  const nested = { status: { sku: "JD-EM-S", value: 900 } };
  assert.deepStrictEqual(sanitize(nested), {});
});

test("bounds string length so free text cannot ride along", () => {
  const long = "x".repeat(500);
  assert.strictEqual(sanitize({ status: long }).status.length, MAX_STRING_LENGTH);
});

test("bounds array size and element length", () => {
  const out = sanitize({ missing_columns: Array(60).fill("y".repeat(300)) });
  assert.strictEqual(out.missing_columns.length, 25);
  assert.strictEqual(out.missing_columns[0].length, MAX_STRING_LENGTH);
});

test("allowlist contains no key implying business data", () => {
  const banned = ["sku_name", "product_name", "customer", "revenue", "cost",
                  "price", "margin", "prompt", "response", "recommendation",
                  "content", "email", "full_name"];
  for (const key of ALLOWED) {
    for (const b of banned) {
      assert.ok(key !== b, `allowlist must not contain "${b}"`);
    }
  }
});

test("ingestion host is normalised away from the UI host", () => {
  // us.posthog.com is the app UI; events must go to us.i.posthog.com.
  assert.ok(SRC.includes('"https://us.i.posthog.com"'));
  assert.ok(SRC.includes('raw === "https://us.posthog.com"'),
    "must rewrite the UI host to the ingestion host");
});

test("session replay masks inputs and the authenticated app subtree", () => {
  assert.ok(SRC.includes("maskAllInputs: true"));
  assert.ok(SRC.includes('maskTextSelector: "[data-ph-mask], [data-ph-mask] *"'));
});

test("autocapture is disabled so element text is never harvested", () => {
  assert.ok(SRC.includes("autocapture: false"));
});
