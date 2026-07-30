"""
Deterministic demo-data seeding for EVE.

Three workspaces model three distinct D2C fashion businesses.  Every dashboard
metric, alert, recommendation trace, executive insight, and AI CEO response is
derived from the *same* per-SKU catalog so there are zero contradictions across
the product.

Workspace 1 – Luma & Co.          (Growth Brand)
Workspace 2 – Drift Collective    (Cash-Flow Crisis)
Workspace 3 – Basecamp Basics     (Seasonal Transition)
"""

import sys
import os
import uuid
import datetime
import math
import pandas as pd
from typing import Any, Dict, List, Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.database import SessionLocal
from app.core.scenario import scenario_for_demo
from app.services.importer_service import ImporterService
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.finance import Revenue, Expense
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.document import ProcessedDocument
from app.models.executive_conversation import ExecutiveConversation, ExecutiveMessage

# ──────────────────────────────────────────────────────────────────────────────
# Org IDs (stable across re-seeds) — the canonical demo workspaces owned by the
# primary demo account. These MUST match the live orgs so re-running main() is
# idempotent and never spawns duplicate persona-owned demos.
# ──────────────────────────────────────────────────────────────────────────────
LUMA_ORG_ID      = uuid.UUID("353651d7-d9fa-4a95-b2d7-a2f771db7cc0")
DRIFT_ORG_ID     = uuid.UUID("a26d5acf-32fc-4cc7-b3bf-9e1cfbe39178")
BASECAMP_ORG_ID  = uuid.UUID("58b728a7-9fe7-40b9-b271-e7e35044918d")

HISTORY_DAYS = 180
TODAY = datetime.date.today()


# ══════════════════════════════════════════════════════════════════════════════
#  Deterministic sales-series generator
# ══════════════════════════════════════════════════════════════════════════════

def _distributed_units(avg_daily: float, days: int, offset: int = 0) -> List[int]:
    if avg_daily <= 0:
        return [0] * days
    values = []
    prev = math.floor(offset * avg_daily)
    for i in range(1, days + 1):
        cur = math.floor((offset + i) * avg_daily)
        values.append(max(0, cur - prev))
        prev = cur
    return values


def _sales_series(segments, sku_index: int) -> List[int]:
    series: List[int] = []
    offset = sku_index % 7
    for days, avg_daily in segments:
        series.extend(_distributed_units(avg_daily, days, offset=offset))
        offset += days
    return series[-HISTORY_DAYS:]


# ══════════════════════════════════════════════════════════════════════════════
#  Derived metrics (all computed from the same catalog entry)
# ══════════════════════════════════════════════════════════════════════════════

def _last_30_velocity(item: Dict) -> float:
    return round(sum(_sales_series(item["segments"], 0)[-30:]) / 30, 2)

def _last_90_velocity(item: Dict) -> float:
    return round(sum(_sales_series(item["segments"], 0)[-90:]) / 90, 2)

def _total_units_sold(item: Dict) -> int:
    return sum(_sales_series(item["segments"], 0))

def _total_revenue(item: Dict) -> float:
    return round(_total_units_sold(item) * item["selling_price"], 2)

def _days_of_supply(item: Dict) -> float:
    v = _last_30_velocity(item)
    return round(item["stock"] / v, 1) if v > 0 else 9999.0

def _last_sale_gap_days(item: Dict) -> int:
    series = _sales_series(item["segments"], 0)
    for idx in range(len(series) - 1, -1, -1):
        if series[idx] > 0:
            return len(series) - 1 - idx
    return HISTORY_DAYS

def _demand_trend_pct(item: Dict) -> float:
    """Percentage change in avg daily sales: last-30 vs prior-60."""
    s = _sales_series(item["segments"], 0)
    last30 = sum(s[-30:]) / 30
    prior60 = sum(s[-90:-30]) / 60
    if prior60 == 0:
        return 100.0 if last30 > 0 else 0.0
    return round((last30 - prior60) / prior60 * 100, 1)

def _inventory_value(catalog: List[Dict]) -> float:
    return round(sum(i["stock"] * i["unit_cost"] for i in catalog), 2)

def _gross_margin_pct(item: Dict) -> float:
    return round((1 - item["unit_cost"] / item["selling_price"]) * 100, 1)

def _inventory_turnover(item: Dict) -> float:
    sold = _total_units_sold(item)
    cogs = sold * item["unit_cost"]
    avg_inv_value = item["stock"] * item["unit_cost"]
    if avg_inv_value <= 0:
        return 0.0
    return round(cogs / avg_inv_value, 2)

def _fmt(val: float) -> str:
    return f"${val:,.0f}"

def _lookup(catalog: List[Dict], sku: str) -> Dict:
    return next(i for i in catalog if i["sku"] == sku)


# ══════════════════════════════════════════════════════════════════════════════
#  WORKSPACE 1 — LUMA & CO. (Growth Brand)
#
#  Story: Premium womenswear brand growing 40% YoY.  Three hero products are
#  selling so fast they will stock out before the next PO arrives.  Everything
#  else is healthy — strong margins, clean inventory, no dead stock.  The
#  founder's problem is *supply*, not demand.
# ══════════════════════════════════════════════════════════════════════════════

