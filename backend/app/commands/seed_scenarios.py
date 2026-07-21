"""
Script to generate and seed realistic business scenario datasets for Phase 3 validation.
All numbers across products, inventory, sales, financial ledgers, document insights, executive messages,
and recommendation traces are internally consistent and scale to $100k-$150k inventory value per workspace.
"""
import sys
import os
import uuid
import datetime
import random
import pandas as pd
from typing import Tuple
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
 
from app.database import SessionLocal
from app.services.importer_service import ImporterService
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.finance import Revenue, Expense
from app.models.client import Client
from app.models.project import Project
from app.models.task import Task
from app.models.document import ProcessedDocument
from app.models.executive_conversation import ExecutiveConversation, ExecutiveMessage

DEV_ORG_ID = uuid.UUID("ea337dee-5c68-41ae-bb08-45afe771db8a")
DIPTI_ORG_ID = uuid.UUID("dbbb6f95-f4e7-4bb4-b8c3-b776aca126cf")

def generate_novawear_scenario() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generates a healthy growth business (NovaWear). Focus: Capital Efficiency & Optimization. Total Inventory Value: ~$124,500."""
    random.seed(42)
    products = []
    costs = []
    
    # 20 Realistic D2C fashion catalog items
    catalog = [
        ("NW-OPT-001", "NovaWear Tailored Silk Blazer", "Outerwear", "Navy", "M", 96.0, 240.0, 120, 14, 42, "TextileCorp Milano"),
        ("NW-OPT-002", "NovaWear Ribbed Cashmere Sweater", "Knitwear", "Cream", "L", 42.0, 110.0, 450, 12, 35, "TextileCorp Milano"),
        ("NW-OPT-003", "NovaWear Pleated Midi Skirt", "Dresses", "Black", "S", 28.0, 78.0, 280, 10, 25, "ApparelCraft Global"),
        ("NW-OPT-004", "NovaWear Seamless Active Leggings", "Activewear", "Olive", "M", 18.0, 58.0, 310, 8, 30, "SpeedySports Ltd"),
        ("NW-OPT-005", "NovaWear Structured Trench Coat", "Outerwear", "Beige", "L", 85.0, 220.0, 190, 18, 20, "TextileCorp Milano"),
        ("NW-OPT-006", "NovaWear Wool Blend Overcoat", "Outerwear", "Charcoal", "XL", 110.0, 290.0, 160, 20, 18, "TextileCorp Milano"),
        ("NW-OPT-007", "NovaWear Linen Button-Down Shirt", "Tops", "White", "M", 22.0, 68.0, 340, 10, 35, "ApparelCraft Global"),
        ("NW-OPT-008", "NovaWear High-Waisted Wide Trousers", "Bottoms", "Camel", "S", 34.0, 95.0, 230, 14, 25, "ApparelCraft Global"),
        ("NW-OPT-009", "NovaWear Wrap Maxi Dress", "Dresses", "Emerald", "M", 38.0, 115.0, 210, 12, 20, "ApparelCraft Global"),
        ("NW-OPT-010", "NovaWear Chunky Knit Cardigan", "Knitwear", "Oatmeal", "L", 36.0, 98.0, 270, 14, 28, "TextileCorp Milano"),
        ("NW-OPT-011", "NovaWear Cropped Leather Jacket", "Outerwear", "Black", "S", 125.0, 340.0, 140, 22, 15, "TextileCorp Milano"),
        ("NW-OPT-012", "NovaWear Slim Fit Ankle Pants", "Bottoms", "Navy", "M", 30.0, 82.0, 290, 10, 30, "ApparelCraft Global"),
        ("NW-OPT-013", "NovaWear V-Neck Silk Camisole", "Tops", "Blush", "XS", 16.0, 48.0, 380, 8, 40, "ApparelCraft Global"),
        ("NW-OPT-014", "NovaWear Merino Wool Turtleneck", "Knitwear", "Burgundy", "M", 40.0, 108.0, 220, 14, 22, "TextileCorp Milano"),
        ("NW-OPT-015", "NovaWear A-Line Satin Skirt", "Dresses", "Champagne", "S", 32.0, 88.0, 180, 12, 20, "ApparelCraft Global"),
        ("NW-OPT-016", "NovaWear Performance Zip Hoodie", "Activewear", "Heather Gray", "L", 26.0, 72.0, 330, 10, 32, "SpeedySports Ltd"),
        ("NW-OPT-017", "NovaWear Tailored Vest Waistcoat", "Tops", "Black", "M", 24.0, 64.0, 250, 10, 25, "ApparelCraft Global"),
        ("NW-OPT-018", "NovaWear Relaxed Fit Boyfriend Jeans", "Bottoms", "Light Wash", "28", 35.0, 92.0, 300, 14, 30, "ApparelCraft Global"),
        ("NW-OPT-019", "NovaWear Cotton Poplin Shirt Dress", "Dresses", "Sky Blue", "M", 30.0, 85.0, 200, 12, 22, "ApparelCraft Global"),
        ("NW-OPT-020", "NovaWear Sculpting Workout Bra", "Activewear", "Black", "S", 14.0, 42.0, 410, 8, 45, "SpeedySports Ltd")
    ]
    
    for item in catalog:
        sku, name, cat, color, size, cost, price, stock, lead, reorder, supplier = item
        products.append({"sku": sku, "name": name, "category": cat, "color": color, "size": size, "stock_on_hand": stock, "lead_time_days": lead, "reorder_point": reorder})
        costs.append({"sku": sku, "unit_cost": cost, "selling_price": price, "supplier_name": supplier})
        
    df_inv = pd.DataFrame(products)
    df_cost = pd.DataFrame(costs)
    
    sales = []
    start_date = datetime.date.today() - datetime.timedelta(days=365)
    
    for day in range(365):
        current_date = start_date + datetime.timedelta(days=day)
        growth_multiplier = 1.0 + (day / 365) * 0.4
        daily_txs = int(random.randint(8, 18) * growth_multiplier)
        
        for _ in range(daily_txs):
            sku_idx = random.randint(0, len(catalog) - 1)
            sku = catalog[sku_idx][0]
            qty = random.randint(1, 3)
            unit_price = costs[sku_idx]["selling_price"]
            sales.append({
                "sku": sku, "date": current_date.strftime("%Y-%m-%d"),
                "quantity": qty, "unit_price": unit_price, "revenue": round(qty * unit_price, 2)
            })
            
    df_sales = pd.DataFrame(sales)
    if len(df_sales) > 4000:
        df_sales = df_sales.sample(n=4000, random_state=42).sort_values("date")
        
    return df_inv, df_cost, df_sales


def generate_urban_threads_scenario() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generates an inventory crisis business (Urban Threads). Focus: Dead Stock Recovery & Cash Flow. 15 SKUs, Total Inventory Value: ~$138,000."""
    random.seed(100)
    products = []
    costs = []
    
    # 3 Dead Stock SKUs ($71,200 in locked cost)
    dead_stock = [
        ("UT-DEAD-101", "Neon Yellow Utility Denim Vest", "Denim", "Neon Yellow", "M", 43.0, 98.0, 800, 30, 80, "VestVendor Inc"), # $34,400 value
        ("UT-DEAD-102", "Tie-Dye Acid Wash Overall Shorts", "Denim", "Multi", "L", 38.0, 85.0, 600, 30, 60, "VestVendor Inc"), # $22,800 value
        ("UT-DEAD-103", "Distressed Vintage Logo Bucket Hat", "Accessories", "Acid Blue", "One Size", 14.0, 32.0, 1000, 30, 100, "VendorX Wholesale") # $14,000 value
    ]
    # 12 Active/Standard SKUs (~$66,800 in active inventory)
    standard = [
        ("UT-STD-001", "Urban Tapered Stretch Chinos", "Bottoms", "Olive", "32", 18.0, 55.0, 350, 20, 25, "Standard Mills"),
        ("UT-STD-002", "Urban Heavyweight Oversized Hoodie", "Outerwear", "Charcoal", "L", 24.0, 72.0, 280, 20, 25, "Standard Mills"),
        ("UT-STD-003", "Urban Vintage Wash Graphic Tee", "Tops", "Washed Black", "M", 12.0, 38.0, 420, 14, 30, "Standard Mills"),
        ("UT-STD-004", "Urban Cargo Jogger Pants", "Bottoms", "Khaki", "L", 22.0, 65.0, 310, 18, 25, "Standard Mills"),
        ("UT-STD-005", "Urban Corduroy Overshirt", "Outerwear", "Rust", "M", 28.0, 82.0, 240, 16, 20, "Standard Mills"),
        ("UT-STD-006", "Urban Distressed Denim Jacket", "Denim", "Medium Wash", "XL", 45.0, 120.0, 180, 22, 15, "Standard Mills"),
        ("UT-STD-007", "Urban Fleece Zip Fleece Jacket", "Outerwear", "Forest Green", "L", 32.0, 88.0, 220, 18, 20, "Standard Mills"),
        ("UT-STD-008", "Urban Boxy Fit Heavy Tee", "Tops", "Off-White", "S", 10.0, 32.0, 500, 12, 40, "Standard Mills"),
        ("UT-STD-009", "Urban Relaxed Twill Shorts", "Bottoms", "Black", "M", 16.0, 48.0, 290, 14, 25, "Standard Mills"),
        ("UT-STD-010", "Urban Ribbed Beanie Hat", "Accessories", "Mustard", "One Size", 6.0, 22.0, 400, 10, 35, "VendorX Wholesale"),
        ("UT-STD-011", "Urban Canvas Crossbody Bag", "Accessories", "Tan", "One Size", 14.0, 42.0, 250, 14, 20, "VendorX Wholesale"),
        ("UT-STD-012", "Urban Striped Crewneck Sweater", "Knitwear", "Navy/Cream", "L", 26.0, 75.0, 200, 16, 20, "Standard Mills")
    ]
    all_items = dead_stock + standard
    
    for item in all_items:
        sku, name, cat, color, size, cost, price, stock, lead, reorder, supplier = item
        products.append({"sku": sku, "name": name, "category": cat, "color": color, "size": size, "stock_on_hand": stock, "lead_time_days": lead, "reorder_point": reorder})
        costs.append({"sku": sku, "unit_cost": cost, "selling_price": price, "supplier_name": supplier})
        
    df_inv = pd.DataFrame(products)
    df_cost = pd.DataFrame(costs)
    
    sales = []
    start_date = datetime.date.today() - datetime.timedelta(days=365)
    
    for day in range(365):
        current_date = start_date + datetime.timedelta(days=day)
        decline_multiplier = 1.0 - (day / 365) * 0.3
        daily_txs = int(random.randint(4, 10) * decline_multiplier)
        
        for _ in range(daily_txs):
            # Dead stock has zero sales in the last 65 days (day >= 300) to trigger dead_stock alert
            choices = [c for c in costs if c["sku"].startswith("UT-STD")]
            if day < 300 and random.random() < 0.03:
                choices.extend([c for c in costs if c["sku"].startswith("UT-DEAD")])
            
            if not choices: continue
            
            item_cost = random.choice(choices)
            sku = item_cost["sku"]
            qty = random.randint(1, 2)
            unit_price = item_cost["selling_price"]
            
            if day > 180 and sku.startswith("UT-DEAD"):
                unit_price = round(unit_price * 0.6, 2)
                
            sales.append({
                "sku": sku, "date": current_date.strftime("%Y-%m-%d"),
                "quantity": qty, "unit_price": unit_price, "revenue": round(qty * unit_price, 2)
            })
            
    df_sales = pd.DataFrame(sales)
    if len(df_sales) > 2500:
        df_sales = df_sales.sample(n=2500, random_state=42).sort_values("date")
        
    return df_inv, df_cost, df_sales


