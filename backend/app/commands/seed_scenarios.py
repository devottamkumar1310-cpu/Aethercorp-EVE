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
from app.models.task import Task
from app.models.document import ProcessedDocument
from app.models.executive_conversation import ExecutiveConversation, ExecutiveMessage

DEV_ORG_ID = uuid.UUID("ea337dee-5c68-41ae-bb08-45afe771db8a")
DIPTI_ORG_ID = uuid.UUID("dbbb6f95-f4e7-4bb4-b8c3-b776aca126cf")

def generate_healthy_scenario() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generates ~5,000 records of a healthy growth business."""
    random.seed(42)
    
    # 1. Products & Inventory
    products = []
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
    start_date = datetime.date.today() - datetime.timedelta(days=365)
    
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
    costs = []
    
    # Bestsellers (out of stock)
    bestsellers = [("DD-BEST-001", "Vintage Blue Denim", 12.0, 48.0, 0, 45, "GlobalDenim China", "Denim"),
                   ("DD-BEST-002", "Slim Fit Black Jeans", 14.0, 52.0, 0, 45, "GlobalDenim China", "Denim")]
    
    # Slow movers (massive excess stock)
    dead_stock = [
        ("DD-DEAD-101", "Neon Yellow Denim Vest", 18.0, 22.0, 800, 30, "VestVendor Inc", "Denim"),
        ("DD-DEAD-102", "Tie-Dye Overall Shorts", 20.0, 24.0, 600, 30, "VestVendor Inc", "Denim"),
        ("DD-DEAD-103", "Distressed Denim Hat", 8.0, 10.0, 1000, 30, "VendorX", "Denim"),
        ("DD-DEAD-104", "Fringe Denim Skirt", 22.0, 26.0, 500, 30, "VendorX", "Denim")
    ]
    
    # Standard items (Apparel Variants)
    standard = []
    
    # Variant Group 1: Summer Shirt
    standard.append(("SS-WHT-S", "Summer Shirt - White / S", 12.0, 35.0, 20, 15, "Standard Mills", "Tops"))
    standard.append(("SS-WHT-M", "Summer Shirt - White / M", 12.0, 35.0, 45, 15, "Standard Mills", "Tops"))
    standard.append(("SS-WHT-L", "Summer Shirt - White / L", 12.0, 35.0, 10, 15, "Standard Mills", "Tops"))
    
    # Variant Group 2: Basic Chinos
    standard.append(("BC-KHK-30", "Basic Chinos - Khaki / 30", 18.0, 55.0, 15, 20, "Standard Mills", "Bottoms"))
    standard.append(("BC-KHK-32", "Basic Chinos - Khaki / 32", 18.0, 55.0, 40, 20, "Standard Mills", "Bottoms"))
    standard.append(("BC-KHK-34", "Basic Chinos - Khaki / 34", 18.0, 55.0, 35, 20, "Standard Mills", "Bottoms"))
    standard.append(("BC-KHK-36", "Basic Chinos - Khaki / 36", 18.0, 55.0, 5, 20, "Standard Mills", "Bottoms"))
    
    # Variant Group 3: Outerwear
    standard.append(("WJ-BLK-M", "Winter Jacket - Black / M", 45.0, 120.0, 8, 30, "Outerwear Co", "Outerwear"))
    standard.append(("WJ-BLK-L", "Winter Jacket - Black / L", 45.0, 120.0, 12, 30, "Outerwear Co", "Outerwear"))

    # Extra D2C items to eliminate catalog disconnects
    extra_items = [
        ("TSHIRT-CLASSIC", "Classic Tee", 10.0, 25.0, 80, 7, "Premium Cotton Textiles Ltd", "Tops"),
        ("FABRIC-COTTON-01", "Premium Cotton Fabric", 25.0, 85.0, 100, 10, "Premium Cotton Textiles Ltd", "Raw Materials")
    ]

    all_items = bestsellers + dead_stock + standard + extra_items
    
    for item in all_items:
        sku, name, cost, price, stock, lead, supplier, category = item
        products.append({"sku": sku, "name": name, "category": category, "stock_on_hand": stock, "lead_time_days": lead})
        costs.append({"sku": sku, "unit_cost": cost, "selling_price": price, "supplier_name": supplier})
        
    df_inv = pd.DataFrame(products)
    df_cost = pd.DataFrame(costs)
    
    # 2. Sales records with declining volume
    sales = []
    start_date = datetime.date.today() - datetime.timedelta(days=365)
    
    for day in range(365):
        current_date = start_date + datetime.timedelta(days=day)
        # Declining factor
        decline_multiplier = 1.0 - (day / 365) * 0.5 # -50% decline over a year
        daily_txs = int(random.randint(3, 8) * decline_multiplier)
        
        for _ in range(daily_txs):
            # Select item dynamically by SKU prefixes/values instead of brittle index positions
            choices = []
            
            # Standard items and apparel variants
            std_choices = [c for c in costs if c["sku"].startswith("DD-STD-") or c["sku"].startswith("SS-") or c["sku"].startswith("BC-") or c["sku"].startswith("WJ-")]
            choices.extend(std_choices)
            
            # TSHIRT-CLASSIC also sells regularly (finished garment)
            tshirt_choices = [c for c in costs if c["sku"] == "TSHIRT-CLASSIC"]
            choices.extend(tshirt_choices)

            # Bestsellers (only sold in first half of year before running out of stock)
            if day < 180:
                best_choices = [c for c in costs if c["sku"].startswith("DD-BEST-")]
                choices.extend(best_choices)

            # Dead stock (rarely sells)
            if random.random() < 0.05:
                dead_choices = [c for c in costs if c["sku"].startswith("DD-DEAD-")]
                choices.extend(dead_choices)
                
            if not choices:
                continue
                
            item_cost = random.choice(choices)
            sku = item_cost["sku"]
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
    if is_healthy:
        for idx, client in enumerate(clients_data[:3]):
            p = Project(
                organization_id=org_id,
                client_id=client.id,
                name=f"Season Rollout Project {idx+1}",
                status="active" if idx < 2 else "completed",
                budget=50000.0,
                start_date=datetime.date(2025, 1, 1),
                deadline=datetime.date(2026, 12, 31)
            )
            db.add(p)
            projects.append(p)
        db.flush()
    else:
        # Find a user profile in this org to assign tasks to (bottleneck simulation)
        profile = db.query(Profile).join(Membership).filter(Membership.organization_id == org_id).first()
        assigned_to_id = profile.id if profile else None
        
        # Project A: 85% complete, deadline in 5 days, 8 overdue tasks
        p_a = Project(
            organization_id=org_id,
            client_id=clients_data[0].id,
            name="Project A (Season Rollout 1)",
            status="active",
            budget=15000.0,
            completion_percentage=85.0,
            start_date=datetime.date(2025, 1, 1),
            deadline=datetime.date.today() + datetime.timedelta(days=5)
        )
        db.add(p_a)
        db.flush()
        projects.append(p_a)
        
        # Seed 8 overdue tasks for Project A
        for i in range(8):
            t = Task(
                organization_id=org_id,
                project_id=p_a.id,
                title=f"Critical Overdue Milestone A.{i+1}",
                status="todo" if i % 2 == 0 else "in_progress",
                priority="high" if i < 4 else "critical",
                due_date=datetime.datetime.utcnow() - datetime.timedelta(days=2 + i),
                assigned_to=assigned_to_id
            )
            db.add(t)
            
        # Project B: 40% complete, deadline in 14 days, resource bottleneck
        p_b = Project(
            organization_id=org_id,
            client_id=clients_data[1].id,
            name="Project B (Season Rollout 2)",
            status="active",
            budget=15000.0,
            completion_percentage=40.0,
            start_date=datetime.date(2025, 1, 1),
            deadline=datetime.date.today() + datetime.timedelta(days=14)
        )
        db.add(p_b)
        db.flush()
        projects.append(p_b)
        
        # Resource bottleneck: several open tasks assigned to the same user
        for i in range(6):
            t = Task(
                organization_id=org_id,
                project_id=p_b.id,
                title=f"Bottlenecked Task B.{i+1}",
                status="in_progress" if i < 3 else "todo",
                priority="medium" if i % 2 == 0 else "high",
                due_date=datetime.datetime.utcnow() - datetime.timedelta(days=1 + i) if i < 2 else datetime.datetime.utcnow() + datetime.timedelta(days=2 + i),
                assigned_to=assigned_to_id
            )
            db.add(t)
            
        for i in range(2):
            t = Task(
                organization_id=org_id,
                project_id=p_b.id,
                title=f"Completed Setup B.{i+1}",
                status="completed",
                priority="low",
                due_date=datetime.datetime.utcnow() - datetime.timedelta(days=10 + i),
                assigned_to=assigned_to_id
            )
            db.add(t)
            
        # Project C: Healthy project, on track (completion 70%, deadline in 60 days, 0 overdue tasks)
        p_c = Project(
            organization_id=org_id,
            client_id=clients_data[2].id,
            name="Project C (Season Rollout 3)",
            status="active",
            budget=15000.0,
            completion_percentage=70.0,
            start_date=datetime.date(2025, 1, 1),
            deadline=datetime.date.today() + datetime.timedelta(days=60)
        )
        db.add(p_c)
        db.flush()
        projects.append(p_c)
        
        for i in range(3):
            t = Task(
                organization_id=org_id,
                project_id=p_c.id,
                title=f"Future Task C.{i+1}",
                status="todo",
                priority="medium",
                due_date=datetime.datetime.utcnow() + datetime.timedelta(days=20 + i * 10),
                assigned_to=assigned_to_id
            )
            db.add(t)
            
        for i in range(7):
            t = Task(
                organization_id=org_id,
                project_id=p_c.id,
                title=f"Healthy Completed Milestone C.{i+1}",
                status="completed",
                priority="medium",
                due_date=datetime.datetime.utcnow() - datetime.timedelta(days=5 + i * 2),
                assigned_to=assigned_to_id
            )
            db.add(t)
            
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
        
    if is_healthy:
        db.add(Expense(
            organization_id=org_id,
            amount=1500.0,
            category="Shopify App Fees",
            description="Shopify monthly platform subscription and apps",
            date=datetime.datetime(2025, 9, 1, 12, 0, 0)
        ))
        db.add(Expense(
            organization_id=org_id,
            amount=1500.0,
            category="Meta Advertising Ads",
            description="Acquisition spend for Summer collection launch",
            date=datetime.datetime(2025, 9, 1, 12, 0, 0)
        ))
    else:
        db.add(Expense(
            organization_id=org_id,
            amount=6000.0,
            category="Warehouse Storage Penalty",
            description="Storage penalties for dead stock (Yellow Vests / Overalls)",
            date=datetime.datetime(2025, 9, 1, 12, 0, 0)
        ))
        db.add(Expense(
            organization_id=org_id,
            amount=4000.0,
            category="Meta Advertising Ads",
            description="Acquisition spend for Denim collection clearance runs",
            date=datetime.datetime(2025, 9, 1, 12, 0, 0)
        ))
        db.add(Expense(
            organization_id=org_id,
            amount=2000.0,
            category="Freight Forwarder Surcharges",
            description="Fuel surcharges on raw materials import",
            date=datetime.datetime(2025, 9, 1, 12, 0, 0)
        ))
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

def seed_demo_workspace_data(db, org_id, demo_company="novawear"):
    """
    Seeds a fully preloaded demo workspace including inventory, finance,
    sample documents, chat conversations, and recommendations.
    """
    company_name = "NovaWear Fashion"
    if demo_company == "urban_threads":
        company_name = "Urban Threads"
    elif demo_company == "essentials_co":
        company_name = "Essentials Co."

    # 1. Seed standard challenged inventory and ledger scenario
    # We will use the challenged scenario for novawear to show proactive alerts, 
    # and maybe healthy for others, or just use challenged for all to show off features.
    is_healthy = False if demo_company == "novawear" else True
    seed_scenario(db, org_id, is_healthy=is_healthy)

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
            "customer_name": company_name,
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
        content=f"What are the top reorder priorities for {company_name}?",
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

    # 4. Generate deterministic recommendation traces for the demo
    seed_demo_recommendation_traces(db, org_id)

    db.commit()

def seed_demo_recommendation_traces(db, org_id):
    from app.models.recommendation_trace import RecommendationTrace
    import random
    
    traces = []
    actions = [
        ("Reduce reorder quantity", "Reduce the next purchase order by 35%."),
        ("Liquidate aging inventory", "Run a 20% promotion on aging seasonal items."),
        ("Increase safety stock", "Increase safety stock for fast-moving items by 15 days."),
        ("Delay purchase order", "Delay the upcoming purchase order by 2 weeks."),
        ("Bundle slow-moving products", "Create product bundles with high-margin fast movers."),
        ("Reallocate warehouse inventory", "Shift 20% of east coast stock to west coast distribution center."),
        ("Increase reorder frequency", "Switch to weekly ordering to reduce carrying costs."),
        ("Reduce markdown timing", "Apply markdowns 2 weeks earlier to improve sell-through."),
        ("Review supplier lead times", "Renegotiate lead times with secondary suppliers."),
        ("Investigate declining SKU", "Review marketing spend on underperforming SKU categories.")
    ]
    
    for action_title, action_desc in actions:
        confidence = round(random.uniform(0.75, 0.98), 2)
        trace = RecommendationTrace(
            organization_id=org_id,
            recommendation_type="inventory",
            action=action_title,
            confidence_score=confidence,
            validation_status="GENERATED",
            source_datasets=["Inventory", "Sales", "Supplier Data"],
            supporting_metrics={
                "Inventory Days": f"{random.randint(45, 120)} days",
                "Sales Velocity": f"{random.randint(10, 50)} units/day",
                "Gross Margin": f"{random.randint(30, 65)}%"
            },
            reasoning_chain=[
                "Observed: Sales declining or inventory increasing.",
                "Inference: Current purchasing policy is likely to create excess inventory.",
                "Risk: Estimated carrying cost increase.",
                f"Recommendation: {action_desc}",
                "Expected Business Outcome: Cash released and margin improvement."
            ],
            evidence_snapshot={
                "summary": "Demand has shifted over the last four weeks. Maintaining current purchasing behavior is likely to increase carrying costs.",
                "impact": f"${random.randint(1000, 25000)} potential capital freed."
            },
            trigger_type="SYSTEM_ALERT",
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
        print(f"Creating missing Organization: {name} ({org_id})")
        org = Organization(id=org_id, name=name, slug=slug)
        db.add(org)
        db.flush()
        
    if user_id is None:
        user_id = uuid.uuid4()
        
    prof = db.query(Profile).filter(Profile.id == user_id).first()
    if not prof:
        prof_email = db.query(Profile).filter(Profile.email == email).first()
        if prof_email:
            prof = prof_email
        else:
            print(f"Creating missing Profile: {email} ({user_id})")
            prof = Profile(
                id=user_id,
                email=email,
                hashed_password="scrypt:32768:8:1$placeholder$hashedpassword",
                full_name=name + " Admin",
                is_active=True
            )
            db.add(prof)
            db.flush()
            
    member = db.query(Membership).filter(
        Membership.organization_id == org_id,
        Membership.user_id == prof.id
    ).first()
    if not member:
        print(f"Creating missing Membership for Org {org_id} and User {prof.id}")
        member = Membership(
            organization_id=org_id,
            user_id=prof.id,
            role="owner"
        )
        db.add(member)
        db.flush()
    db.commit()

def main():
    db = SessionLocal()
    try:
        # Ensure workspaces/users exist first
        ensure_organization_and_user(
            db, 
            DEV_ORG_ID, 
            "Dev Workspace", 
            "dev-workspace", 
            "dev@aethercorp.com"
        )
        ensure_organization_and_user(
            db, 
            DIPTI_ORG_ID, 
            "NovaWear Fashion", 
            "novawear", 
            "dipti@novawear.com", 
            uuid.UUID("9e3f929a-2e59-487f-a827-82ce8df09594")
        )

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