def _catalog_luma() -> List[Dict]:
    return [
        # ── Hero products (at stockout risk) ──
        {"sku": "LM-1001", "name": "Sculpted Blazer – Navy",           "category": "Outerwear",   "color": "Navy",        "size": "M",  "unit_cost": 82.0,  "selling_price": 228.0,  "stock": 18,   "lead_time": 16, "reorder_point": 45,  "supplier": "Atelier Tessuti (Milan)",    "segments": [(60, 1.8), (60, 2.4), (60, 3.2)], "age": 34},
        {"sku": "LM-1002", "name": "Silk Wrap Dress – Emerald",        "category": "Dresses",     "color": "Emerald",     "size": "S",  "unit_cost": 54.0,  "selling_price": 168.0,  "stock": 0,    "lead_time": 14, "reorder_point": 55,  "supplier": "Jiangsu Silk House",         "segments": [(60, 2.6), (60, 3.5), (60, 4.8)], "age": 28},
        {"sku": "LM-1003", "name": "Ribbed Merino Turtleneck – Ivory", "category": "Knitwear",    "color": "Ivory",       "size": "M",  "unit_cost": 38.0,  "selling_price": 112.0,  "stock": 12,   "lead_time": 18, "reorder_point": 50,  "supplier": "Atelier Tessuti (Milan)",    "segments": [(60, 2.0), (60, 2.6), (60, 3.4)], "age": 31},

        # ── Strong performers (healthy) ──
        {"sku": "LM-2001", "name": "Tailored Wide-Leg Trouser – Black","category": "Bottoms",     "color": "Black",       "size": "8",  "unit_cost": 44.0,  "selling_price": 138.0,  "stock": 185,  "lead_time": 14, "reorder_point": 40,  "supplier": "Jiangsu Silk House",         "segments": [(60, 2.2), (60, 2.4), (60, 2.6)], "age": 48},
        {"sku": "LM-2002", "name": "Cashmere Crew Sweater – Oatmeal",  "category": "Knitwear",    "color": "Oatmeal",     "size": "L",  "unit_cost": 52.0,  "selling_price": 148.0,  "stock": 210,  "lead_time": 16, "reorder_point": 42,  "supplier": "Atelier Tessuti (Milan)",    "segments": [(60, 1.8), (60, 2.0), (60, 2.2)], "age": 52},
        {"sku": "LM-2003", "name": "Linen Button-Down – White",        "category": "Tops",        "color": "White",       "size": "M",  "unit_cost": 26.0,  "selling_price": 88.0,   "stock": 240,  "lead_time": 10, "reorder_point": 55,  "supplier": "Viet Textile Co.",           "segments": [(60, 3.2), (60, 3.4), (60, 3.6)], "age": 40},
        {"sku": "LM-2004", "name": "A-Line Midi Skirt – Camel",        "category": "Dresses",     "color": "Camel",       "size": "6",  "unit_cost": 32.0,  "selling_price": 98.0,   "stock": 170,  "lead_time": 12, "reorder_point": 38,  "supplier": "Jiangsu Silk House",         "segments": [(60, 2.0), (60, 2.1), (60, 2.2)], "age": 45},
        {"sku": "LM-2005", "name": "Structured Trench Coat – Stone",   "category": "Outerwear",   "color": "Stone",       "size": "M",  "unit_cost": 95.0,  "selling_price": 268.0,  "stock": 130,  "lead_time": 20, "reorder_point": 30,  "supplier": "Atelier Tessuti (Milan)",    "segments": [(60, 1.2), (60, 1.4), (60, 1.5)], "age": 58},
        {"sku": "LM-2006", "name": "Seamless Sports Bra – Black",      "category": "Activewear",  "color": "Black",       "size": "S",  "unit_cost": 14.0,  "selling_price": 52.0,   "stock": 320,  "lead_time": 8,  "reorder_point": 70,  "supplier": "Viet Textile Co.",           "segments": [(60, 4.5), (60, 4.8), (60, 5.0)], "age": 36},
        {"sku": "LM-2007", "name": "High-Rise Sculpt Legging – Olive", "category": "Activewear",  "color": "Olive",       "size": "M",  "unit_cost": 18.0,  "selling_price": 64.0,   "stock": 280,  "lead_time": 10, "reorder_point": 62,  "supplier": "Viet Textile Co.",           "segments": [(60, 3.8), (60, 4.0), (60, 4.2)], "age": 38},
        {"sku": "LM-2008", "name": "Cropped Leather Jacket – Black",   "category": "Outerwear",   "color": "Black",       "size": "S",  "unit_cost": 120.0, "selling_price": 348.0,  "stock": 95,   "lead_time": 22, "reorder_point": 24,  "supplier": "Atelier Tessuti (Milan)",    "segments": [(60, 0.9), (60, 1.0), (60, 1.1)], "age": 62},
        {"sku": "LM-2009", "name": "Cotton Poplin Shirt Dress – Sky",  "category": "Dresses",     "color": "Sky Blue",    "size": "M",  "unit_cost": 30.0,  "selling_price": 92.0,   "stock": 200,  "lead_time": 12, "reorder_point": 44,  "supplier": "Viet Textile Co.",           "segments": [(60, 2.0), (60, 2.2), (60, 2.4)], "age": 42},
        {"sku": "LM-2010", "name": "Merino Wrap Cardigan – Burgundy",  "category": "Knitwear",    "color": "Burgundy",    "size": "L",  "unit_cost": 46.0,  "selling_price": 128.0,  "stock": 160,  "lead_time": 16, "reorder_point": 36,  "supplier": "Atelier Tessuti (Milan)",    "segments": [(60, 1.6), (60, 1.7), (60, 1.8)], "age": 50},
        {"sku": "LM-2011", "name": "Slim Ankle Pant – Charcoal",       "category": "Bottoms",     "color": "Charcoal",    "size": "10", "unit_cost": 36.0,  "selling_price": 108.0,  "stock": 195,  "lead_time": 12, "reorder_point": 46,  "supplier": "Jiangsu Silk House",         "segments": [(60, 2.4), (60, 2.6), (60, 2.8)], "age": 43},
        {"sku": "LM-2012", "name": "Relaxed Boyfriend Jean – Lt Wash", "category": "Bottoms",     "color": "Light Wash",  "size": "28", "unit_cost": 34.0,  "selling_price": 98.0,   "stock": 220,  "lead_time": 14, "reorder_point": 50,  "supplier": "Jiangsu Silk House",         "segments": [(60, 2.6), (60, 2.8), (60, 3.0)], "age": 41},
        {"sku": "LM-2013", "name": "V-Neck Silk Cami – Blush",         "category": "Tops",        "color": "Blush",       "size": "XS", "unit_cost": 22.0,  "selling_price": 68.0,   "stock": 260,  "lead_time": 10, "reorder_point": 58,  "supplier": "Jiangsu Silk House",         "segments": [(60, 3.6), (60, 3.8), (60, 4.0)], "age": 37},
        {"sku": "LM-2014", "name": "Performance Zip Hoodie – Heather", "category": "Activewear",  "color": "Heather Gray","size": "L",  "unit_cost": 28.0,  "selling_price": 82.0,   "stock": 250,  "lead_time": 10, "reorder_point": 55,  "supplier": "Viet Textile Co.",           "segments": [(60, 3.0), (60, 3.2), (60, 3.4)], "age": 39},
        {"sku": "LM-2015", "name": "Chunky Platform Sneaker – White",  "category": "Footwear",    "color": "White",       "size": "38", "unit_cost": 42.0,  "selling_price": 128.0,  "stock": 140,  "lead_time": 18, "reorder_point": 32,  "supplier": "Dongguan Sole Works",        "segments": [(60, 1.4), (60, 1.6), (60, 1.8)], "age": 46},
    ]


# ══════════════════════════════════════════════════════════════════════════════
#  WORKSPACE 2 — DRIFT COLLECTIVE (Cash-Flow Crisis)
#
#  Story: Streetwear brand that bet big on three limited-edition collab drops
#  that never sold.  Together they lock up ~$94k of working capital with zero
#  recent demand.  The core line (hoodies, tees, joggers) still sells well but
#  the founder can't fund purchase orders because cash is trapped in dead
#  inventory.  Monthly carrying costs are eating margin.
# ══════════════════════════════════════════════════════════════════════════════