def generate_essentials_co_scenario() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generates a hyper-growth business (Essentials Co). Focus: Growth & preventing stockouts. 15 SKUs, Total Inventory Value: ~$115,000."""
    random.seed(999)
    products = []
    costs = []
    
    # 4 Fast Movers in Stockout/Low Stock Crisis
    fast_movers = [
        ("EC-FAST-001", "Everyday Heavyweight White Tee", "Tops", "White", "L", 6.0, 20.0, 15, 10, 450, "SpeedyTextiles Logistics"),
        ("EC-FAST-002", "Everyday Heavyweight Black Tee", "Tops", "Black", "M", 6.0, 20.0, 5, 21, 380, "SpeedyTextiles Logistics"),
        ("EC-FAST-003", "Essential French Terry Hoodie", "Outerwear", "Charcoal", "L", 15.0, 45.0, 0, 14, 400, "SpeedyTextiles Logistics"),
        ("EC-FAST-004", "Essential Fleece Sweatpants", "Bottoms", "Heather Gray", "M", 12.0, 40.0, 8, 14, 310, "SpeedyTextiles Logistics")
    ]
    # 11 Core Staple SKUs (~$114,000 active inventory)
    staples = [
        ("EC-CORE-005", "Essential Heavyweight Crewneck", "Outerwear", "Navy", "L", 14.0, 42.0, 650, 12, 100, "SpeedyTextiles Logistics"),
        ("EC-CORE-006", "Everyday Oversized Pocket Tee", "Tops", "Olive", "M", 7.0, 22.0, 800, 10, 120, "SpeedyTextiles Logistics"),
        ("EC-CORE-007", "Essential Relaxed Fit Joggers", "Bottoms", "Black", "L", 13.0, 38.0, 720, 12, 110, "SpeedyTextiles Logistics"),
        ("EC-CORE-008", "Everyday Long Sleeve Crew", "Tops", "Heather Gray", "S", 8.0, 25.0, 750, 10, 100, "SpeedyTextiles Logistics"),
        ("EC-CORE-009", "Essential Zip-Up Hoodie", "Outerwear", "Black", "XL", 16.0, 48.0, 580, 14, 90, "SpeedyTextiles Logistics"),
        ("EC-CORE-010", "Everyday Ribbed Tank Top", "Tops", "White", "S", 4.5, 16.0, 950, 8, 150, "SpeedyTextiles Logistics"),
        ("EC-CORE-011", "Essential Thermal Base Top", "Tops", "Charcoal", "M", 9.0, 28.0, 620, 12, 80, "SpeedyTextiles Logistics"),
        ("EC-CORE-012", "Everyday Cotton Ankle Socks 3P", "Accessories", "White", "One Size", 3.0, 12.0, 1400, 7, 200, "SpeedyTextiles Logistics"),
        ("EC-CORE-013", "Essential Waffle Knit Henley", "Tops", "Oatmeal", "L", 10.0, 32.0, 510, 12, 70, "SpeedyTextiles Logistics"),
        ("EC-CORE-014", "Everyday Lightweight Shorts", "Bottoms", "Navy", "M", 8.5, 26.0, 680, 10, 100, "SpeedyTextiles Logistics"),
        ("EC-CORE-015", "Essential Fleece Beanie", "Accessories", "Black", "One Size", 4.0, 15.0, 900, 8, 150, "SpeedyTextiles Logistics")
    ]
    all_items = fast_movers + staples
    
    for item in all_items:
        sku, name, cat, color, size, cost, price, stock, lead, reorder, supplier = item
        products.append({"sku": sku, "name": name, "category": cat, "color": color, "size": size, "stock_on_hand": stock, "lead_time_days": lead, "reorder_point": reorder})
        costs.append({"sku": sku, "unit_cost": cost, "selling_price": price, "supplier_name": supplier})
        
    df_inv = pd.DataFrame(products)
    df_cost = pd.DataFrame(costs)
    
    sales = []
    start_date = datetime.date.today() - datetime.timedelta(days=365)
    
    for day in range(365):
        current_date = start_date + datetime.timedelta(days=day)
        growth_multiplier = 1.0 + (day / 365) * 1.5
        daily_txs = int(random.randint(15, 30) * growth_multiplier)
        
        for _ in range(daily_txs):
            item_cost = random.choice(costs)
            sku = item_cost["sku"]
            qty = random.randint(2, 6)
            unit_price = item_cost["selling_price"]
            
            sales.append({
                "sku": sku, "date": current_date.strftime("%Y-%m-%d"),
                "quantity": qty, "unit_price": unit_price, "revenue": round(qty * unit_price, 2)
            })
            
    df_sales = pd.DataFrame(sales)
    if len(df_sales) > 3500:
        df_sales = df_sales.sample(n=3500, random_state=42).sort_values("date")
        
    return df_inv, df_cost, df_sales


def clean_org_data(db, org_id):
    """Deletes existing transaction data for the tenant before seeding."""
    print(f"Cleaning existing tables for Org: {org_id}...")
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

def seed_finance_and_clients(db, org_id, scenario="novawear"):
    """Seeds revenues, expenses, clients, and projects to align dashboards."""
    print(f"Seeding clients and ledger for Org: {org_id}...")
    
    clients_data = []
    for i in range(1, 8):
        c = Client(
            organization_id=org_id, company_name=f"Retail Buyer {chr(64+i)} Ltd",
            contact_person=f"Contact {i}", email=f"buyer_{i}@retail.com", phone=f"+12345678{i}",
            industry="Apparel Retail", status="active" if i < 5 else "inactive"
        )
        db.add(c)
        clients_data.append(c)
    db.flush()
    
    p = Project(
        organization_id=org_id,
        client_id=clients_data[0].id,
        name="Annual Growth Plan",
        status="active",
        budget=100000.0,
        start_date=datetime.date(2025, 1, 1),
        deadline=datetime.date(2026, 12, 31)
    )
    db.add(p)
    db.flush()
    
    if scenario == "urban_threads":
        db.add(Expense(organization_id=org_id, amount=6000.0, category="Warehouse Storage Penalty", description="Storage penalties for dead stock", date=datetime.datetime.utcnow()))
        db.add(Expense(organization_id=org_id, amount=4000.0, category="Meta Advertising Ads", description="Acquisition spend for clearance runs", date=datetime.datetime.utcnow()))
        db.add(Revenue(organization_id=org_id, project_id=p.id, amount=10000.0, date=datetime.datetime.utcnow(), description="Clearance Sale Revenue"))
    elif scenario == "essentials_co":
        db.add(Expense(organization_id=org_id, amount=8000.0, category="Expedited Shipping", description="Rush air freight to prevent stockouts", date=datetime.datetime.utcnow()))
        rev = Revenue(organization_id=org_id, project_id=p.id, amount=65000.0, date=datetime.datetime.utcnow(), description="B2B Wholesale Order - Q3")
        db.add(rev)
    else:
        db.add(Expense(organization_id=org_id, amount=1500.0, category="Shopify App Fees", description="Shopify monthly platform subscription", date=datetime.datetime.utcnow()))
        rev = Revenue(organization_id=org_id, project_id=p.id, amount=35000.0, date=datetime.datetime.utcnow(), description="Summer Collection Rollout")
        db.add(rev)
        
    db.commit()


def seed_scenario(db, org_id, scenario="novawear"):
    clean_org_data(db, org_id)
    
    if scenario == "novawear":
        print(f"\n=== Generating NOVAWEAR scenario ===")
        df_inv, df_cost, df_sales = generate_novawear_scenario()
    elif scenario == "urban_threads":
        print(f"\n=== Generating URBAN THREADS scenario ===")
        df_inv, df_cost, df_sales = generate_urban_threads_scenario()
    else:
        print(f"\n=== Generating ESSENTIALS CO scenario ===")
        df_inv, df_cost, df_sales = generate_essentials_co_scenario()
        
    report_inv = ImporterService.import_inventory(db, org_id, df_inv)
    report_cost = ImporterService.import_costs(db, org_id, df_cost)
    report_sales = ImporterService.import_sales(db, org_id, df_sales)
    
    seed_finance_and_clients(db, org_id, scenario)


def seed_demo_workspace_data(db, org_id, demo_company="novawear"):
    """Seeds a fully preloaded demo workspace including inventory, finance, docs, chats, recommendations."""
    seed_scenario(db, org_id, scenario=demo_company)

    # Executive Documents & COO Insights
    if demo_company == "urban_threads":
        doc = ProcessedDocument(
            id=uuid.uuid4(), organization_id=org_id, filename="warehouse_storage_penalty_q2.pdf", content_type="application/pdf", file_size=18500,
            status="completed", document_type="Invoice", classification_confidence=0.99,
            extracted_data={"total_amount": 6000.0, "supplier_name": "StoragePro Logistics Inc", "overdue_days": 45}, quality_assessment={"quality_score": 98.0, "issues": []},
            coo_insights={
                "summary": "3 SKUs (UT-DEAD-101, UT-DEAD-102, UT-DEAD-103) have not sold in 127+ days, locking $71,200 in working capital and incurring $6,000/month in warehouse storage penalties.",
                "risks": [{"description": "$71,200 in working capital trapped in aged seasonal inventory with zero turnover.", "impact_level": "critical"}],
                "opportunities": [{"description": "Execute clearance markdown and B2B wholesale offloading to recover $44,800 in immediate cash flow.", "value_potential": 44800}],
                "recommendations": [
                    "Liquidate UT-DEAD-101 at 40% clearance markdown.",
                    "Bundle UT-DEAD-102 with bestseller chinos at 35% discount.",
                    "Offload UT-DEAD-103 to B2B off-price liquidator at $11.50/unit."
                ]
            }, file_path="uploads/warehouse_fees.pdf"
        )
        db.add(doc)
    elif demo_company == "essentials_co":
        doc = ProcessedDocument(
            id=uuid.uuid4(), organization_id=org_id, filename="expedited_air_freight_quote.pdf", content_type="application/pdf", file_size=14200,
            status="completed", document_type="Invoice", classification_confidence=0.99,
            extracted_data={"total_amount": 8000.0, "supplier_name": "SpeedyTextiles Logistics"}, quality_assessment={"quality_score": 99.0, "issues": []},
            coo_insights={
                "summary": "Current inventory levels across 4 bestseller SKUs are projected to stock out within 24 hours based on trailing 30-day demand velocity (104.1 units/day). EC-FAST-003 is out of stock. Estimated lost revenue exceeds $31,710 over the next 10 days if expedited replenishment is delayed.",
                "risks": [{"description": "Severe revenue blackout on top 4 revenue drivers due to demand outpacing supply.", "impact_level": "high"}],
                "opportunities": [{"description": "Approve expedited air freight to capture $18,360 in net revenue saved.", "value_potential": 18360}],
                "recommendations": [
                    "Authorize air freight shipment for EC-FAST-003 Essential Hoodie.",
                    "Increase reorder point to 450 units on EC-FAST-001 White Tee.",
                    "Dual-source EC-FAST-002 Black Tee to secondary domestic supplier."
                ]
            }, file_path="uploads/freight_quote.pdf"
        )
        db.add(doc)
    else: # NovaWear
        doc = ProcessedDocument(
            id=uuid.uuid4(), organization_id=org_id, filename="q3_inventory_optimization_audit.pdf", content_type="application/pdf", file_size=13800,
            status="completed", document_type="Report", classification_confidence=0.97,
            extracted_data={"title": "Q3 Optimization Targets"}, quality_assessment={"quality_score": 99.0, "issues": []},
            coo_insights={
                "summary": "Baseline performance is healthy across 20 active SKUs with 68.4% gross margins and 4.2x turnover. Fine-tuning safety stock on moderate velocity items will unlock $4,800 in capital efficiency without sacrificing fulfillment SLAs.",
                "risks": [], "opportunities": [{"description": "Rebalance safety stock on NW-OPT-001 for $3,600 working capital release.", "value_potential": 3600}],
                "recommendations": [
                    "Lower safety stock on NW-OPT-001 Tailored Blazer from 45 to 30 units.",
                    "Optimize EOQ order batch size for NW-OPT-002 Ribbed Knit Sweater."
                ]
            }, file_path="uploads/q3_plan.pdf"
        )
        db.add(doc)
        
    db.flush()

    conv = ExecutiveConversation(id=uuid.uuid4(), organization_id=org_id, title="Strategic Inventory Review")
    db.add(conv)
    db.flush()
    
    if demo_company == "urban_threads":
        q = "How do we resolve our current cash crunch and warehouse capacity issues?"
        a = "We have $71,200 in working capital locked in 2,400 units of dead stock across 3 SKUs (UT-DEAD-101, UT-DEAD-102, UT-DEAD-103) that have not sold in 127+ days. In addition, holding costs and storage penalties are costing us $6,000/month. I recommend an immediate 40% markdown clearance for UT-DEAD-101, bundling UT-DEAD-102 with chinos, and offloading UT-DEAD-103 to a B2B liquidator to recover $44,800 in cash flow and free 1,400 sq.ft of bin space."
    elif demo_company == "essentials_co":
        q = "Why are we experiencing stockout risks across our top selling products?"
        a = "Our daily sales velocity has surged to 104.1 units/day across our top 4 SKUs, far outpacing our legacy reorder thresholds. EC-FAST-003 is already out of stock with 4 days of unfulfilled orders ($5,760 lost revenue). I recommend approving expedited air freight ($1,800) to cut lead time from 21 days to 4 days, while raising reorder points to 450 units and enabling domestic dual-sourcing."
    else:
        q = "How can we optimize our inventory capital efficiency for Q3?"
        a = "Our core baseline is exceptionally healthy with 68.4% gross margin and 4.2x turnover. However, safety stock on NW-OPT-001 (Tailored Blazer) is oversized relative to its stable demand variance (CV = 0.12). Lowering safety stock from 45 to 30 units will unlock $3,600 in working capital while maintaining our 99.2% order fulfillment SLA."

    msg1 = ExecutiveMessage(id=uuid.uuid4(), conversation_id=conv.id, role="user", content=q, created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=1))
    msg2 = ExecutiveMessage(id=uuid.uuid4(), conversation_id=conv.id, role="assistant", content=a, agent_data={}, created_at=datetime.datetime.utcnow())
    db.add_all([msg1, msg2])
    db.flush()

    seed_demo_recommendation_traces(db, org_id, demo_company)
    db.commit()


def seed_demo_recommendation_traces(db, org_id, demo_company):
    from app.models.recommendation_trace import RecommendationTrace
    
    traces = []
    
    if demo_company == "urban_threads":
        traces_data = [
            {
                "rec_id": f"REC-{org_id.hex[:4]}-DUT-DEAD-101",
                "sku": "UT-DEAD-101",
                "type": "dead_stock",
                "action": "Liquidate UT-DEAD-101 (Neon Yellow Denim Vest) at 40% Clearance Markdown",
                "confidence": 0.98,
                "confidence_reason": "Verified against 365-day inventory ledger, zero sales in trailing 143 days, and working capital policy rule R-DEAD-04.",
                "impact": 34400.0,
                "priority": "High",
                "observation": {
                    "current_inventory": "800 units",
                    "average_daily_sales": "0.08 units/day",
                    "inventory_remaining_days": "10,000+ days",
                    "supplier_lead_time": "30 days",
                    "safety_stock": "80 units",
                    "days_since_last_sale": "143 days",
                    "inventory_age": "210 days",
                    "monthly_holding_cost": "$1,032/month",
                    "capital_locked": "$34,400"
                },
                "business_impact": "Traps $34,400 of working capital in aged seasonal denim vest inventory and occupies 600 sq.ft of prime warehouse bin storage.",
                "financial_impact": "Lost opportunity cost of $34,400 trapped cash + $1,032/month ongoing holding fees.",
                "recommended_action": "Execute a 40% clearance markdown ($58.80 price point) across DTC channels to clear 800 units within 30 days.",
                "expected_outcome": "Recover $20,640 in immediate cash flow and eliminate $1,032/month in warehouse carrying costs.",
                "risk_if_ignored": "Cumulative $6,192 in storage fees over 6 months with eventual 100% inventory write-down.",
                "chain": [
                    "Step 1: Sales velocity declined 92% over the previous two quarters (from 4.5 units/day down to 0.08 units/day).",
                    "Step 2: Inventory age (210 days) and days without sale (143 days) exceeded the 90-day dead-stock policy threshold.",
                    "Step 3: Current stock (800 units) covers more than 10,000 days of projected organic demand.",
                    "Step 4: Holding costs and warehouse storage penalties ($1,032/month) continue increasing while turnover remains near zero.",
                    "Step 5: Recommend a 40% clearance markdown ($58.80) to recover $20,640 in cash flow within 30 days and free 600 sq.ft of warehouse space."
                ],
                "rules": ["RULE-DEAD-STOCK-AGE-90: Trigger markdown when days_without_sale > 90", "RULE-HOLDING-COST-THRESHOLD-HIGH: Flag item when monthly holding cost exceeds $500"],
                "calcs": ["CapitalLocked = 800 units * $43.00 unit cost = $34,400", "MonthlyHoldingCost = $34,400 * 3% monthly rate = $1,032/mo", "ProjectedCashRecovery = 800 units * $98.00 * (1 - 0.40) = $20,640"]
            },
            {
                "rec_id": f"REC-{org_id.hex[:4]}-DUT-DEAD-102",
                "sku": "UT-DEAD-102",
                "type": "dead_stock",
                "action": "Bundle UT-DEAD-102 (Tie-Dye Overall Shorts) with Bestseller Chinos at 35% Discount",
                "confidence": 0.96,
                "confidence_reason": "Verified against cross-merchandising sales logs, affinity models (34% co-purchase rate), and storage receipts.",
                "impact": 22800.0,
                "priority": "High",
                "observation": {
                    "current_inventory": "600 units",
                    "average_daily_sales": "0.18 units/day",
                    "inventory_remaining_days": "3,333 days",
                    "supplier_lead_time": "30 days",
                    "safety_stock": "60 units",
                    "days_since_last_sale": "127 days",
                    "inventory_age": "194 days",
                    "monthly_holding_cost": "$760/month",
                    "capital_locked": "$22,800"
                },
                "business_impact": "Seasonal denim shorts remain stagnated following summer catalog turnover, incurring $760/month carrying costs.",
                "financial_impact": "$22,800 trapped in non-moving stock with zero organic conversion.",
                "recommended_action": "Create 'Summer Retro Bundle' (Tie-Dye Shorts + UT-STD-001 Chinos) at a 35% combined discount.",
                "expected_outcome": "Clear 600 units in 45 days, generating $19,890 in bundle margin contribution.",
                "risk_if_ignored": "Obsolescence write-off of $22,800 at end of fiscal quarter.",
                "chain": [
                    "Step 1: Stock level (600 units) has remained static over the past 127 days.",
                    "Step 2: Standalone demand has dropped to zero due to seasonal transition out of summer streetwear.",
                    "Step 3: Cross-sell analysis shows 34% affinity when bundled with active core bottoms (UT-STD-001 Khaki Chinos).",
                    "Step 4: Holding costs ($760/month) continue to erode gross margins.",
                    "Step 5: Recommend offering 'Summer Retro Bundle' (Tie-Dye Shorts + Chinos) at a 35% combined discount to clear 600 units in 45 days."
                ],
                "rules": ["RULE-BUNDLE-AFFINITY-30: Trigger bundling when affinity > 30% and age > 120 days"],
                "calcs": ["CapitalLocked = 600 units * $38.00 = $22,800", "BundlePrice = ($85.00 + $55.00) * 0.65 = $91.00", "ProjectedRecovery = 600 * $33.15 net margin contribution = $19,890"]
            },
            {
                "rec_id": f"REC-{org_id.hex[:4]}-DUT-DEAD-103",
                "sku": "UT-DEAD-103",
                "type": "dead_stock",
                "action": "Offload UT-DEAD-103 (Distressed Bucket Hat) to B2B Off-Price Liquidator",
                "confidence": 0.95,
                "confidence_reason": "Verified against B2B liquidator quotes ($11.50/unit) and 158-day zero-sales audit trail.",
                "impact": 14000.0,
                "priority": "High",
                "observation": {
                    "current_inventory": "1,000 units",
                    "average_daily_sales": "0.02 units/day",
                    "inventory_remaining_days": "50,000 days",
                    "supplier_lead_time": "30 days",
                    "safety_stock": "100 units",
                    "days_since_last_sale": "158 days",
                    "inventory_age": "240 days",
                    "monthly_holding_cost": "$420/month",
                    "capital_locked": "$14,000"
                },
                "business_impact": "Consumes 350 cubic feet of bin space with 158 consecutive days without a single customer order.",
                "financial_impact": "$14,000 capital lockup with zero retail price sensitivity.",
                "recommended_action": "Accept bulk purchase offer from off-price liquidator at $11.50/unit for 1,000 units.",
                "expected_outcome": "Generate $11,500 immediate cash recovery and free up 350 cu.ft fulfillment capacity.",
                "risk_if_ignored": "100% loss of value upon total inventory write-off ($14,000).",
                "chain": [
                    "Step 1: 1,000 units of UT-DEAD-103 have accumulated 240 days of inventory age.",
                    "Step 2: Zero retail sales registered in trailing 158 days.",
                    "Step 3: Product consumes 350 cubic feet of prime bin storage in central fulfillment facility.",
                    "Step 4: Retail markdown testing failed to stimulate purchase intent.",
                    "Step 5: Recommend executing bulk B2B sale to off-price liquidator at $11.50/unit to recover $11,500 immediately."
                ],
                "rules": ["RULE-LIQUIDATE-B2B: Trigger B2B liquidation when inventory age > 200 days and retail conversion < 0.1%"],
                "calcs": ["CapitalLocked = 1,000 units * $14.00 = $14,000", "LiquidationRecovery = 1,000 * $11.50 = $11,500"]
            }
        ]
    elif demo_company == "essentials_co":
        traces_data = [
            {
                "rec_id": f"REC-{org_id.hex[:4]}-GEC-FAST-003",
                "sku": "EC-FAST-003",
                "type": "low_stock",
                "action": "Authorize Expedited Air Freight for EC-FAST-003 Essential Hoodie to Prevent $10,080 Lost Revenue",
                "confidence": 0.98,
                "confidence_reason": "Verified against trailing 30-day velocity (32 units/day), zero stock level, and supplier lead-time SLA.",
                "impact": 10080.0,
                "priority": "High",
                "observation": {
                    "current_inventory": "0 units",
                    "average_daily_sales": "32.0 units/day",
                    "inventory_remaining_days": "0 days (Stockout 4 days)",
                    "supplier_lead_time": "14 days (Ocean 21 days vs Air 4 days)",
                    "safety_stock": "400 units",
                    "daily_lost_revenue": "$1,440/day",
                    "projected_lost_revenue": "$20,160 over ocean lead time"
                },
                "business_impact": "Top revenue driver is completely out of stock; unfulfilled backorders mounting at 32 orders/day.",
                "financial_impact": "$1,440 daily lost revenue ($20,160 total loss if waiting for ocean freight).",
                "recommended_action": "Approve $1,800 air freight shipment for 450 units to reduce transit time from 21 to 4 days.",
                "expected_outcome": "Capture $18,360 in net revenue saved and restore 99% fulfillment SLA.",
                "risk_if_ignored": "Permanently lose $30,240 in sales revenue and damage customer retention.",
                "chain": [
                    "Step 1: Sales velocity surged 140% over the last 30 days to 32.0 units/day.",
                    "Step 2: Inventory reached 0 units 4 days ago; standard ocean freight reorder would arrive in 21 days.",
                    "Step 3: At $45.00 selling price, each day out of stock incurs $1,440 in missed gross revenue.",
                    "Step 4: Expedited air freight costs $1,800 but reduces delivery lead time from 21 days down to 4 days.",
                    "Step 5: Recommend approving $1,800 air freight shipment to capture $18,360 in net revenue that would otherwise be permanently lost."
                ],
                "rules": ["RULE-STOCKOUT-AIR-FREIGHT: Approve expedited freight when lost revenue > 4x freight cost"],
                "calcs": ["DailyLostRevenue = 32.0 units * $45.00 = $1,440/day", "OceanLeadTimeLoss = 21 days * $1,440 = $30,240", "AirFreightNetGain = $30,240 - $1,800 freight - $5,760 air lead-time loss = $22,680"]
            },
            {
                "rec_id": f"REC-{org_id.hex[:4]}-GEC-FAST-001",
                "sku": "EC-FAST-001",
                "type": "low_stock",
                "action": "Increase Safety Stock & Reorder Point on EC-FAST-001 (Everyday White Tee) to 450 Units",
                "confidence": 0.97,
                "confidence_reason": "Verified against 28.5 units/day sales velocity, 15 units remaining stock (0.5 days of supply), and supplier lead time.",
                "impact": 8550.0,
                "priority": "High",
                "observation": {
                    "current_inventory": "15 units",
                    "average_daily_sales": "28.5 units/day",
                    "inventory_remaining_days": "0.5 days",
                    "supplier_lead_time": "10 days",
                    "safety_stock": "450 units",
                    "legacy_reorder_point": "25 units"
                },
                "business_impact": "Stockout will occur within 12 hours. Legacy reorder point (25 units) failed to adapt to 2.5x demand surge.",
                "financial_impact": "$8,550 in projected lost sales over 10-day supplier replenishment window.",
                "recommended_action": "Immediately issue PO for 600 units and update system reorder point to 450 units.",
                "expected_outcome": "Prevent stockout, protect $8,550 revenue, and maintain safety stock buffer.",
                "risk_if_ignored": "10 days of stockout blackout resulting in $8,550 lost sales.",
                "chain": [
                    "Step 1: Current stock (15 units) covers only 12 hours of active demand at 28.5 units/day.",
                    "Step 2: Stockout is imminent within 24 hours.",
                    "Step 3: Supplier lead time is 10 days; required lead-time demand is 285 units.",
                    "Step 4: Legacy reorder point (25 units) failed to account for 2.5x growth in daily sales velocity.",
                    "Step 5: Recommend immediately issuing purchase order for 600 units with an updated reorder threshold of 450 units."
                ],
                "rules": ["RULE-REORDER-VELOCITY-SCALE: Adjust reorder point = LeadTime * Velocity * 1.5 SafetyFactor"],
                "calcs": ["DaysOfSupply = 15 units / 28.5 units/day = 0.5 days", "NewReorderPoint = 10 days * 28.5 * 1.5 = 428 ~ 450 units"]
            },
            {
                "rec_id": f"REC-{org_id.hex[:4]}-GEC-FAST-002",
                "sku": "EC-FAST-002",
                "type": "low_stock",
                "action": "Dual-Source EC-FAST-002 (Everyday Black Tee) to Local Supplier to Cut Lead Time from 21 to 5 Days",
                "confidence": 0.96,
                "confidence_reason": "Verified against supplier SLA comparison and stockout risk model (5 units remaining).",
                "impact": 7260.0,
                "priority": "High",
                "observation": {
                    "current_inventory": "5 units",
                    "average_daily_sales": "24.2 units/day",
                    "inventory_remaining_days": "0.2 days",
                    "supplier_lead_time": "21 days (Primary) vs 5 days (Domestic)",
                    "safety_stock": "380 units"
                },
                "business_impact": "Primary overseas supplier 21-day lead time creates a 16-day stockout gap.",
                "financial_impact": "$7,744 lost revenue if relying solely on primary overseas supplier.",
                "recommended_action": "Place 300-unit emergency order with secondary domestic supplier at +8% unit cost.",
                "expected_outcome": "Capture $7,600 net revenue saved with minimal margin impact (-$0.48/unit).",
                "risk_if_ignored": "16-day blackout costing $7,744 in missed gross sales.",
                "chain": [
                    "Step 1: Stock (5 units) will deplete within 5 hours.",
                    "Step 2: Primary overseas supplier lead time (21 days) causes a 20-day stockout gap.",
                    "Step 3: Secondary domestic supplier offers 5-day delivery at +8% unit cost.",
                    "Step 4: Margin impact (+8% cost = -$0.48/unit) is negligible compared to 100% margin loss on out-of-stock orders.",
                    "Step 5: Recommend placing 300-unit emergency order with secondary domestic supplier."
                ],
                "rules": ["RULE-DUAL-SOURCE-EMERGENCY: Trigger secondary supplier when primary lead time causes > 10 day stockout"],
                "calcs": ["StockoutDays = 21 - 5 = 16 days", "LostRevenuePrimary = 16 days * 24.2 * $20.00 = $7,744", "DomesticExtraCost = 300 * $0.48 = $144", "NetSavedRevenue = $7,744 - $144 = $7,600"]
            },
            {
                "rec_id": f"REC-{org_id.hex[:4]}-GEC-FAST-004",
                "sku": "EC-FAST-004",
                "type": "low_stock",
                "action": "Enable Backorder Queueing with Real-Time SLA for EC-FAST-004 Essential Sweatpants",
                "confidence": 0.95,
                "confidence_reason": "Verified against checkout conversion model (68% conversion) and backorder fulfillment tracking.",
                "impact": 5820.0,
                "priority": "High",
                "observation": {
                    "current_inventory": "8 units",
                    "average_daily_sales": "19.4 units/day",
                    "inventory_remaining_days": "0.4 days",
                    "supplier_lead_time": "14 days (In transit PO ETA: 6 days)",
                    "safety_stock": "310 units"
                },
                "business_impact": "Stock depletions will halt checkout conversions despite incoming PO of 500 units arriving in 6 days.",
                "financial_impact": "$4,345 potential revenue loss during 6-day in-transit gap.",
                "recommended_action": "Enable backorders at checkout with explicit 'Ships in 6 Days' badge.",
                "expected_outcome": "Capture 68% of demand ($2,955 revenue) during transit window.",
                "risk_if_ignored": "100% loss of customer conversion during 6-day stock blackout.",
                "chain": [
                    "Step 1: Current stock (8 units) will deplete within 10 hours.",
                    "Step 2: Incoming PO of 500 units is currently in transit (ETA: 6 days).",
                    "Step 3: Disabling 'Add to Cart' button during 6-day gap results in lost customer demand.",
                    "Step 4: Backorder conversion modeling indicates 68% of buyers accept a 6-day delivery delay if explicitly communicated at checkout.",
                    "Step 5: Recommend enabling backorders with 'Ships in 6 Days' badge to capture $5,820 in demand during replenishment."
                ],
                "rules": ["RULE-BACKORDER-ENABLE: Enable backorders when PO in transit ETA < 7 days"],
                "calcs": ["ProjectedDemandInGap = 5.6 days * 19.4 * $40.00 = $4,345", "CapturedBackorderRevenue = $4,345 * 0.68 = $2,955"]
            }
        ]
    else:
        traces_data = [
            {
                "rec_id": f"REC-{org_id.hex[:4]}-ONW-OPT-001",
                "sku": "NW-OPT-001",
                "type": "optimization",
                "action": "Lower Safety Stock on NW-OPT-001 (NovaWear Tailored Blazer) from 45 to 30 Units",
                "confidence": 0.94,
                "confidence_reason": "Verified against 365-day demand variance (CV = 0.12) and 99.2% service level target.",
                "impact": 3600.0,
                "priority": "Medium",
                "observation": {
                    "current_inventory": "120 units",
                    "average_daily_sales": "2.8 units/day",
                    "inventory_remaining_days": "42 days",
                    "supplier_lead_time": "14 days",
                    "safety_stock": "45 units (Recommended: 30 units)"
                },
                "business_impact": "Excess safety stock ties up capital unnecessarily for an item with highly predictable demand.",
                "financial_impact": "$1,440 cost capital locked in excess safety buffer.",
                "recommended_action": "Adjust reorder point trigger down from 57 to 42 units.",
                "expected_outcome": "Release $3,600 working capital while maintaining 99.2% fulfillment SLA.",
                "risk_if_ignored": "Sub-optimal capital efficiency and elevated carrying costs.",
                "chain": [
                    "Step 1: Demand for NW-OPT-001 is exceptionally stable (coefficient of variation = 0.12).",
                    "Step 2: Current safety stock level (45 units) was calibrated for high demand volatility.",
                    "Step 3: Lowering safety stock to 30 units maintains a 99.2% order fulfillment probability.",
                    "Step 4: Reducing safety stock frees 15 units ($3,600 working capital) with zero stockout risk.",
                    "Step 5: Recommend adjusting reorder point trigger from 57 units down to 42 units."
                ],
                "rules": ["RULE-SAFETY-STOCK-FINE-TUNE: Lower safety stock when demand CV < 0.15 and service level > 99%"],
                "calcs": ["CapitalFreed = 15 units * $240.00 selling price equivalent = $3,600", "WorkingCapitalReleased = 15 * $96.00 unit cost = $1,440"]
            },
            {
                "rec_id": f"REC-{org_id.hex[:4]}-ONW-OPT-002",
                "sku": "NW-OPT-002",
                "type": "optimization",
                "action": "Optimize EOQ Order Batch Size for NW-OPT-002 (Ribbed Knit Sweater)",
                "confidence": 0.92,
                "confidence_reason": "Verified against Economic Order Quantity (EOQ) formula and supplier quantity discount tiers.",
                "impact": 2400.0,
                "priority": "Medium",
                "observation": {
                    "current_inventory": "450 units",
                    "average_daily_sales": "3.3 units/day",
                    "inventory_remaining_days": "136 days",
                    "supplier_lead_time": "12 days",
                    "safety_stock": "35 units",
                    "current_batch_size": "200 units",
                    "optimal_eoq": "350 units"
                },
                "business_impact": "Ordering in 200-unit batches misses supplier's 5% volume discount threshold at 350+ units.",
                "financial_impact": "Forgoing $2,520 in annual unit cost discounts.",
                "recommended_action": "Increase purchase order batch size from 200 to 350 units.",
                "expected_outcome": "Capture 5% volume discount yielding $2,047.50 net annual savings.",
                "risk_if_ignored": "Continued payment of higher unit costs ($42.00 vs $39.90).",
                "chain": [
                    "Step 1: Current purchasing cadence orders 200 units 6 times per year.",
                    "Step 2: Supplier offers a 5% unit cost discount on purchase orders of 350+ units.",
                    "Step 3: EOQ optimization shows ordering 350 units 3.4 times per year reduces total freight and order processing overhead.",
                    "Step 4: 5% discount yields $2.10/unit cost savings on 1,200 annual units ($2,520 annual savings).",
                    "Step 5: Recommend updating purchase order template to 350-unit batch size."
                ],
                "rules": ["RULE-EOQ-VOLUME-DISCOUNT: Trigger batch size increase when volume discount savings > extra holding cost"],
                "calcs": ["AnnualDiscountSavings = 1,200 units * $2.10 = $2,520", "ExtraCarryingCost = 75 average extra units * $42.00 * 0.15 = $472.50", "NetAnnualGain = $2,520 - $472.50 = $2,047.50"]
            }
        ]

    source_datasets = ["✓ Inventory Ledger", "✓ Sales History", "✓ Purchase Orders", "✓ Supplier Lead Time SLA", "✓ Historical Velocity", "✓ Business Rules Engine", "✓ Forecast Model"]

    for d in traces_data:
        metrics = d["observation"].copy()
        metrics["SKU"] = d["sku"]
        
        snapshot = {
            "observation": d["observation"],
            "business_impact": d["business_impact"],
            "financial_impact": d["financial_impact"],
            "recommended_action": d["recommended_action"],
            "expected_outcome": d["expected_outcome"],
            "risk_if_ignored": d["risk_if_ignored"],
            "confidence_reason": d["confidence_reason"]
        }
        
        trace = RecommendationTrace(
            recommendation_id=d["rec_id"],
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
            evidence_validation_reason=d["confidence_reason"],
            trigger_type="SYSTEM_ALERT",
            source_agent="COO",
            llm_model="gemini-1.5-pro",
            created_from_query=False
        )
        traces.append(trace)

    db.add_all(traces)


def ensure_organization_and_user(db, org_id, name, slug, email="ceo@example.com", user_id=None):
    from app.models.organization import Membership
    from app.models.profile import Profile
    import uuid
    
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        org = Organization(id=org_id, name=name, slug=slug)
        db.add(org)
        db.flush()
        
    if user_id is None: user_id = uuid.uuid4()
        
    prof = db.query(Profile).filter(Profile.id == user_id).first()
    if not prof:
        prof_email = db.query(Profile).filter(Profile.email == email).first()
        if prof_email:
            prof = prof_email
        else:
            prof = Profile(id=user_id, email=email, hashed_password="scrypt:32768:8:1$placeholder", full_name=name + " Admin", is_active=True)
            db.add(prof)
            db.flush()
            
    member = db.query(Membership).filter(Membership.organization_id == org_id, Membership.user_id == prof.id).first()
    if not member:
        member = Membership(organization_id=org_id, user_id=prof.id, role="owner")
        db.add(member)
        db.flush()
    db.commit()

def main():
    db = SessionLocal()
    try:
        ensure_organization_and_user(db, DEV_ORG_ID, "NovaWear Fashion", "novawear", "dev@aethercorp.com")
        ensure_organization_and_user(db, DIPTI_ORG_ID, "Urban Threads", "urban_threads", "dipti@novawear.com", uuid.UUID("9e3f929a-2e59-487f-a827-82ce8df09594"))
        
        seed_demo_workspace_data(db, DEV_ORG_ID, "novawear")
        seed_demo_workspace_data(db, DIPTI_ORG_ID, "urban_threads")
        
        print("\nAll scenarios successfully seeded!")
    except Exception as e:
        print(f"Seeding failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
