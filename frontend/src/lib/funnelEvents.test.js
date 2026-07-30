/**
 * Structural guarantees for the activation funnel.
 *
 * Two failure modes here are silent and only discovered when a funnel turns out
 * to be unbuildable weeks later:
 *
 *   1. An event name that is not in the EveEvent union — TypeScript catches
 *      this, but only for call sites it can see; this asserts it repo-wide.
 *   2. A property key that is not on the privacy allowlist. sanitizeProperties
 *      DROPS unknown keys silently in production, so a funnel breakdown by
 *      `source` or `method` would come back empty with no error anywhere.
 *
 * Follows the existing analytics.test.js approach: parse the sources rather
 * than transpile, keeping the suite dependency-free.
 *
 * Run: npm test
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC_DIR = path.join(__dirname, "..");
const ANALYTICS = fs.readFileSync(path.join(__dirname, "analytics.ts"), "utf8");

function declaredEvents() {
  const block = ANALYTICS.split("export type EveEvent =")[1].split(";")[0];
  return new Set(
    block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|"))
      .map((l) => l.replace(/^\|\s*/, "").replace(/"/g, "").trim())
      .filter(Boolean)
  );
}

function allowedKeys() {
  const block = ANALYTICS.split("const ALLOWED_PROPERTY_KEYS = new Set<string>([")[1]
    .split("]);")[0];
  return new Set(
    block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith('"'))
      .map((l) => l.replace(/^"/, "").replace(/",?$/, ""))
  );
}

function sourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Every track()/trackOncePerSession() call site, with its literal prop keys. */
function callSites() {
  const sites = [];
  // track("name", { ... })  |  trackOncePerSession("name", key, { ... })
  const re = /\b(?:track|trackOncePerSession)\(\s*"([a-z_]+)"([^;]*?)\)\s*;/gs;
  for (const file of sourceFiles(SRC_DIR)) {
    if (file.endsWith(".test.js")) continue;
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(text)) !== null) {
      const [, event, rest] = m;
      const objMatch = rest.match(/\{([\s\S]*)\}/);
      const keys = objMatch
        ? [...objMatch[1].matchAll(/(?:^|[,{\s])([a-z_][a-z0-9_]*)\s*:/gi)].map((k) => k[1])
        : [];
      sites.push({ file: path.relative(SRC_DIR, file), event, keys });
    }
  }
  return sites;
}

test("every tracked event name is declared in the EveEvent union", () => {
  const declared = declaredEvents();
  const unknown = callSites()
    .filter((s) => !declared.has(s.event))
    .map((s) => `${s.event} (${s.file})`);
  assert.deepStrictEqual(unknown, [], `Undeclared events: ${unknown.join(", ")}`);
});

test("every property sent with an event survives the privacy allowlist", () => {
  const allowed = allowedKeys();
  const dropped = [];
  for (const site of callSites()) {
    for (const key of site.keys) {
      if (!allowed.has(key)) dropped.push(`${site.event}.${key} (${site.file})`);
    }
  }
  assert.deepStrictEqual(
    dropped,
    [],
    `These would be silently dropped before reaching PostHog: ${dropped.join(", ")}`
  );
});

test("the activation funnel's events all exist", () => {
  const declared = declaredEvents();
  // The funnel documented in docs/activation_funnel.md. If one of these is ever
  // renamed, the document and every saved PostHog insight go stale together.
  for (const event of [
    "landing_view",
    "signup_started",
    "signup_completed",
    "login_completed",
    "workspace_created",
    "demo_workspace_created",
    "free_trial_started",
    "csv_upload_started",
    "csv_upload_completed",
    "csv_upload_failed",
    "analysis_started",
    "analysis_completed",
    "analysis_failed",
    "recommendation_generated",
    "recommendations_viewed",
    "recommendation_clicked",
  ]) {
    assert.ok(declared.has(event), `${event} is missing from EveEvent`);
  }
});

test("each funnel step is emitted somewhere in the app", () => {
  const emitted = new Set(callSites().map((s) => s.event));
  // Guards against an event that is declared and documented but never fires —
  // which is exactly how signup_completed and login_completed came to be
  // missing for the Google path.
  for (const event of [
    "signup_completed",
    "login_completed",
    "workspace_created",
    "csv_upload_started",
    "analysis_started",
    "analysis_completed",
    "analysis_failed",
    "recommendation_generated",
    "recommendation_clicked",
  ]) {
    assert.ok(emitted.has(event), `${event} is declared but never fired`);
  }
});