def _catalog_drift() -> List[Dict]:
    return [
        # ── Dead-stock collab drops (no sales in 90+ days) ──
        {"sku": "DR-9001", "name": "Neon Moto Vest – Collab Drop A",    "category": "Outerwear",   "color": "Neon Yellow",  "size": "M",       "unit_cost": 48.0,  "selling_price": 110.0,  "stock": 720,  "lead_time": 30, "reorder_point": 80,  "supplier": "Pacific Denim Works",     "segments": [(30, 1.4), (30, 0.4), (120, 0.0)], "age": 205},
        {"sku": "DR-9002", "name": "Tie-Dye Cargo Short – Collab Drop B","category": "Bottoms",    "color": "Washed Multi", "size": "L",       "unit_cost": 36.0,  "selling_price": 82.0,   "stock": 580,  "lead_time": 30, "reorder_point": 65,  "supplier": "Pacific Denim Works",     "segments": [(40, 0.9), (20, 0.2), (120, 0.0)], "age": 192},
        {"sku": "DR-9003", "name": "Holographic Bucket Hat – Ltd Ed",    "category": "Accessories", "color": "Silver Holo",  "size": "One Size","unit_cost": 12.0,  "selling_price": 34.0,   "stock": 940,  "lead_time": 14, "reorder_point": 100, "supplier": "Riverside Accessories",   "segments": [(25, 0.6), (25, 0.1), (130, 0.0)], "age": 238},
        {"sku": "DR-9004", "name": "Oversized Puffer – Collab Drop A",   "category": "Outerwear",   "color": "Acid Lime",    "size": "XL",      "unit_cost": 62.0,  "selling_price": 145.0,  "stock": 410,  "lead_time": 30, "reorder_point": 50,  "supplier": "Pacific Denim Works",     "segments": [(30, 0.8), (30, 0.2), (120, 0.0)], "age": 210},

        # ── Slow movers (declining demand) ──
        {"sku": "DR-5001", "name": "Corduroy Overshirt – Rust",          "category": "Outerwear",   "color": "Rust",         "size": "M",       "unit_cost": 28.0,  "selling_price": 78.0,   "stock": 340,  "lead_time": 18, "reorder_point": 45,  "supplier": "Standard Mills",          "segments": [(60, 1.6), (60, 0.9), (60, 0.4)], "age": 128},
        {"sku": "DR-5002", "name": "Vintage Denim Jacket – Med Wash",    "category": "Denim",       "color": "Medium Wash",  "size": "L",       "unit_cost": 42.0,  "selling_price": 118.0,  "stock": 280,  "lead_time": 24, "reorder_point": 35,  "supplier": "Pacific Denim Works",     "segments": [(60, 1.2), (60, 0.7), (60, 0.3)], "age": 134},

        # ── Core line (healthy, funding-constrained) ──
        {"sku": "DR-1001", "name": "Boxy Heavyweight Tee – Washed Blk",  "category": "Tops",        "color": "Washed Black", "size": "M",       "unit_cost": 11.0,  "selling_price": 38.0,   "stock": 420,  "lead_time": 12, "reorder_point": 95,  "supplier": "Standard Mills",          "segments": [(60, 4.8), (60, 5.2), (60, 5.8)], "age": 46},
        {"sku": "DR-1002", "name": "Oversized Fleece Hoodie – Charcoal", "category": "Outerwear",   "color": "Charcoal",     "size": "L",       "unit_cost": 24.0,  "selling_price": 72.0,   "stock": 290,  "lead_time": 16, "reorder_point": 60,  "supplier": "Standard Mills",          "segments": [(60, 3.4), (60, 3.6), (60, 3.9)], "age": 52},
        {"sku": "DR-1003", "name": "Cargo Jogger Pant – Khaki",          "category": "Bottoms",     "color": "Khaki",        "size": "L",       "unit_cost": 20.0,  "selling_price": 62.0,   "stock": 310,  "lead_time": 14, "reorder_point": 65,  "supplier": "Standard Mills",          "segments": [(60, 2.8), (60, 3.0), (60, 3.2)], "age": 58},
        {"sku": "DR-1004", "name": "Tapered Stretch Chino – Olive",      "category": "Bottoms",     "color": "Olive",        "size": "32",      "unit_cost": 18.0,  "selling_price": 54.0,   "stock": 350,  "lead_time": 14, "reorder_point": 72,  "supplier": "Standard Mills",          "segments": [(60, 3.6), (60, 3.8), (60, 4.0)], "age": 55},
        {"sku": "DR-1005", "name": "Relaxed Twill Short – Black",        "category": "Bottoms",     "color": "Black",        "size": "M",       "unit_cost": 15.0,  "selling_price": 46.0,   "stock": 300,  "lead_time": 12, "reorder_point": 60,  "supplier": "Standard Mills",          "segments": [(60, 2.4), (60, 2.6), (60, 2.8)], "age": 62},
        {"sku": "DR-1006", "name": "Ribbed Beanie – Mustard",            "category": "Accessories", "color": "Mustard",      "size": "One Size","unit_cost": 6.0,   "selling_price": 22.0,   "stock": 400,  "lead_time": 10, "reorder_point": 80,  "supplier": "Riverside Accessories",   "segments": [(60, 3.8), (60, 4.0), (60, 4.4)], "age": 64},
        {"sku": "DR-1007", "name": "Canvas Crossbody Bag – Tan",         "category": "Accessories", "color": "Tan",          "size": "One Size","unit_cost": 14.0,  "selling_price": 42.0,   "stock": 260,  "lead_time": 14, "reorder_point": 50,  "supplier": "Riverside Accessories",   "segments": [(60, 2.2), (60, 2.4), (60, 2.6)], "age": 70},
        {"sku": "DR-1008", "name": "Fleece Zip Jacket – Forest",         "category": "Outerwear",   "color": "Forest Green", "size": "L",       "unit_cost": 30.0,  "selling_price": 86.0,   "stock": 240,  "lead_time": 16, "reorder_point": 48,  "supplier": "Standard Mills",          "segments": [(60, 2.0), (60, 2.2), (60, 2.4)], "age": 67},
        {"sku": "DR-1009", "name": "Graphic Logo Tee – Off White",       "category": "Tops",        "color": "Off White",    "size": "S",       "unit_cost": 9.0,   "selling_price": 32.0,   "stock": 480,  "lead_time": 10, "reorder_point": 100, "supplier": "Standard Mills",          "segments": [(60, 5.0), (60, 5.4), (60, 5.8)], "age": 42},
    ]


# ══════════════════════════════════════════════════════════════════════════════
#  WORKSPACE 3 — BASECAMP BASICS (Seasonal Transition)
#
#  Story: Unisex essentials brand caught between seasons.  Summer basics (tees,
#  shorts, tanks) are selling faster than expected — three will stock out.
#  Winter carry-over (thermals, fleece, wool beanies) have no demand and are
#  becoming dead stock.  The founder needs to fund summer replenishment while
#  clearing winter inventory.
# ══════════════════════════════════════════════════════════════════════════════

def _catalog_basecamp() -> List[Dict]:
    return [
        # ── Summer heroes (stockout risk — demand outpacing supply) ──
        {"sku": "BC-S001", "name": "Everyday Heavyweight Tee – White",   "category": "Tops",        "color": "White",        "size": "L",       "unit_cost": 7.0,   "selling_price": 24.0,   "stock": 35,   "lead_time": 14, "reorder_point": 90,  "supplier": "CoreKnit Bangladesh",  "segments": [(60, 6.0), (60, 10.0), (60, 16.0)], "age": 20},
        {"sku": "BC-S002", "name": "Everyday Heavyweight Tee – Black",   "category": "Tops",        "color": "Black",        "size": "M",       "unit_cost": 7.0,   "selling_price": 24.0,   "stock": 22,   "lead_time": 18, "reorder_point": 85,  "supplier": "CoreKnit Bangladesh",  "segments": [(60, 5.0), (60, 9.0), (60, 14.0)], "age": 18},
        {"sku": "BC-S003", "name": "French Terry Short – Navy",          "category": "Bottoms",     "color": "Navy",         "size": "M",       "unit_cost": 10.0,  "selling_price": 32.0,   "stock": 0,    "lead_time": 14, "reorder_point": 75,  "supplier": "CoreKnit Bangladesh",  "segments": [(60, 4.0), (60, 8.0), (60, 13.0)], "age": 16},

        # ── Summer steady (healthy) ──
        {"sku": "BC-S004", "name": "Ribbed Tank Top – White",            "category": "Tops",        "color": "White",        "size": "S",       "unit_cost": 5.0,   "selling_price": 18.0,   "stock": 280,  "lead_time": 10, "reorder_point": 70,  "supplier": "CoreKnit Bangladesh",  "segments": [(60, 4.0), (60, 5.5), (60, 7.0)], "age": 28},
        {"sku": "BC-S005", "name": "Cotton Ankle Socks 3-Pack – White",  "category": "Accessories", "color": "White",        "size": "One Size","unit_cost": 3.5,   "selling_price": 14.0,   "stock": 600,  "lead_time": 8,  "reorder_point": 120, "supplier": "CoreKnit Bangladesh",  "segments": [(60, 6.0), (60, 7.5), (60, 9.0)], "age": 24},
        {"sku": "BC-S006", "name": "Relaxed Fit Jogger – Black",         "category": "Bottoms",     "color": "Black",        "size": "L",       "unit_cost": 13.0,  "selling_price": 38.0,   "stock": 350,  "lead_time": 12, "reorder_point": 65,  "supplier": "Lima Fleece Co.",       "segments": [(60, 3.5), (60, 4.5), (60, 5.5)], "age": 32},
        {"sku": "BC-S007", "name": "Oversized Pocket Tee – Olive",       "category": "Tops",        "color": "Olive",        "size": "M",       "unit_cost": 8.0,   "selling_price": 26.0,   "stock": 320,  "lead_time": 10, "reorder_point": 75,  "supplier": "CoreKnit Bangladesh",  "segments": [(60, 3.5), (60, 5.0), (60, 6.5)], "age": 26},
        {"sku": "BC-S008", "name": "Lightweight Everyday Short – Khaki", "category": "Bottoms",     "color": "Khaki",        "size": "M",       "unit_cost": 9.0,   "selling_price": 28.0,   "stock": 290,  "lead_time": 10, "reorder_point": 60,  "supplier": "CoreKnit Bangladesh",  "segments": [(60, 3.0), (60, 4.0), (60, 5.0)], "age": 30},

        # ── Winter carryover (dead stock — zero recent demand) ──
        {"sku": "BC-W001", "name": "Thermal Base Layer Top – Charcoal",  "category": "Tops",        "color": "Charcoal",     "size": "M",       "unit_cost": 12.0,  "selling_price": 34.0,   "stock": 520,  "lead_time": 14, "reorder_point": 55,  "supplier": "CoreKnit Bangladesh",  "segments": [(60, 3.5), (30, 0.8), (90, 0.0)], "age": 142},
        {"sku": "BC-W002", "name": "Heavyweight Fleece Hoodie – Gray",   "category": "Outerwear",   "color": "Heather Gray", "size": "L",       "unit_cost": 18.0,  "selling_price": 52.0,   "stock": 440,  "lead_time": 16, "reorder_point": 60,  "supplier": "Lima Fleece Co.",       "segments": [(60, 2.8), (30, 0.5), (90, 0.0)], "age": 156},
        {"sku": "BC-W003", "name": "Wool Blend Beanie – Black",          "category": "Accessories", "color": "Black",        "size": "One Size","unit_cost": 6.0,   "selling_price": 18.0,   "stock": 680,  "lead_time": 10, "reorder_point": 80,  "supplier": "Lima Fleece Co.",       "segments": [(60, 4.0), (30, 0.4), (90, 0.0)], "age": 168},
        {"sku": "BC-W004", "name": "Fleece-Lined Jogger – Navy",         "category": "Bottoms",     "color": "Navy",         "size": "L",       "unit_cost": 16.0,  "selling_price": 44.0,   "stock": 380,  "lead_time": 14, "reorder_point": 50,  "supplier": "Lima Fleece Co.",       "segments": [(60, 2.4), (30, 0.3), (90, 0.0)], "age": 148},
        {"sku": "BC-W005", "name": "Quilted Vest – Olive",               "category": "Outerwear",   "color": "Olive",        "size": "M",       "unit_cost": 22.0,  "selling_price": 58.0,   "stock": 310,  "lead_time": 18, "reorder_point": 40,  "supplier": "Lima Fleece Co.",       "segments": [(60, 1.6), (30, 0.2), (90, 0.0)], "age": 162},

        # ── Year-round basics (stable) ──
        {"sku": "BC-Y001", "name": "Waffle Knit Henley – Oatmeal",       "category": "Tops",        "color": "Oatmeal",      "size": "L",       "unit_cost": 10.0,  "selling_price": 30.0,   "stock": 240,  "lead_time": 12, "reorder_point": 50,  "supplier": "CoreKnit Bangladesh",  "segments": [(60, 2.5), (60, 2.8), (60, 3.0)], "age": 44},
        {"sku": "BC-Y002", "name": "Zip-Up Hoodie – Charcoal",           "category": "Outerwear",   "color": "Charcoal",     "size": "XL",      "unit_cost": 16.0,  "selling_price": 46.0,   "stock": 260,  "lead_time": 14, "reorder_point": 55,  "supplier": "Lima Fleece Co.",       "segments": [(60, 2.8), (60, 3.0), (60, 3.2)], "age": 48},
    ]


