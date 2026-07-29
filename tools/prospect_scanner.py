#!/usr/bin/env python3
"""
EVE prospect scanner — turns a list of Shopify storefronts into a ranked
outreach list with a specific, true observation for each brand.

WHY THIS EXISTS
    Cold outreach reply rates collapse without a real observation about the
    recipient's own business. Writing those by hand caps a solo founder at a
    handful of contacts a day, which is far below what the funnel maths needs.
    This reads only PUBLIC storefront data and generates the observation line.

WHAT IT READS
    Only /products.json — the public, documented Shopify storefront endpoint
    that every store serves to anonymous visitors. No authentication, no
    personal data, no email harvesting, no bypassing of any access control.
    Requests are rate-limited and identify themselves honestly.

WHAT IT SCORES
    fit_score  — is this brand shaped like our ICP? (variant depth, size runs)
    pain_score — is the pain acute TODAY? (sold-out variants on hero products)

USAGE
    python tools/prospect_scanner.py --input stores.txt --output prospects.csv
    python tools/prospect_scanner.py --input stores.txt --market IN --min-fit 40

    stores.txt: one storefront per line, e.g.
        https://brandname.com
        anotherbrand.myshopify.com
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, asdict, field
from typing import Any, Optional

USER_AGENT = (
    "EVE-ProspectResearch/1.0 (+https://eveinventory.in; "
    "public storefront data only; contact support@eveinventory.in)"
)
REQUEST_TIMEOUT = 15
DELAY_BETWEEN_REQUESTS = 1.5  # be a courteous guest on someone else's server
PAGES_TO_FETCH = 3            # 250 products/page — 750 is plenty to characterise
PRODUCTS_PER_PAGE = 250

# Size tokens that indicate an apparel size run rather than a generic variant.
SIZE_TOKENS = {
    "xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl", "2xl", "3xl", "4xl",
    "small", "medium", "large", "x-small", "x-large",
    "uk6", "uk8", "uk10", "uk12", "uk14", "uk16",
    "28", "30", "32", "34", "36", "38", "40", "42", "44",
    "free size", "onesize", "one size",
    # Footwear runs. Without these, a shoe brand scores zero size runs and is
    # silently dropped — footwear has the same size-curve problem as apparel
    # and is a legitimate part of the ICP.
    "5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5",
    "10", "10.5", "11", "11.5", "12", "13",
}

APPAREL_HINTS = {
    "shirt", "tee", "top", "dress", "skirt", "trouser", "pant", "jean",
    "jacket", "coat", "hoodie", "sweater", "knit", "blouse", "kurta",
    "saree", "lehenga", "co-ord", "bra", "legging", "short", "blazer",
    "sweatshirt", "cardigan", "jumpsuit", "romper", "tunic", "salwar",
    # Footwear
    "shoe", "sneaker", "runner", "boot", "sandal", "loafer", "heel",
    "trainer", "slipper", "flat",
}


@dataclass
class Prospect:
    store: str
    reachable: bool = False
    error: str = ""
    product_count: int = 0
    variant_count: int = 0
    apparel_ratio: float = 0.0
    has_size_runs: bool = False
    sold_out_variants: int = 0
    sold_out_ratio: float = 0.0
    # Products where a size is gone but the style is still live — the sharpest
    # signal that a brand is actively losing sales right now.
    broken_size_runs: int = 0
    hero_stockouts: list = field(default_factory=list)
    fit_score: int = 0
    pain_score: int = 0
    total_score: int = 0
    observation: str = ""


def normalize_store_url(raw: str) -> str:
    raw = raw.strip().rstrip("/")
    if not raw:
        return ""
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    return raw


def fetch_products(store: str) -> tuple[list[dict[str, Any]], str]:
    """Fetch up to PAGES_TO_FETCH pages of the public products.json feed."""
    products: list[dict[str, Any]] = []
    for page in range(1, PAGES_TO_FETCH + 1):
        url = f"{store}/products.json?limit={PRODUCTS_PER_PAGE}&page={page}"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                if resp.status != 200:
                    return products, f"HTTP {resp.status}"
                payload = json.loads(resp.read().decode("utf-8", errors="replace"))
        except urllib.error.HTTPError as e:
            # 404 almost always means "not a Shopify store" — useful signal,
            # not an error worth retrying.
            return products, ("not-shopify" if e.code == 404 else f"HTTP {e.code}")
        except urllib.error.URLError as e:
            return products, f"unreachable: {e.reason}"
        except (TimeoutError, json.JSONDecodeError, ValueError) as e:
            return products, f"bad-response: {type(e).__name__}"

        batch = payload.get("products", [])
        if not batch:
            break
        products.extend(batch)
        if len(batch) < PRODUCTS_PER_PAGE:
            break
        time.sleep(DELAY_BETWEEN_REQUESTS)

    return products, ""


def _is_size_value(value: str) -> bool:
    return value.strip().lower() in SIZE_TOKENS


def _looks_like_apparel(product: dict[str, Any]) -> bool:
    haystack = f"{product.get('title', '')} {product.get('product_type', '')}".lower()
    return any(hint in haystack for hint in APPAREL_HINTS)


def analyse(store: str, products: list[dict[str, Any]]) -> Prospect:
    p = Prospect(store=store, reachable=True, product_count=len(products))
    if not products:
        p.error = "no-products"
        return p

    apparel_products = 0
    size_run_products = 0
    total_variants = 0
    sold_out_variants = 0
    broken_runs = 0
    hero_stockouts: list[str] = []

    for index, product in enumerate(products):
        variants = product.get("variants") or []
        total_variants += len(variants)

        if _looks_like_apparel(product):
            apparel_products += 1

        # Does this product have a genuine size run?
        size_values = set()
        for variant in variants:
            for key in ("option1", "option2", "option3"):
                value = variant.get(key)
                if value and _is_size_value(str(value)):
                    size_values.add(str(value).strip().lower())

        product_sold_out = [
            v for v in variants if v.get("available") is False
        ]
        sold_out_variants += len(product_sold_out)

        if len(size_values) >= 3:
            size_run_products += 1
            # A broken size run: some sizes gone, some still live. This is the
            # money signal — the style still sells, they just can't fulfil it.
            if product_sold_out and len(product_sold_out) < len(variants):
                broken_runs += 1
                # Shopify orders products by collection position; the first
                # ~15 are a reasonable proxy for "hero product".
                if index < 15 and len(hero_stockouts) < 3:
                    missing = sorted({
                        str(v.get(k)).strip()
                        for v in product_sold_out
                        for k in ("option1", "option2", "option3")
                        if v.get(k) and _is_size_value(str(v.get(k)))
                    })
                    if missing:
                        hero_stockouts.append(
                            f"{product.get('title', 'Untitled')} ({', '.join(missing[:4])})"
                        )

    p.variant_count = total_variants
    p.apparel_ratio = round(apparel_products / len(products), 3)
    p.has_size_runs = size_run_products >= max(3, len(products) * 0.15)
    p.sold_out_variants = sold_out_variants
    p.sold_out_ratio = round(sold_out_variants / total_variants, 3) if total_variants else 0.0
    p.broken_size_runs = broken_runs
    p.hero_stockouts = hero_stockouts

    p.fit_score = score_fit(p)
    p.pain_score = score_pain(p)
    p.total_score = p.fit_score + p.pain_score
    p.observation = build_observation(p)
    return p


def score_fit(p: Prospect) -> int:
    """Is this brand shaped like our ICP? 0–50."""
    score = 0

    # Variant depth is the whole reason EVE exists. Below ~100 variants a
    # spreadsheet still works and they will not pay.
    if 100 <= p.variant_count <= 2000:
        score += 25
    elif 2000 < p.variant_count <= 5000:
        score += 15
    elif 50 <= p.variant_count < 100:
        score += 8

    if p.apparel_ratio >= 0.6:
        score += 15
    elif p.apparel_ratio >= 0.3:
        score += 8

    if p.has_size_runs:
        score += 10

    # Apparel gate. A 200-variant homeware or electronics store looks
    # identical to a 200-variant fashion brand on variant count alone, but
    # size-curve forecasting is worthless to it. Without apparel signal OR a
    # size run, variant depth tells us nothing — so it earns nothing.
    if p.apparel_ratio < 0.3 and not p.has_size_runs:
        return 0

    return min(score, 50)


def score_pain(p: Prospect) -> int:
    """Is the pain acute today? 0–50."""
    score = 0

    # Broken size runs are worth more than raw stockout count: they prove
    # demand exists AND that replenishment is failing.
    score += min(p.broken_size_runs * 4, 30)

    if 0.05 <= p.sold_out_ratio <= 0.40:
        score += 15  # actively losing sales
    elif p.sold_out_ratio > 0.40:
        score += 5   # possibly seasonal wind-down, weaker signal

    if p.hero_stockouts:
        score += 5

    return min(score, 50)


def build_observation(p: Prospect) -> str:
    """The one true sentence that earns a reply. Empty if we have nothing real."""
    if p.hero_stockouts:
        return (
            f"{p.hero_stockouts[0]} is sold out in those sizes while the rest of "
            f"the run is still live"
        )
    if p.broken_size_runs >= 3:
        return (
            f"{p.broken_size_runs} styles are missing sizes mid-run while the "
            f"rest of each run is still selling"
        )
    if p.sold_out_variants >= 10:
        return f"{p.sold_out_variants} variants are currently out of stock"
    return ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, help="File with one storefront per line")
    parser.add_argument("--output", default="prospects.csv", help="Output CSV path")
    parser.add_argument("--market", default="", help="Tag rows with a market label (e.g. IN, US)")
    # Defaults to 25, not 0. A zero default silently wrote unqualified brands
    # into the outreach list, which is worse than writing nothing — you only
    # find out after you've burned the contact.
    parser.add_argument("--min-fit", type=int, default=25, help="Drop rows below this fit score (default 25)")
    parser.add_argument("--limit", type=int, default=0, help="Stop after N stores (for a quick pilot)")
    args = parser.parse_args()

    try:
        with open(args.input, encoding="utf-8") as fh:
            stores = [normalize_store_url(line) for line in fh if line.strip() and not line.startswith("#")]
    except OSError as e:
        print(f"Could not read {args.input}: {e}", file=sys.stderr)
        return 1

    stores = [s for s in stores if s]
    if args.limit:
        stores = stores[: args.limit]

    print(f"Scanning {len(stores)} storefronts (public /products.json only)...\n")

    results: list[Prospect] = []
    for i, store in enumerate(stores, 1):
        products, err = fetch_products(store)
        if err:
            results.append(Prospect(store=store, reachable=False, error=err))
            print(f"[{i}/{len(stores)}] {store:45} SKIP ({err})")
        else:
            p = analyse(store, products)
            results.append(p)
            flag = "QUALIFIED" if p.total_score >= 50 else "         "
            print(
                f"[{i}/{len(stores)}] {store:45} {flag} "
                f"fit={p.fit_score:2} pain={p.pain_score:2} "
                f"variants={p.variant_count:5} broken_runs={p.broken_size_runs}"
            )
        time.sleep(DELAY_BETWEEN_REQUESTS)

    qualified = [
        p for p in results
        if p.reachable and p.fit_score >= args.min_fit and p.observation
    ]
    qualified.sort(key=lambda x: x.total_score, reverse=True)

    fieldnames = list(asdict(results[0]).keys()) if results else []
    if args.market:
        fieldnames.append("market")

    with open(args.output, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for p in qualified:
            row = asdict(p)
            row["hero_stockouts"] = " | ".join(p.hero_stockouts)
            if args.market:
                row["market"] = args.market
            writer.writerow(row)

    unreachable = sum(1 for p in results if not p.reachable)
    print(
        f"\nScanned {len(results)} | unreachable/not-Shopify {unreachable} | "
        f"outreach-ready {len(qualified)}"
    )
    print(f"Written to {args.output}, ranked by total_score.\n")

    if qualified:
        print("Top 5 — these are your first messages:")
        for p in qualified[:5]:
            print(f"  {p.total_score:3}  {p.store}")
            print(f"       → {p.observation}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
