#!/usr/bin/env python3
"""
E1 outreach generator — turns a ranked prospect CSV into arm-tagged,
personalised messages so the teardown-vs-trial experiment produces evidence.

WHY THIS EXISTS
    The experiment is worthless without attribution. If a founder receives a
    message and later signs up, we must know which arm they were in. Every
    link this emits carries UTM parameters that the site's analytics already
    captures on first touch (see frontend/src/lib/analytics.ts), so signup,
    upload and booking all resolve back to an arm automatically.

ARM ASSIGNMENT
    Deterministic — derived from a hash of the store URL, not randomness.
    Rerunning the generator never reshuffles anyone between arms, which would
    silently corrupt results mid-experiment.

USAGE
    python tools/outreach_generator.py --input prospects.csv --output messages.csv
    python tools/outreach_generator.py --input prospects.csv --channel whatsapp
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import sys
from urllib.parse import urlencode, urlparse

CAMPAIGN = "e1_offer_test"
SITE = "https://eveinventory.in"

# --- Arms -------------------------------------------------------------------
# A: teardown  — we do the work, no signup, no call asked for
# B: trial     — the conventional SaaS ask, as the control
ARMS = ("teardown", "trial")


def assign_arm(store: str) -> str:
    """Stable 50/50 split keyed on the store URL."""
    digest = hashlib.sha256(store.encode("utf-8")).hexdigest()
    return ARMS[int(digest[:8], 16) % 2]


def brand_name(store: str) -> str:
    """Best-effort readable brand name from a storefront URL."""
    host = urlparse(store).netloc or store
    host = host.replace("www.", "").replace(".myshopify.com", "")
    return host.split(".")[0].replace("-", " ").title()


def tracked_url(path: str, arm: str, channel: str, store: str) -> str:
    """Landing URL carrying the arm so analytics can attribute the signup."""
    params = {
        "utm_source": "outreach",
        "utm_medium": channel,
        "utm_campaign": CAMPAIGN,
        "utm_content": arm,
        "ref": urlparse(store).netloc.replace("www.", ""),
    }
    return f"{SITE}{path}?{urlencode(params)}"


# --- Templates --------------------------------------------------------------
# Deliberately short. The observation does the work; length kills reply rates.
# No superlatives, no "revolutionary AI", no fake urgency. Every claim here is
# one the product can actually honour.

def build_message(arm: str, channel: str, brand: str, observation: str, url: str) -> tuple[str, str]:
    """Returns (subject, body). Subject is empty for DM channels."""

    if arm == "teardown":
        subject = f"{brand} — a few sizes sold out"
        if channel == "whatsapp":
            body = (
                f"Hi — I run inventory teardowns for Shopify fashion brands.\n\n"
                f"Noticed on {brand}: {observation}.\n\n"
                f"If you send me your Shopify product export I'll come back within a day "
                f"with your riskiest SKUs and how much cash is sitting in slow movers. "
                f"Free, and no call needed.\n\n"
                f"Worth a look?"
            )
        elif channel in ("linkedin", "instagram"):
            body = (
                f"Hi — noticed {observation} on {brand}.\n\n"
                f"I do free inventory teardowns for Shopify fashion brands: send your "
                f"product export, I send back your riskiest SKUs and dead stock in "
                f"rupees/dollars within a day. No call, no pitch.\n\n"
                f"Want one?"
            )
        else:  # email
            body = (
                f"Hi,\n\n"
                f"Noticed {observation} on {brand}.\n\n"
                f"I do free inventory teardowns for Shopify fashion brands — send me your "
                f"product export (Shopify admin, two clicks) and I'll send back your 10 "
                f"riskiest SKUs and how much cash is tied up in slow movers, within a day.\n\n"
                f"No call, no pitch. Just reply and I'll do it.\n\n"
                f"— Devottam\n{url}"
            )

    else:  # trial — the control arm
        subject = f"{brand} — inventory forecasting for fashion"
        if channel == "whatsapp":
            body = (
                f"Hi — I build EVE, inventory intelligence for Shopify fashion brands.\n\n"
                f"Noticed on {brand}: {observation}.\n\n"
                f"EVE predicts which sizes are about to sell out and shows the cash stuck "
                f"in dead stock. Free 14-day trial, no card:\n{url}\n\n"
                f"Happy to walk you through it."
            )
        elif channel in ("linkedin", "instagram"):
            body = (
                f"Hi — noticed {observation} on {brand}.\n\n"
                f"I build EVE: inventory intelligence for Shopify fashion brands. It flags "
                f"which sizes are about to stock out and how much cash is trapped in slow "
                f"movers. Free 14-day trial, no card required:\n{url}\n\n"
                f"Worth a try?"
            )
        else:  # email
            body = (
                f"Hi,\n\n"
                f"Noticed {observation} on {brand}.\n\n"
                f"I build EVE — inventory intelligence for Shopify fashion brands. Upload "
                f"your Shopify export and it shows which sizes are about to sell out, how "
                f"much cash is trapped in dead stock, and what to reorder.\n\n"
                f"Free 14-day trial, no card: {url}\n\n"
                f"— Devottam"
            )

    return subject, body


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, help="prospects.csv from prospect_scanner.py")
    parser.add_argument("--output", default="messages.csv")
    parser.add_argument("--channel", default="email",
                        choices=["email", "linkedin", "instagram", "whatsapp"])
    parser.add_argument("--limit", type=int, default=0, help="Cap rows (for a pilot batch)")
    args = parser.parse_args()

    try:
        with open(args.input, encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
    except OSError as e:
        print(f"Could not read {args.input}: {e}", file=sys.stderr)
        return 1

    rows = [r for r in rows if (r.get("observation") or "").strip()]
    if args.limit:
        rows = rows[: args.limit]

    if not rows:
        print("No prospects with an observation. Run the scanner first, or widen --min-fit.",
              file=sys.stderr)
        return 1

    out_fields = [
        "store", "brand", "arm", "channel", "total_score", "observation",
        "subject", "message", "tracked_url",
        # Filled in by hand as the experiment runs — this IS the results table.
        "sent_date", "replied", "reply_type", "teardown_requested",
        "demo_booked", "uploaded", "paid", "notes",
    ]

    counts = {"teardown": 0, "trial": 0}
    with open(args.output, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=out_fields)
        writer.writeheader()

        for row in rows:
            store = row["store"]
            arm = assign_arm(store)
            counts[arm] += 1
            brand = brand_name(store)
            observation = row["observation"].strip()

            # Teardown arm points at /contact (the reply is the conversion);
            # trial arm points at /signup. Different intents, different pages.
            path = "/demo" if arm == "teardown" else "/signup"
            url = tracked_url(path, arm, args.channel, store)
            subject, body = build_message(arm, args.channel, brand, observation, url)

            writer.writerow({
                "store": store,
                "brand": brand,
                "arm": arm,
                "channel": args.channel,
                "total_score": row.get("total_score", ""),
                "observation": observation,
                "subject": subject,
                "message": body,
                "tracked_url": url,
                "sent_date": "", "replied": "", "reply_type": "",
                "teardown_requested": "", "demo_booked": "",
                "uploaded": "", "paid": "", "notes": "",
            })

    print(f"Generated {len(rows)} messages → {args.output}")
    print(f"  teardown arm: {counts['teardown']}")
    print(f"  trial arm:    {counts['trial']}")
    print(f"  channel:      {args.channel}")
    print()

    # Power warning. Sending an underpowered batch is the most expensive
    # mistake available here: you spend the contacts and cannot read the result.
    per_arm = min(counts.values())
    if per_arm < 150:
        print(f"WARNING: {per_arm} per arm. At a ~6% baseline this detects only a 3x")
        print("         difference. To detect 2x you need ~150-200 per arm.")
        print("         Consider scanning more stores before sending.")
    print()
    print("Sample (first message in each arm):")
    print("-" * 66)
    with open(args.output, encoding="utf-8") as fh:
        seen = set()
        for r in csv.DictReader(fh):
            if r["arm"] in seen:
                continue
            seen.add(r["arm"])
            print(f"[{r['arm'].upper()}] {r['brand']}")
            if r["subject"]:
                print(f"Subject: {r['subject']}")
            print(r["message"])
            print("-" * 66)
            if len(seen) == 2:
                break

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