# ══════════════════════════════════════════════════════════════════════════════
#  DataFrame builders
# ══════════════════════════════════════════════════════════════════════════════

def _build_frames(catalog: List[Dict]) -> tuple:
    products, costs, sales = [], [], []
    start_date = TODAY - datetime.timedelta(days=HISTORY_DAYS - 1)

    for idx, item in enumerate(catalog):
        products.append({"sku": item["sku"], "name": item["name"], "category": item["category"], "color": item["color"], "size": item["size"], "stock_on_hand": item["stock"], "lead_time_days": item["lead_time"], "reorder_point": item["reorder_point"]})
        costs.append({"sku": item["sku"], "unit_cost": item["unit_cost"], "selling_price": item["selling_price"], "supplier_name": item["supplier"]})
        for day, qty in enumerate(_sales_series(item["segments"], idx)):
            sale_date = start_date + datetime.timedelta(days=day)
            sales.append({"sku": item["sku"], "date": sale_date.strftime("%Y-%m-%d"), "quantity": qty, "unit_price": item["selling_price"], "revenue": round(qty * item["selling_price"], 2)})

    return pd.DataFrame(products), pd.DataFrame(costs), pd.DataFrame(sales)


# ══════════════════════════════════════════════════════════════════════════════
#  Executive-grade recommendation traces
# ══════════════════════════════════════════════════════════════════════════════

def _trace(org_id, item, rec_type, action, confidence, priority, recommended_action, expected_outcome, risk_if_ignored, business_impact, financial_impact):
    """Build one recommendation trace — all numbers derived from the same catalog entry."""
    velocity_30 = _last_30_velocity(item)
    velocity_90 = _last_90_velocity(item)
    dos = _days_of_supply(item)
    gap = max(0.0, item["lead_time"] - (0 if dos >= 9999 else dos))
    lost_rev = round(gap * velocity_30 * item["selling_price"], 2)
    capital = round(item["stock"] * item["unit_cost"], 2)
    margin = _gross_margin_pct(item)
    turnover = _inventory_turnover(item)
    trend = _demand_trend_pct(item)
    total_sold = _total_units_sold(item)
    total_rev = _total_revenue(item)

    # Observation — business facts only
    obs = {
        "product": item["name"],
        "sku": item["sku"],
        "category": item["category"],
        "current_stock": f"{item['stock']:,} units",
        "selling_price": f"${item['selling_price']:.2f}",
        "unit_cost": f"${item['unit_cost']:.2f}",
        "gross_margin": f"{margin}%",
    }

    if rec_type in ("dead_stock", "markdown"):
        gap_days = _last_sale_gap_days(item)
        obs.update({
            "days_without_sale": f"{gap_days} days",
            "inventory_age": f"{item['age']} days",
            "capital_locked": _fmt(capital),
            "monthly_carrying_cost": _fmt(capital * 0.03),
            "inventory_turnover": f"{turnover}x",
            "demand_trend": f"{trend:+.0f}% over 90 days",
        })
        chain = [
            f"{item['name']} ({item['sku']}) has had zero sales for {gap_days} days.",
            f"There are {item['stock']:,} units on hand at ${item['unit_cost']:.2f} landed cost, locking {_fmt(capital)} of working capital.",
            f"Inventory age is {item['age']} days. Turnover rate is {turnover}x — well below the 2.0x healthy threshold for this category.",
            f"At 3% monthly carrying cost, the business is paying approximately {_fmt(capital * 0.03)} per month to hold this inventory.",
            f"Without intervention, this capital will remain trapped and the product will likely require a full write-down within 90 days.",
        ]
        rules = [
            f"Products with zero sales for 30+ days and inventory turnover below 0.5x are flagged for recovery action.",
            f"Carrying cost is estimated at 3% of locked capital per month (industry standard for 3PL fulfillment).",
        ]
        calcs = [
            f"Capital locked = {item['stock']:,} units × ${item['unit_cost']:.2f} = {_fmt(capital)}",
            f"Monthly carrying cost = {_fmt(capital)} × 3% = {_fmt(capital * 0.03)}",
            f"Inventory turnover = {total_sold:,} units sold ÷ {item['stock']:,} units on hand = {turnover}x",
        ]
        impact = capital
    else:
        obs.update({
            "avg_daily_sales": f"{velocity_30:.1f} units/day",
            "days_of_stock_remaining": "OUT OF STOCK" if item["stock"] == 0 else f"{dos:.0f} days",
            "supplier_lead_time": f"{item['lead_time']} days",
            "replenishment_gap": f"{gap:.0f} days short",
            "demand_trend": f"{trend:+.0f}% over 90 days",
            "180-day_revenue": _fmt(total_rev),
        })
        chain = [
            f"{item['name']} ({item['sku']}) is selling {velocity_30:.1f} units per day based on the trailing 30-day average.",
            f"Current stock is {item['stock']:,} units, providing {'zero' if item['stock'] == 0 else f'{dos:.0f} days of'} coverage.",
            f"Supplier lead time is {item['lead_time']} days, creating a projected {gap:.0f}-day availability gap before replenishment arrives.",
            f"At ${item['selling_price']:.2f} retail, this gap puts approximately {_fmt(lost_rev)} of revenue at risk.",
            f"Demand has {'increased' if trend > 0 else 'decreased'} {abs(trend):.0f}% over the last 90 days, {'accelerating' if trend > 0 else 'reducing'} the urgency.",
        ]
        rules = [
            f"Reorder is triggered when projected days-of-supply falls below supplier lead time plus 5-day safety buffer.",
            f"Revenue at risk is calculated as: gap days × daily sales velocity × retail price.",
        ]
        calcs = [
            f"Days of supply = {item['stock']:,} units ÷ {velocity_30:.1f} units/day = {'0' if item['stock'] == 0 else f'{dos:.0f}'} days",
            f"Stockout gap = {item['lead_time']} day lead time − {'0' if item['stock'] == 0 else f'{dos:.0f}'} days coverage = {gap:.0f} days",
            f"Revenue at risk = {gap:.0f} days × {velocity_30:.1f} units/day × ${item['selling_price']:.2f} = {_fmt(lost_rev)}",
        ]
        impact = lost_rev

    snapshot = {
        "observation": obs,
        "business_impact": business_impact,
        "financial_impact": financial_impact,
        "recommended_action": recommended_action,
        "expected_outcome": expected_outcome,
        "risk_if_ignored": risk_if_ignored,
    }

    return {
        "sku": item["sku"], "name": item["name"], "type": rec_type,
        "action": action, "confidence": confidence, "priority": priority,
        "impact": impact, "obs": obs, "chain": chain, "rules": rules,
        "calcs": calcs, "snapshot": snapshot,
    }


