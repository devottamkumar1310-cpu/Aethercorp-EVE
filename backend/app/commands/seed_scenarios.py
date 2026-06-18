"""
Script to generate and seed realistic business scenario datasets for Phase 3 validation.
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
from app.models.product import Product
from app.models.inventory import InventoryItem, SalesRecord
from app.models.document import ProcessedDocument
from app.models.executive_conversation import ExecutiveConversation, ExecutiveMessage
from app.models.ai_recommendation import AIRecommendation

DEV_ORG_ID = uuid.UUID("ea337dee-5c68-41ae-bb08-45afe771db8a")
DIPTI_ORG_ID = uuid.UUID("dbbb6f95-f4e7-4bb4-b8c3-b776aca126cf")

def generate_healthy_scenario() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generates ~5,000 records of a healthy growth business."""
    random.seed(42)
    
    # 1. Products & Inventory
    products = []
    inventory = []
    costs = []
    
    categories = ["Dresses", "Outerwear", "Knitwear", "Activewear"]
    skus = [f"HC-APP-{i:03d}" for i in range(1, 21)]
    
    for i, sku in enumerate(skus):
        name = f"Premium {categories[i % len(categories)]} Model {sku[-3:]}"
        cat = categories[i % len(categories)]
        unit_cost = round(random.uniform(15.0, 30.0), 2)
        selling_price = round(unit_cost / 0.4, 2) # ~60% margin
        stock = random.randint(150, 400)
        lead_time = random.randint(10, 20)
        
        products.append({"sku": sku, "name": name, "category": cat, "stock_on_hand": stock, "lead_time_days": lead_time})
        costs.append({"sku": sku, "unit_cost": unit_cost, "selling_price": selling_price, "supplier_name": f"TextileCorp {cat}"})
        
    df_inv = pd.DataFrame(products)
    df_cost = pd.DataFrame(costs)
    
    # 2. Sales records (~5,000 rows over 12 months with growing trend)
    sales = []
    start_date = datetime.date(2025, 6, 1)
    
    for day in range(365):
        current_date = start_date + datetime.timedelta(days=day)
        # Growth factor
        growth_multiplier = 1.0 + (day / 365) * 0.4  # +40% growth over a year
        daily_txs = int(random.randint(8, 18) * growth_multiplier)
        
        for _ in range(daily_txs):
            sku_idx = random.randint(0, len(skus) - 1)
            sku = skus[sku_idx]
            qty = random.randint(1, 4)
            unit_price = costs[sku_idx]["selling_price"]
            
            sales.append({
                "sku": sku,
                "date": current_date.strftime("%Y-%m-%d"),
                "quantity": qty,
                "unit_price": unit_price,
                "revenue": round(qty * unit_price, 2)
            })
            
    df_sales = pd.DataFrame(sales)
    # Truncate to limit size
    if len(df_sales) > 5000:
        df_sales = df_sales.sample(n=5000, random_state=42).sort_values("date")
        
    return df_inv, df_cost, df_sales

