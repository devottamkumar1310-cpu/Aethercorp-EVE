const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const TOPIC_PAGES_SRC = fs.readFileSync(path.join(__dirname, "topicPages.ts"), "utf8");
const RESOURCES_SRC = fs.readFileSync(path.join(__dirname, "resources.ts"), "utf8");
const SITEMAP_SRC = fs.readFileSync(path.join(__dirname, "../app/sitemap.ts"), "utf8");
const ROBOTS_SRC = fs.readFileSync(path.join(__dirname, "../app/robots.ts"), "utf8");

test("TOPIC_PAGES data module contains all 8 required topic pages", () => {
  const expectedSlugs = [
    "inventory-intelligence",
    "shopify-inventory-management",
    "shopify-inventory-forecasting",
    "d2c-inventory-management",
    "fashion-inventory-management",
    "inventory-forecasting",
    "stockout-prediction",
    "dead-stock-management",
  ];

  for (const slug of expectedSlugs) {
    assert.ok(
      TOPIC_PAGES_SRC.includes(`"${slug}"`) || TOPIC_PAGES_SRC.includes(`'${slug}'`),
      `Topic slug '${slug}' missing from topicPages.ts`
    );
  }
});

test("ARTICLES data module contains all 8 required resource articles", () => {
  const expectedSlugs = [
    "predict-shopify-stockouts",
    "shopify-inventory-forecasting-guide",
    "how-much-inventory-d2c-brand",
    "calculate-weeks-of-cover",
    "calculate-reorder-point",
    "how-to-reduce-dead-stock",
    "fashion-inventory-forecasting",
    "d2c-inventory-management-guide",
  ];

  for (const slug of expectedSlugs) {
    assert.ok(
      RESOURCES_SRC.includes(`"${slug}"`) || RESOURCES_SRC.includes(`'${slug}'`),
      `Article slug '${slug}' missing from resources.ts`
    );
  }
});

test("sitemap.ts dynamically imports TOPIC_PAGES and ARTICLES", () => {
  assert.ok(SITEMAP_SRC.includes("TOPIC_PAGES"), "sitemap.ts does not import TOPIC_PAGES");
  assert.ok(SITEMAP_SRC.includes("ARTICLES"), "sitemap.ts does not import ARTICLES");
  assert.ok(SITEMAP_SRC.includes("TOPIC_ROUTES"), "sitemap.ts does not include TOPIC_ROUTES");
  assert.ok(SITEMAP_SRC.includes("RESOURCE_ROUTES"), "sitemap.ts does not include RESOURCE_ROUTES");
});

test("robots.ts allows public routes and disallows protected dashboard/owner routes", () => {
  assert.ok(ROBOTS_SRC.includes('"/dashboard/"'), "robots.ts missing /dashboard/ disallow");
  assert.ok(ROBOTS_SRC.includes('"/owner"'), "robots.ts missing /owner disallow");
  assert.ok(ROBOTS_SRC.includes("GPTBot"), "robots.ts missing AI crawler rule for GPTBot");
  assert.ok(ROBOTS_SRC.includes("ClaudeBot"), "robots.ts missing AI crawler rule for ClaudeBot");
});