def _traces_luma(org_id) -> List[Dict]:
    c = _catalog_luma()
    return [
        _trace(org_id, _lookup(c, "LM-1002"), "low_stock",
               "Emergency replenishment for Silk Wrap Dress – Emerald", 0.97, "Critical",
               "Place an emergency air-freight order for 200 units of LM-1002 immediately. Enable backorders with a 10-day delivery promise to capture demand during the gap.",
               "Restore availability on the fastest-growing SKU in the catalog. Projected to recover $11,400 in otherwise-lost revenue during the restocking window.",
               "Every day of stockout costs approximately $806 in missed revenue. A two-week gap would result in $11,300+ of unrecoverable lost sales and potential customer churn.",
               "The Silk Wrap Dress is Luma's top-growth product — demand has increased 85% in 90 days. It is currently out of stock with a 14-day lead time.",
               "Estimated revenue at risk: $11,300. Air freight premium is approximately $1,200, yielding a 9.4x return on expedited shipping cost."),

        _trace(org_id, _lookup(c, "LM-1001"), "low_stock",
               "Accelerate reorder for Sculpted Blazer – Navy", 0.96, "High",
               "Place a purchase order for 150 units of LM-1001 this week. Current stock covers only 5.6 days against a 16-day supplier lead time.",
               "Maintain availability on a high-margin hero product ($228 retail, 64% gross margin) and prevent a 10-day stockout window.",
               "Without reorder, the blazer stocks out in ~6 days. At 3.2 units/day and $228 retail, that gap risks approximately $7,600 in revenue.",
               "The Sculpted Blazer has only 18 units remaining and is selling 3.2 units per day — well above the reorder threshold. Lead time is 16 days.",
               "Revenue at risk: approximately $7,600. This is Luma's highest-margin outerwear product."),

        _trace(org_id, _lookup(c, "LM-1003"), "low_stock",
               "Increase safety stock for Ribbed Merino Turtleneck – Ivory", 0.95, "High",
               "Order 180 units of LM-1003 and raise the reorder point from 50 to 65 units to reflect accelerating demand.",
               "Avoid a projected 14-day stockout and capture $5,400 in revenue that would otherwise be lost.",
               "Current stock covers 3.5 days against an 18-day lead time. Demand is trending up 31% — the existing reorder point is too low for the new run rate.",
               "The Merino Turtleneck has 12 units left, selling at 3.4 units/day with an 18-day replenishment cycle. The reorder point needs to reflect the new demand curve.",
               "Revenue at risk: approximately $5,400. Raising the reorder point also prevents recurrence next cycle."),

        _trace(org_id, _lookup(c, "LM-2005"), "optimization",
               "Optimize trench coat reorder cadence to reduce holding cost", 0.91, "Medium",
               "Shift the Structured Trench Coat to a 90-unit batch order triggered at 25 units remaining, down from the current 30-unit reorder point.",
               "Free approximately $4,750 in working capital currently tied up in buffer stock while maintaining 16+ days of coverage.",
               "No immediate risk — this is an efficiency optimization. Current stock is healthy at 130 units with stable demand.",
               "The trench coat carries 130 units at $95 cost ($12,350 in inventory value) against a stable 1.5 units/day demand. The reorder point is higher than necessary.",
               "Working capital freed: approximately $4,750. No impact on fulfillment rates."),
    ]


def _traces_drift(org_id) -> List[Dict]:
    c = _catalog_drift()
    return [
        _trace(org_id, _lookup(c, "DR-9001"), "dead_stock",
               "Launch 45% markdown on Neon Moto Vest to recover capital", 0.98, "Critical",
               "Mark down DR-9001 by 45% to $60.50 and feature it in a 14-day flash clearance campaign. If sell-through is below 20% after two weeks, route remaining units to an off-price liquidator at ~$22/unit.",
               "Recover approximately $19,800–$34,560 in cash depending on the markdown sell-through rate, and free premium warehouse space.",
               "Without action, the 720 units will require a full $34,560 write-down within 90 days. Monthly carrying cost is $1,037.",
               "The Neon Moto Vest was a limited-edition collaboration that failed to find an audience. 720 units have been sitting for 205 days with zero sales since the first 60 days after launch.",
               "Capital locked: $34,560. Monthly carrying cost: $1,037. Every month of inaction reduces recovery value by approximately 8%."),

        _trace(org_id, _lookup(c, "DR-9002"), "dead_stock",
               "Bundle DR-9002 with active Cargo Joggers at 35% discount", 0.96, "High",
               "Create a 'Summer Pack' bundle pairing the Tie-Dye Cargo Short with the Cargo Jogger (DR-1003) at a combined $93.60 (35% off retail). Run the promotion for 30 days.",
               "Convert a zero-velocity SKU into attach-rate revenue. Target: clear 200+ units while boosting core jogger sales through bundling.",
               "Standalone markdowns have limited appeal for tie-dye — bundling with a popular core product gives the dead SKU a path to the customer.",
               "580 units of Tie-Dye Cargo Shorts have had zero sales for 192 days. The core Cargo Jogger sells 3.2 units/day and can carry the dead SKU as a bundle.",
               "Capital locked: $20,880. Expected recovery through bundling: $9,400–$14,000 depending on bundle take-rate."),

        _trace(org_id, _lookup(c, "DR-9003"), "dead_stock",
               "Liquidate Holographic Bucket Hat through off-price channel", 0.97, "High",
               "Accept a bulk off-price offer at $8.50/unit for all 940 units. Remove from warehouse within 10 business days.",
               "Recover approximately $7,990 in immediate cash and free warehouse capacity for incoming core-line replenishment.",
               "The hat has been unsold for 238 days. At $12 cost and $34 retail, no DTC markdown will move 940 units. Liquidation is the only realistic recovery path.",
               "940 Holographic Bucket Hats have been unsold for 238 days. Inventory turnover is 0.04x. This is the oldest dead-stock position in the warehouse.",
               "Capital locked: $11,280. Liquidation recovers $7,990 (71%). Holding to write-down recovers $0."),

        _trace(org_id, _lookup(c, "DR-9004"), "dead_stock",
               "Route Oversized Puffer to outlet channel with 50% markdown", 0.95, "High",
               "List DR-9004 on the outlet storefront at $72.50 (50% off) and offer an additional 10% to wholesale partners clearing seasonal outerwear.",
               "Target clearing 250+ units in 45 days, recovering approximately $18,125 against the $25,420 capital position.",
               "The puffer was an Acid Lime colorway bet that did not sell. At $62 cost per unit, the 410-unit position is the largest single capital trap in the dead stock portfolio.",
               "410 Oversized Puffers in Acid Lime have been unsold for 210 days. The seasonal window for puffer sales has passed — this colorway has no organic demand path.",
               "Capital locked: $25,420. Monthly carrying cost: $763. This single SKU represents 27% of Drift's total dead-stock capital."),

        _trace(org_id, _lookup(c, "DR-5001"), "markdown",
               "Mark down Corduroy Overshirt 25% and pause replenishment", 0.92, "Medium",
               "Reduce selling price to $58.50 and halt all purchase orders until stock falls below 80 units.",
               "Prevent the overshirt from becoming full dead stock. At 0.4 units/day, current stock covers 850 days — far beyond the product lifecycle.",
               "Demand has declined 69% over 90 days. Without a markdown, this SKU will join the dead-stock portfolio within 60 days.",
               "The Corduroy Overshirt was a seasonal bestseller that peaked 4 months ago. Sales velocity has fallen from 1.6 to 0.4 units/day, and 340 units remain.",
               "Capital at risk: $9,520. A 25% markdown now preserves more value than waiting for full dead-stock liquidation later."),
    ]