def generate_challenged_scenario() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generates ~2,000 records of a struggling business."""
    random.seed(100)
    
    # 1. Products & Inventory (High dead stock, out-of-stock bestsellers)
    products = []
    inventory = []
    costs = []
    
    # Bestsellers (out of stock)
    bestsellers = [("DD-BEST-001", "Vintage Blue Denim", 12.0, 48.0, 0, 45, "GlobalDenim China"),
                   ("DD-BEST-002", "Slim Fit Black Jeans", 14.0, 52.0, 0, 45, "GlobalDenim China")]
    
    # Slow movers (massive excess stock)
    dead_stock = [
        ("DD-DEAD-101", "Neon Yellow Denim Vest", 18.0, 22.0, 800, 30, "VestVendor Inc"), # high cost, low selling price/margin
        ("DD-DEAD-102", "Tie-Dye Overall Shorts", 20.0, 24.0, 600, 30, "VestVendor Inc"),
        ("DD-DEAD-103", "Distressed Denim Hat", 8.0, 10.0, 1000, 30, "VendorX"),
        ("DD-DEAD-104", "Fringe Denim Skirt", 22.0, 26.0, 500, 30, "VendorX")
    ]
    
    # Standard items
    standard = []
    for i in range(1, 5):
        sku = f"DD-STD-00{i}"
        unit_cost = round(random.uniform(15.0, 25.0), 2)
        selling_price = round(unit_cost / 0.75, 2) # low margin ~25%
        stock = random.randint(30, 80)
        standard.append((sku, f"Standard Denim Jacket {i}", unit_cost, selling_price, stock, 30, "Standard Mills"))

    all_items = bestsellers + dead_stock + standard
    
    for item in all_items:
        sku, name, cost, price, stock, lead, supplier = item
        products.append({"sku": sku, "name": name, "category": "Denim", "stock_on_hand": stock, "lead_time_days": lead})
        costs.append({"sku": sku, "unit_cost": cost, "selling_price": price, "supplier_name": supplier})
        
    df_inv = pd.DataFrame(products)
    df_cost = pd.DataFrame(costs)
    
    # 2. Sales records with declining volume
    sales = []
    start_date = datetime.date(2025, 6, 1)
    
    for day in range(365):
        current_date = start_date + datetime.timedelta(days=day)
        # Declining factor
        decline_multiplier = 1.0 - (day / 365) * 0.5 # -50% decline over a year
        daily_txs = int(random.randint(3, 8) * decline_multiplier)
        
        for _ in range(daily_txs):
            # Select item (mostly standard items or bestseller orders when they were temporarily in stock earlier in the year)
            # Dead stock has extremely low probability of selling
            choices = []
            # Standard items
            choices.extend([costs[i] for i in range(6, len(all_items))])
            # Bestsellers (only sold in first half of year before running out of stock)
            if day < 180:
                choices.extend([costs[0], costs[1]])
            # Dead stock (rarely sells)
            if random.random() < 0.05:
                choices.extend([costs[2], costs[3], costs[4], costs[5]])
                
            if not choices:
                continue
                
            item_cost = random.choice(choices)
            sku = item_cost["sku"]
            sku_idx = [x[0] for x in all_items].index(sku)
            qty = random.randint(1, 2)
            unit_price = item_cost["selling_price"]
            
            # Apply discounts in second half of the year
            if day > 180 and sku.startswith("DD-DEAD"):
                unit_price = round(unit_price * 0.6, 2) # 40% off clearance
                
            sales.append({
                "sku": sku,
                "date": current_date.strftime("%Y-%m-%d"),
                "quantity": qty,
                "unit_price": unit_price,
                "revenue": round(qty * unit_price, 2)
            })
            
    df_sales = pd.DataFrame(sales)
    if len(df_sales) > 2000:
        df_sales = df_sales.sample(n=2000, random_state=42).sort_values("date")
        
    return df_inv, df_cost, df_sales

def clean_org_data(db, org_id):
    """Deletes existing transaction data for the tenant before seeding."""
    print(f"Cleaning existing tables for Org: {org_id}...")
    db.execute(text("DELETE FROM sales_records WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM inventory_items WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM products WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM revenues WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM expenses WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM projects WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM clients WHERE organization_id = :oid"), {"oid": org_id})
    db.execute(text("DELETE FROM suppliers WHERE organization_id = :oid"), {"oid": org_id})
    db.commit()

def seed_finance_and_clients(db, org_id, is_healthy=True):
    """Seeds revenues, expenses, clients, and projects to align dashboards."""
    print(f"Seeding clients and ledger for Org: {org_id}...")
    
    # 1. Clients
    client_statuses = ["active", "lead", "inactive"]
    clients_data = []
    
    for i in range(1, 8):
        c = Client(
            organization_id=org_id,
            company_name=f"Retail Buyer {chr(64+i)} Ltd",
            contact_person=f"Contact {i}",
            email=f"buyer_{i}@retail.com",
            phone=f"+12345678{i}",
            industry="Apparel Retail",
            status="active" if i < 5 else ("lead" if i < 7 else "inactive")
        )
        db.add(c)
        clients_data.append(c)
    db.flush()
    
    # 2. Projects
    projects = []
    for idx, client in enumerate(clients_data[:3]):
        p = Project(
            organization_id=org_id,
            client_id=client.id,
            name=f"Season Rollout Project {idx+1}",
            status="active" if idx < 2 else "completed",
            budget=50000.0 if is_healthy else 15000.0,
            start_date=datetime.date(2025, 1, 1),
            deadline=datetime.date(2026, 12, 31)
        )
        db.add(p)
        projects.append(p)
    db.flush()
    
    # 3. Revenues & Expenses
    for idx, p in enumerate(projects):
        rev = Revenue(
            organization_id=org_id,
            project_id=p.id,
            amount=25000.0 if is_healthy else 8000.0,
            date=datetime.datetime(2025, 8, 1, 12, 0, 0),
            description=f"Phase 1 payment for project {p.name}"
        )
        db.add(rev)
        
    overhead_amount = 3000.0 if is_healthy else 12000.0 # higher overhead for challenged
    exp = Expense(
        organization_id=org_id,
        amount=overhead_amount,
        category="Rent & Overhead" if is_healthy else "Warehouse Storage Penalty",
        description="Monthly operations logistics overhead",
        date=datetime.datetime(2025, 9, 1, 12, 0, 0)
    )
    db.add(exp)
    db.commit()

def seed_scenario(db, org_id, is_healthy=True):
    clean_org_data(db, org_id)
    
    # Generate scenario
    if is_healthy:
        print("\n=== Generating HEALTHY scenario for DEV ===")
        df_inv, df_cost, df_sales = generate_healthy_scenario()
    else:
        print("\n=== Generating CHALLENGED scenario for DIPTI ===")
        df_inv, df_cost, df_sales = generate_challenged_scenario()
        
    print(f"  Inventory items: {len(df_inv)}")
    print(f"  Sales records: {len(df_sales)}")
    
    # Ingest using ImporterService
    print("  Importing products & inventory...")
    report_inv = ImporterService.import_inventory(db, org_id, df_inv)
    print(f"    Status: {report_inv['status']}, Count: {report_inv['processed_count']}")
    
    print("  Importing supplier costs...")
    report_cost = ImporterService.import_costs(db, org_id, df_cost)
    print(f"    Status: {report_cost['status']}, Count: {report_cost['processed_count']}")
    
    print("  Importing sales orders...")
    report_sales = ImporterService.import_sales(db, org_id, df_sales)
    print(f"    Status: {report_sales['status']}, Count: {report_sales['processed_count']}")
    
    # Seed ledger and clients
    seed_finance_and_clients(db, org_id, is_healthy)

def seed_demo_workspace_data(db, org_id):
    """
    Seeds a fully preloaded demo workspace including inventory, finance,
    sample documents, chat conversations, and recommendations.
    """
    # 1. Seed standard healthy inventory and ledger scenario
    seed_scenario(db, org_id, is_healthy=True)

    # 2. Seed Sample Documents
    doc1 = ProcessedDocument(
        id=uuid.uuid4(),
        organization_id=org_id,
        filename="supplier_invoice_cotton.pdf",
        content_type="application/pdf",
        file_size=12543,
        status="completed",
        document_type="Purchase Invoice",
        classification_confidence=0.98,
        extracted_data={
            "invoice_number": "INV-2026-0001",
            "invoice_date": "2026-06-14",
            "supplier_name": "Premium Cotton Textiles Ltd",
            "customer_name": "Aether Apparel",
            "items": [
                {
                    "product_name": "Premium Cotton Roll (Black)",
                    "sku": "FABRIC-COTTON-01",
                    "quantity": 100,
                    "unit_price": 25.0
                }
            ],
            "tax": 250.0,
            "total_amount": 2750.0
        },
        quality_assessment={
            "quality_score": 95.0,
            "issues": []
        },
        coo_insights={
            "summary": "Purchase invoice for FABRIC-COTTON-01 processed successfully. Unit cost of $25.0 is in line with supplier agreements. Margin impact is minimal given D2C target pricing of $85.0.",
            "risks": [],
            "opportunities": [
                {"description": "Establish volume discounts on FABRIC-COTTON-01 if ordering > 500 rolls", "value_potential": 1250}
            ],
            "recommendations": [
                "Approve payment for INV-2026-0001 before 2026-07-14 to capture 2% early payment discount."
            ]
        },
        file_path="uploads/demo_invoice.pdf"
    )
    
    doc2 = ProcessedDocument(
        id=uuid.uuid4(),
        organization_id=org_id,
        filename="june_sales_report.csv",
        content_type="text/csv",
        file_size=4892,
        status="completed",
        document_type="Sales Report",
        classification_confidence=0.99,
        extracted_data={
            "sales_records": [
                {"sku": "TSHIRT-CLASSIC", "quantity": 120, "date": "2026-06-14", "unit_price": 25.0, "revenue": 3000.0}
            ]
        },
        quality_assessment={
            "quality_score": 98.0,
            "issues": []
        },
        coo_insights={
            "summary": "Classic Tee (TSHIRT-CLASSIC) sales volume surged by 15% week-over-week. Inventory levels are fast approaching the safety stock threshold.",
            "risks": [
                {"description": "Potential stockout of TSHIRT-CLASSIC within 12 days if current sales velocity persists.", "impact_level": "high"}
            ],
            "opportunities": [],
            "recommendations": [
                "Trigger immediate reorder of 500 units of TSHIRT-CLASSIC to prevent inventory gap."
            ]
        },
        file_path="uploads/demo_sales.csv"
    )
    db.add_all([doc1, doc2])
    db.flush()

    # 3. Seed Sample Conversations
    conv1 = ExecutiveConversation(
        id=uuid.uuid4(),
        organization_id=org_id,
        title="Strategic Q&A on Cash Flow"
    )
    db.add(conv1)
    db.flush()
    
    msg1_1 = ExecutiveMessage(
        id=uuid.uuid4(),
        conversation_id=conv1.id,
        role="user",
        content="How is our cash flow looking for the next 30 days?",
        created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=2)
    )
    msg1_2 = ExecutiveMessage(
        id=uuid.uuid4(),
        conversation_id=conv1.id,
        role="assistant",
        content="Based on our current ledger, we have $48,000 available capital and $12,000 in upcoming rent & logistics overhead. Revenues from Season Rollout Project 1 are expected to bring in $25,000, leaving us with a healthy capital surplus of $61,000. No immediate cash flow risks detected.",
        agent_data={
            "reasoning_summary": "Synthesized available balances, projects timeline, and overhead logs.",
            "data_used": ["Revenues", "Expenses", "Projects"],
            "risk_factors": [],
            "opportunity_factors": ["Project Rollout Payments"],
            "confidence_level": 0.98,
            "agent_sources": ["finance"]
        },
        created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=2) + datetime.timedelta(seconds=30)
    )
    db.add_all([msg1_1, msg1_2])

    conv2 = ExecutiveConversation(
        id=uuid.uuid4(),
        organization_id=org_id,
        title="Inventory Optimization Strategy"
    )
    db.add(conv2)
    db.flush()

    msg2_1 = ExecutiveMessage(
        id=uuid.uuid4(),
        conversation_id=conv2.id,
        role="user",
        content="What are the top reorder priorities for Aether Apparel?",
        created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    )
    msg2_2 = ExecutiveMessage(
        id=uuid.uuid4(),
        conversation_id=conv2.id,
        role="assistant",
        content="Our primary bottleneck is TSHIRT-CLASSIC. Stock on hand is currently 80 units, and our lead time from TextileCorp is 7 days. At our current average D2C sales velocity of 20 units/day, we will experience a stockout in 4 days. I recommend placing an immediate purchase order for 500 units of Premium Cotton rolls (FABRIC-COTTON-01) to support replenishing manufacturing lines.",
        agent_data={
            "reasoning_summary": "Calculated current sales velocity, safety stock limits, and lead times.",
            "data_used": ["InventoryItem (TSHIRT-CLASSIC)", "Sales Records"],
            "risk_factors": ["Stockout of bestseller TSHIRT-CLASSIC"],
            "opportunity_factors": ["Bulk fabric pricing optimization"],
            "confidence_level": 0.95,
            "agent_sources": ["operations", "coo"]
        },
        created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=1) + datetime.timedelta(seconds=30)
    )
    db.add_all([msg2_1, msg2_2])

    # 4. Seed Sample AI Recommendations
    rec1 = AIRecommendation(
        id=uuid.uuid4(),
        organization_id=org_id,
        agent_source="coo",
        recommendation="Trigger immediate reorder of 500 units of Classic Tee (TSHIRT-CLASSIC) fabric rolls to prevent stockout.",
        reasoning_summary="Current stock on hand (80 units) will support only 4 days of sales, while the supplier lead time is 7 days.",
        data_used=["InventoryItem (TSHIRT-CLASSIC)", "Sales Records"],
        risk_factors=["Revenue loss of ~$12,500 due to stockout"],
        opportunity_factors=["Optimize logistics cost by bundling shipments"],
        confidence_level=0.95,
        expected_outcome="Maintain uninterrupted D2C sales operations."
    )
    rec2 = AIRecommendation(
        id=uuid.uuid4(),
        organization_id=org_id,
        agent_source="finance",
        recommendation="Approve payment for invoice INV-2026-0001 early to capture 2% terms discount.",
        reasoning_summary="Paying before 2026-07-14 saves $55.0 on cotton rolls invoice with no adverse cash flow impact.",
        data_used=["ProcessedDocument (INV-2026-0001)"],
        risk_factors=["Late fees if delayed beyond 30 days"],
        opportunity_factors=["Capture 2% early settlement discount"],
        confidence_level=0.98,
        expected_outcome="Save $55.0 on textile vendor costs."
    )
    db.add_all([rec1, rec2])
    db.commit()

def main():
    db = SessionLocal()
    try:
        # Seed Workspace A (DEV) -> Healthy
        seed_scenario(db, DEV_ORG_ID, is_healthy=True)
        
        # Seed Workspace B (Dipti) -> Challenged
        seed_scenario(db, DIPTI_ORG_ID, is_healthy=False)
        
        print("\nAll scenarios successfully seeded!")
    except Exception as e:
        print(f"Seeding failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