def _traces_basecamp(org_id) -> List[Dict]:
    c = _catalog_basecamp()
    return [
        _trace(org_id, _lookup(c, "BC-S003"), "low_stock",
               "Emergency replenishment for French Terry Short – Navy", 0.98, "Critical",
               "Air-freight 400 units of BC-S003 immediately. Enable backorders on the website with a 'Ships in 7 days' promise. Begin pre-selling.",
               "Restore availability on a product selling 13 units/day. Capture $5,800+ in revenue that would otherwise be lost during the 14-day lead time.",
               "The French Terry Short is already out of stock. Every day without stock costs approximately $416 in lost revenue. Two weeks of stockout = $5,800+ unrecoverable.",
               "BC-S003 is completely out of stock while demand is at its seasonal peak: 13 units per day, up 63% over 90 days. This is the #1 revenue-at-risk product.",
               "Revenue at risk: $5,824 over the lead time. Air freight premium (~$600) yields a 9.7x return on expedited cost."),

        _trace(org_id, _lookup(c, "BC-S001"), "low_stock",
               "Accelerate reorder for Everyday Heavyweight Tee – White", 0.97, "Critical",
               "Place a purchase order for 500 units of BC-S001 this week. Current stock covers only 2.2 days against a 14-day lead time. Consider dual-sourcing from a domestic supplier for partial air-freight.",
               "Prevent a stockout on the highest-volume SKU in the catalog. Protect $4,500+ in at-risk revenue during the replenishment window.",
               "35 units at 16 units/day means stock runs out in ~2 days. The 14-day lead time creates a 12-day gap at $384/day in lost sales.",
               "The White Heavyweight Tee is selling 16 units per day — up 167% over 90 days. Only 35 units remain. This is the fastest-moving product in the catalog.",
               "Revenue at risk: $4,608. This is Basecamp's signature product — a stockout damages both revenue and brand credibility."),

        _trace(org_id, _lookup(c, "BC-S002"), "low_stock",
               "Dual-source Black Heavyweight Tee to close lead-time gap", 0.96, "High",
               "Place a split order: 300 units from the primary supplier (CoreKnit, 18-day lead time) and 150 units from the domestic backup supplier (8-day lead time) at a $1.50/unit premium.",
               "Shorten the stockout window from 16 days to 6 days, saving approximately $2,700 in otherwise-lost revenue.",
               "22 units at 14 units/day = 1.6 days of stock. The 18-day lead time creates the longest gap in the portfolio. Without dual-sourcing, the black tee is offline for over two weeks.",
               "The Black Heavyweight Tee has 22 units left, selling 14 per day. Primary supplier is 18 days away. This is the second-highest revenue-at-risk position in the workspace.",
               "Revenue at risk: $5,376 if single-sourced. Dual-sourcing reduces this to approximately $2,016 — saving $3,360 net of the $225 premium."),

        _trace(org_id, _lookup(c, "BC-W001"), "dead_stock",
               "Mark down Thermal Base Layer 40% for summer clearance", 0.96, "High",
               "Reduce BC-W001 to $20.40 (40% off) and feature in a 'Summer Sale: Winter Clearance' campaign for 21 days.",
               "Clear 150+ units and recover approximately $3,060 in cash. Remaining units can be held for the next winter season at minimal incremental cost.",
               "520 thermal tops at $12 cost = $6,240 locked. Zero sales for 90+ days. Carrying cost is $187/month. The product has seasonal value but not until October.",
               "Thermal Base Layer has had zero demand since spring. 520 units are occupying warehouse space needed for incoming summer replenishment.",
               "Capital locked: $6,240. If cleared now via markdown, expected recovery is $3,060–$4,080. If held to winter, full recovery is possible but cash is trapped for 4+ months."),

        _trace(org_id, _lookup(c, "BC-W002"), "dead_stock",
               "Route Heavyweight Fleece Hoodie to outlet at 45% discount", 0.95, "High",
               "Move BC-W002 to the outlet channel at $28.60 (45% off). If sell-through is below 15% after 14 days, offer the remainder to a wholesale partner.",
               "Recover approximately $5,720–$7,920 against $7,920 in locked capital. Free warehouse space for summer inventory.",
               "440 fleece hoodies have been unsold for 90+ days. Carrying cost is $238/month. Summer demand for heavyweight fleece is negligible.",
               "The Heavyweight Fleece Hoodie was a strong winter seller but demand fell to zero as temperatures rose. 440 units remain at $18 cost each.",
               "Capital locked: $7,920. Monthly carrying cost: $238. This is the second-largest dead-stock position after the Thermal Base Layer by unit count."),

        _trace(org_id, _lookup(c, "BC-W003"), "dead_stock",
               "Liquidate Wool Blend Beanie through B2B off-price channel", 0.94, "Medium",
               "Accept a $3.60/unit bulk offer from an off-price buyer for all 680 beanies. Ship within 5 business days.",
               "Recover $2,448 immediately (60% of cost) and eliminate the carrying cost entirely. The beanie has no summer demand path.",
               "680 beanies have been unsold for 168 days. They are the oldest seasonal carryover in the warehouse. Any further delay risks a full write-down.",
               "680 Wool Blend Beanies have been sitting since winter with zero sales. At $6 cost, the absolute dollar amount is small but they occupy disproportionate bin space.",
               "Capital locked: $4,080. Liquidation at $3.60/unit recovers $2,448 (60%). Holding risks a $4,080 write-down in 90 days."),
    ]


# ══════════════════════════════════════════════════════════════════════════════
#  Document, chat seed, and executive insights
# ══════════════════════════════════════════════════════════════════════════════

def _exec_copy(scenario: str, catalog: List[Dict]):
    inv = _inventory_value(catalog)

    if scenario == "luma":
        hero_skus = [i for i in catalog if i["sku"] in ("LM-1001", "LM-1002", "LM-1003")]
        risk = sum(max(0, i["lead_time"] - (_days_of_supply(i) if _days_of_supply(i) < 9999 else 0)) * _last_30_velocity(i) * i["selling_price"] for i in hero_skus)
        summary = f"Luma & Co. is a healthy growth brand with {_fmt(inv)} in inventory across {len(catalog)} SKUs. Revenue is strong and margins average 62%. The primary risk is supply: three hero products are selling faster than forecasted and will stock out before replenishment arrives, putting approximately {_fmt(risk)} of revenue at risk."
        question = "What are our biggest risks right now and what should I do about them?"
        answer = f"Your biggest risk is supply, not demand. Three products — the Silk Wrap Dress, Sculpted Blazer, and Merino Turtleneck — are at stockout risk. The Wrap Dress is already out of stock. Together they represent approximately {_fmt(risk)} in at-risk revenue. I recommend emergency air freight for the Wrap Dress, an accelerated PO for the Blazer, and raising the Turtleneck's reorder point to match its new demand curve. Everything else in the portfolio is healthy."
        insights = {
            "summary": summary,
            "risks": [{"description": f"Three hero products at stockout risk. {_fmt(risk)} of revenue at risk.", "impact_level": "high"}],
            "opportunities": [{"description": "Demand growth is accelerating — raise reorder points across hero SKUs to prevent recurrence.", "value_potential": round(risk * 1.2, 2)}],
            "recommendations": ["Emergency replenish LM-1002 (out of stock).", "Accelerate PO for LM-1001 (5 days of stock).", "Raise reorder point for LM-1003."],
        }
        return "q3_growth_supply_review.pdf", question, answer, insights

    if scenario == "drift":
        dead = [i for i in catalog if i["sku"].startswith("DR-9")]
        locked = sum(i["stock"] * i["unit_cost"] for i in dead)
        carrying = round(locked * 0.03, 0)
        summary = f"Drift Collective has a cash-flow crisis. Four failed collab drops are holding {_fmt(locked)} in dead inventory — 52% of the total {_fmt(inv)} inventory base. The core streetwear line is still selling well, but the business cannot fund purchase orders because capital is trapped. Monthly carrying cost on dead stock alone is {_fmt(carrying)}."
        question = "Why can't we fund our next purchase order and what should we do?"
        answer = f"Your cash is trapped in four dead-stock SKUs from the collab drops: the Neon Moto Vest, Tie-Dye Cargo Short, Holographic Bucket Hat, and Oversized Puffer. Together they hold {_fmt(locked)} in capital with zero recent demand. I recommend a three-track recovery: markdown the vest at 45%, bundle the shorts with active joggers, and liquidate the bucket hat through off-price. The puffer should go to outlet at 50% off. Expected cash recovery across all four is $55,000–$70,000 within 45 days."
        insights = {
            "summary": summary,
            "risks": [{"description": f"Four dead-stock SKUs locking {_fmt(locked)} of working capital with {_fmt(carrying)}/month carrying cost.", "impact_level": "critical"}],
            "opportunities": [{"description": "Markdown, bundle, and liquidation can recover 60-75% of locked capital within 45 days.", "value_potential": round(locked * 0.65, 2)}],
            "recommendations": ["45% markdown on DR-9001.", "Bundle DR-9002 with DR-1003.", "Liquidate DR-9003 off-price.", "Route DR-9004 to outlet."],
        }
        return "dead_stock_recovery_plan.pdf", question, answer, insights

    # Basecamp
    summer = [i for i in catalog if i["sku"].startswith("BC-S0") and i["sku"] in ("BC-S001", "BC-S002", "BC-S003")]
    winter = [i for i in catalog if i["sku"].startswith("BC-W")]
    summer_risk = sum(max(0, i["lead_time"] - (_days_of_supply(i) if _days_of_supply(i) < 9999 else 0)) * _last_30_velocity(i) * i["selling_price"] for i in summer)
    winter_locked = sum(i["stock"] * i["unit_cost"] for i in winter)
    summary = f"Basecamp Basics is caught between seasons. Three summer products are at stockout risk with {_fmt(summer_risk)} of revenue at risk — one is already out of stock. Meanwhile, five winter carryover products hold {_fmt(winter_locked)} in dead capital with zero demand. Total inventory is {_fmt(inv)} across {len(catalog)} SKUs."
    question = "We're running out of summer stock and stuck with winter — what's the plan?"
    answer = f"You need to do two things simultaneously. First, emergency-replenish your three summer heroes: the French Terry Short is already out of stock, and the White and Black Tees have less than 2 days of coverage each. That's {_fmt(summer_risk)} at risk. Second, begin clearing winter: markdown the Thermal and Fleece Hoodie, and liquidate the Beanies through off-price. The winter clearance should generate enough cash to partially fund the summer air-freight orders."
    insights = {
        "summary": summary,
        "risks": [
            {"description": f"Three summer products at stockout risk: {_fmt(summer_risk)} revenue at risk.", "impact_level": "critical"},
            {"description": f"Five winter products are dead stock: {_fmt(winter_locked)} capital locked.", "impact_level": "high"},
        ],
        "opportunities": [{"description": "Winter clearance can fund summer replenishment — link the two actions to solve both problems.", "value_potential": round(winter_locked * 0.55, 2)}],
        "recommendations": ["Air freight BC-S003 (out of stock).", "Rush reorder BC-S001.", "Dual-source BC-S002.", "Mark down BC-W001 & BC-W002.", "Liquidate BC-W003."],
    }
    return "seasonal_transition_audit.pdf", question, answer, insights


# ══════════════════════════════════════════════════════════════════════════════
#  Database operations
# ══════════════════════════════════════════════════════════════════════════════

from sqlalchemy import text

def clean_org_data(db, org_id):
    # Bind the id as text. psycopg2 interpolates client-side, so Postgres sees an
    # untyped literal and coerces it to uuid exactly as before — but SQLite's
    # driver cannot bind a uuid.UUID at all, which made every caller of this
    # function impossible to cover in the in-memory test suite. This path is
    # destructive and now guards a merchant's real catalogue, so it needs tests.
    org_id = str(org_id)
    print(f"  Cleaning existing data for org {org_id}...")
    db.execute(text("DELETE FROM recommendation_traces WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM executive_messages WHERE conversation_id IN (SELECT id FROM executive_conversations WHERE organization_id = :oid)"), {"oid": org_id})
    db.execute(text("DELETE FROM executive_conversations WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM processed_documents WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM sales_records WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM inventory_items WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM products WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM revenues WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM expenses WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM projects WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM clients WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM suppliers WHERE organization_id = :oid"), {"oid": org_id})
    db.commit()


def seed_finance_and_clients(db, org_id, scenario):
    print(f"  Seeding finance and clients...")
    clients = []
    for i, name in enumerate(["Nordstrom Trunk Club", "Stitch Fix Partners", "Verishop", "Garmentory", "The Lobby", "Goop Select", "Need Supply"], 1):
        c = Client(organization_id=org_id, company_name=name, contact_person=f"Buyer {i}", email=f"buyer{i}@{name.lower().replace(' ', '')}.com", phone=f"+1234567890{i}", industry="D2C Apparel", status="active" if i < 6 else "inactive")
        db.add(c)
        clients.append(c)
    db.flush()

    pname = {"drift": "Dead Stock Recovery Program", "basecamp": "Seasonal Transition Plan"}.get(scenario, "Q3 Growth Acceleration")
    project = Project(organization_id=org_id, client_id=clients[0].id, name=pname, status="active", budget=120000.0, start_date=datetime.date(2026, 4, 1), deadline=datetime.date(2026, 9, 30))
    db.add(project)
    db.flush()

    if scenario == "drift":
        db.add_all([
            # COGS: off-price sales at near-cost recovery (deep discount on dead stock)
            Expense(organization_id=org_id, amount=15400.0, category="Cost of Goods Sold", description="COGS: off-price liquidation of collab inventory at 70% of cost basis", date=datetime.datetime.utcnow()),
            Expense(organization_id=org_id, amount=7200.0, category="Warehouse Storage", description="Monthly surcharge: overflow from aged collab inventory", date=datetime.datetime.utcnow()),
            Expense(organization_id=org_id, amount=4800.0, category="Clearance Media", description="Paid campaign budget for markdown and liquidation", date=datetime.datetime.utcnow()),
            Revenue(organization_id=org_id, project_id=project.id, amount=22000.0, date=datetime.datetime.utcnow(), description="Off-price channel recovery revenue"),
        ])
    elif scenario == "basecamp":
        db.add_all([
            # COGS: ~48% of revenue for an essentials brand
            Expense(organization_id=org_id, amount=25920.0, category="Cost of Goods Sold", description="COGS: summer essentials at 48% cost-to-revenue ratio", date=datetime.datetime.utcnow()),
            Expense(organization_id=org_id, amount=6500.0, category="Expedited Freight", description="Air freight premium for summer restocking", date=datetime.datetime.utcnow()),
            Expense(organization_id=org_id, amount=3200.0, category="Markdown Campaign", description="Summer sale creative and ad spend for winter clearance", date=datetime.datetime.utcnow()),
            Revenue(organization_id=org_id, project_id=project.id, amount=54000.0, date=datetime.datetime.utcnow(), description="Summer essentials peak-season revenue"),
        ])
    else:
        db.add_all([
            # COGS: ~38% of revenue for a premium womenswear brand (62% gross margin)
            Expense(organization_id=org_id, amount=37240.0, category="Cost of Goods Sold", description="COGS: premium womenswear at 38% cost-to-revenue ratio (62% gross margin)", date=datetime.datetime.utcnow()),
            Expense(organization_id=org_id, amount=1800.0, category="Platform & Tools", description="Shopify Plus, inventory tooling, and analytics subscriptions", date=datetime.datetime.utcnow()),
            Expense(organization_id=org_id, amount=3400.0, category="Inbound Freight", description="Standard replenishment freight from Milan and Jiangsu", date=datetime.datetime.utcnow()),
            Revenue(organization_id=org_id, project_id=project.id, amount=98000.0, date=datetime.datetime.utcnow(), description="DTC and wholesale revenue — growth quarter"),
        ])
    # Seed scenario-appropriate operational tasks
    # Completion rates: Luma 75% (executing well), Drift 37.5% (stalled), Basecamp 62.5% (in progress)
    _seed_tasks(db, org_id, project.id, scenario)
    db.commit()


def _seed_tasks(db, org_id, project_id, scenario):
    now = datetime.datetime.utcnow()
    if scenario == "luma":
        tasks = [
            ("Submit Q3 demand forecast to procurement team", "completed", "high"),
            ("Update safety stock thresholds for hero SKUs", "completed", "high"),
            ("Issue PO for Sculpted Blazer — 150 units (LM-1001)", "completed", "high"),
            ("Negotiate Q4 freight rates with logistics partner", "completed", "medium"),
            ("Conduct mid-quarter inventory audit across all 18 SKUs", "completed", "medium"),
            ("Update sell-through targets for Q3 hero products", "completed", "medium"),
            ("Initiate emergency air freight for Silk Wrap Dress LM-1002", "in_progress", "critical"),
            ("Raise reorder point for Merino Turtleneck to 65 units", "todo", "high"),
        ]
    elif scenario == "drift":
        tasks = [
            ("Complete dead stock audit — four collab SKUs identified", "completed", "high"),
            ("Warehouse cost analysis: $1,037/month carrying charge confirmed", "completed", "high"),
            ("Brief brand team on collab failure root causes", "completed", "medium"),
            ("Initiate 45% markdown campaign for Neon Moto Vest DR-9001", "in_progress", "critical"),
            ("Set up Summer Pack bundle: Tie-Dye Short + Cargo Jogger", "todo", "high"),
            ("Engage off-price buyer for Holographic Bucket Hat — 940 units", "todo", "high"),
            ("List Oversized Puffer on outlet at 50% discount", "todo", "high"),
            ("Prepare cash flow bridge memo for upcoming core-line PO", "todo", "critical"),
        ]
    else:  # basecamp
        tasks = [
            ("Season transition audit: 3 summer OOS, 5 winter dead stock confirmed", "completed", "high"),
            ("Draft winter clearance campaign brief", "completed", "medium"),
            ("Submit emergency air freight PO for French Terry Short — 400 units", "completed", "critical"),
            ("Mark down Thermal Base Layer 40% — live on storefront", "completed", "high"),
            ("Initiate off-price inquiry for Wool Blend Beanies — 680 units", "completed", "medium"),
            ("Place rush reorder for Heavyweight Tee White — 500 units (BC-S001)", "in_progress", "critical"),
            ("Dual-source Black Heavyweight Tee from domestic backup supplier", "in_progress", "high"),
            ("Route Heavyweight Fleece Hoodie to outlet channel", "todo", "high"),
        ]

    for title, status, priority in tasks:
        db.add(Task(
            id=uuid.uuid4(), organization_id=org_id, project_id=project_id,
            title=title, status=status, priority=priority,
            due_date=now + datetime.timedelta(days=30),
        ))
    db.flush()


def seed_demo_recommendation_traces(db, org_id, scenario):
    from app.models.recommendation_trace import RecommendationTrace

    builders = {"luma": _traces_luma, "drift": _traces_drift, "basecamp": _traces_basecamp}
    trace_data = builders[scenario](org_id)
    source_datasets = [
        "Inventory ledger (current stock, reorder points, lead times)",
        "Sales history (180-day daily transaction log)",
        "Product cost table (landed cost, retail price, margin)",
        "Supplier profile (lead time, location, minimum order quantity)",
    ]

    for d in trace_data:
        metrics = {
            "sku": d["sku"],
            "product_name": d["name"],
            **d["obs"],
        }
        snapshot = d["snapshot"]

        db.add(RecommendationTrace(
            recommendation_id=f"REC-{org_id.hex[:4]}-{d['sku']}",
            organization_id=org_id,
            recommendation_type=d["type"],
            action=d["action"],
            confidence_score=d["confidence"],
            status="Generated",
            version=1,
            priority=d["priority"],
            related_skus=[d["sku"]],
            estimated_financial_impact=d["impact"],
            validation_status="GENERATED",
            source_datasets=source_datasets,
            supporting_metrics=metrics,
            input_metrics=metrics,
            reasoning_chain=d["chain"],
            evidence_snapshot=snapshot,
            business_rules=d["rules"],
            calculations=d["calcs"],
            trust_score=d["confidence"] * 100,
            confidence_governance_flag="OK",
            evidence_validation_status="SUPPORTED",
            evidence_validation_reason=f"All metrics verified against the inventory ledger, 180-day sales history, and supplier lead-time records. Confidence {int(d['confidence']*100)}%.",
            trigger_type="Inventory Alert",
            source_agent="EVE Inventory Intelligence",
            created_from_query=False,
        ))


def seed_demo_workspace_data(db, org_id, scenario):
    catalogs = {"luma": _catalog_luma, "drift": _catalog_drift, "basecamp": _catalog_basecamp}
    catalog = catalogs[scenario]()

    print(f"\n{'='*60}")
    print(f"  Seeding: {scenario.upper()}")
    print(f"  SKUs: {len(catalog)}  |  Inventory Value: {_fmt(_inventory_value(catalog))}")
    print(f"{'='*60}")

    # Stamp the canonical business scenario so every service reads it instead of
    # parsing the workspace name/slug (single source of truth — app.core.scenario).
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org is not None:
        org.scenario_type = scenario_for_demo(scenario)
        db.flush()

    clean_org_data(db, org_id)

    df_inv, df_cost, df_sales = _build_frames(catalog)
    ImporterService.import_inventory(db, org_id, df_inv)
    ImporterService.import_costs(db, org_id, df_cost)
    ImporterService.import_sales(db, org_id, df_sales)
    seed_finance_and_clients(db, org_id, scenario)

    filename, question, answer, insights = _exec_copy(scenario, catalog)

    doc = ProcessedDocument(
        id=uuid.uuid4(), organization_id=org_id, filename=filename,
        content_type="application/pdf", file_size=24000, status="completed",
        document_type="Report", classification_confidence=0.98,
        extracted_data={"inventory_value": _inventory_value(catalog), "sku_count": len(catalog), "scenario": scenario},
        quality_assessment={"quality_score": 99.0, "issues": []},
        coo_insights=insights, file_path=f"uploads/{filename}",
    )
    db.add(doc)
    db.flush()

    conv = ExecutiveConversation(id=uuid.uuid4(), organization_id=org_id, title="Strategic Inventory Review")
    db.add(conv)
    db.flush()
    db.add_all([
        ExecutiveMessage(id=uuid.uuid4(), conversation_id=conv.id, role="user", content=question, created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=1)),
        ExecutiveMessage(id=uuid.uuid4(), conversation_id=conv.id, role="assistant", content=answer, agent_data={"scenario": scenario, "source": "demo_seed"}, created_at=datetime.datetime.utcnow()),
    ])
    db.flush()
    seed_demo_recommendation_traces(db, org_id, scenario)
    db.commit()


def ensure_organization_and_user(db, org_id, name, slug, email, user_id=None):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        org = Organization(id=org_id, name=name, slug=slug)
        db.add(org)
        db.flush()

    if user_id is None:
        user_id = uuid.uuid4()

    prof = db.query(Profile).filter(Profile.id == user_id).first()
    if not prof:
        prof = db.query(Profile).filter(Profile.email == email).first()
        if not prof:
            prof = Profile(id=user_id, email=email, hashed_password="scrypt:32768:8:1$placeholder", full_name=name + " Admin", is_active=True)
            db.add(prof)
            db.flush()

    member = db.query(Membership).filter(Membership.organization_id == org_id, Membership.user_id == prof.id).first()
    if not member:
        db.add(Membership(organization_id=org_id, user_id=prof.id, role="owner"))
        db.flush()
    db.commit()


def main():
    db = SessionLocal()
    try:
        ensure_organization_and_user(db, LUMA_ORG_ID,     "Luma & Co.",         "luma-and-co",      "devottamkumar1310@gmail.com")
        ensure_organization_and_user(db, DRIFT_ORG_ID,    "Drift Collective",   "drift-collective", "devottamkumar1310@gmail.com")
        ensure_organization_and_user(db, BASECAMP_ORG_ID, "Basecamp Basics",    "basecamp-basics",  "devottamkumar1310@gmail.com")

        seed_demo_workspace_data(db, LUMA_ORG_ID,     "luma")
        seed_demo_workspace_data(db, DRIFT_ORG_ID,    "drift")
        seed_demo_workspace_data(db, BASECAMP_ORG_ID, "basecamp")

        print("\n✓ All three workspaces seeded successfully.")
        print(f"  Luma & Co.        — {_fmt(_inventory_value(_catalog_luma()))} inventory, {len(_catalog_luma())} SKUs")
        print(f"  Drift Collective  — {_fmt(_inventory_value(_catalog_drift()))} inventory, {len(_catalog_drift())} SKUs")
        print(f"  Basecamp Basics   — {_fmt(_inventory_value(_catalog_basecamp()))} inventory, {len(_catalog_basecamp())} SKUs")
    except Exception as e:
        print(f"\n✗ Seeding failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
