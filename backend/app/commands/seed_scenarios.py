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

def generate_novawear_scenario() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generates a healthy growth business (NovaWear). Focus: Optimization."""
    random.seed(42)
    products = []
    costs = []
    
    categories = ["Dresses", "Outerwear", "Knitwear", "Activewear"]
    skus = [f"NW-OPT-{i:03d}" for i in range(1, 21)]
    
    for i, sku in enumerate(skus):
        name = f"NovaWear {categories[i % len(categories)]} Model {sku[-3:]}"
        cat = categories[i % len(categories)]
        unit_cost = round(random.uniform(15.0, 30.0), 2)
        selling_price = round(unit_cost / 0.4, 2)
        
        # Healthy stock, but some could use tuning
        stock = random.randint(150, 400)
        if i == 0: stock = 120 # Slightly low, needs tuning
        if i == 1: stock = 450 # Slightly high, needs tuning
        
        lead_time = random.randint(10, 20)
        products.append({"sku": sku, "name": name, "category": cat, "stock_on_hand": stock, "lead_time_days": lead_time})
        costs.append({"sku": sku, "unit_cost": unit_cost, "selling_price": selling_price, "supplier_name": f"TextileCorp {cat}"})
        
    df_inv = pd.DataFrame(products)
    df_cost = pd.DataFrame(costs)
    
    sales = []
    start_date = datetime.date.today() - datetime.timedelta(days=365)
    
    for day in range(365):
        current_date = start_date + datetime.timedelta(days=day)
        growth_multiplier = 1.0 + (day / 365) * 0.4
        daily_txs = int(random.randint(8, 18) * growth_multiplier)
        
        for _ in range(daily_txs):
            sku_idx = random.randint(0, len(skus) - 1)
            sku = skus[sku_idx]
            qty = random.randint(1, 4)
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
    """Generates an inventory crisis business (Urban Threads). Focus: Recovery."""
    random.seed(100)
    products = []
    costs = []
    
    dead_stock = [
        ("UT-DEAD-101", "Neon Yellow Denim Vest", 18.0, 22.0, 800, 30, "VestVendor Inc", "Denim"),
        ("UT-DEAD-102", "Tie-Dye Overall Shorts", 20.0, 24.0, 600, 30, "VestVendor Inc", "Denim"),
        ("UT-DEAD-103", "Distressed Denim Hat", 8.0, 10.0, 1000, 30, "VendorX", "Denim")
    ]
    standard = [
        ("UT-STD-001", "Basic Chinos - Khaki", 18.0, 55.0, 15, 20, "Standard Mills", "Bottoms"),
        ("UT-STD-002", "Basic Chinos - Black", 18.0, 55.0, 10, 20, "Standard Mills", "Bottoms")
    ]
    all_items = dead_stock + standard
    
    for item in all_items:
        sku, name, cost, price, stock, lead, supplier, category = item
        products.append({"sku": sku, "name": name, "category": category, "stock_on_hand": stock, "lead_time_days": lead})
        costs.append({"sku": sku, "unit_cost": cost, "selling_price": price, "supplier_name": supplier})
        
    df_inv = pd.DataFrame(products)
    df_cost = pd.DataFrame(costs)
    
    sales = []
    start_date = datetime.date.today() - datetime.timedelta(days=365)
    
    for day in range(365):
        current_date = start_date + datetime.timedelta(days=day)
        decline_multiplier = 1.0 - (day / 365) * 0.5
        daily_txs = int(random.randint(3, 8) * decline_multiplier)
        
        for _ in range(daily_txs):
            # Dead stock has zero sales in the last 65 days to ensure dead_stock alert detection
            choices = [c for c in costs if c["sku"].startswith("UT-STD")]
            if day < 300 and random.random() < 0.05:
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
    if len(df_sales) > 2000:
        df_sales = df_sales.sample(n=2000, random_state=42).sort_values("date")
        
    return df_inv, df_cost, df_sales


def generate_essentials_co_scenario() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generates a hyper-growth business (Essentials Co). Focus: Growth, preventing stockouts."""
    random.seed(999)
    products = []
    costs = []
    
    fast_movers = [
        ("EC-FAST-001", "Everyday White Tee", 6.0, 20.0, 15, 10, "SpeedyTextiles", "Tops"),
        ("EC-FAST-002", "Everyday Black Tee", 6.0, 20.0, 5, 10, "SpeedyTextiles", "Tops"),
        ("EC-FAST-003", "Essential Hoodie", 15.0, 45.0, 0, 14, "SpeedyTextiles", "Outerwear"),
        ("EC-FAST-004", "Essential Sweatpants", 12.0, 40.0, 8, 14, "SpeedyTextiles", "Bottoms")
    ]
    
    for item in fast_movers:
        sku, name, cost, price, stock, lead, supplier, category = item
        products.append({"sku": sku, "name": name, "category": category, "stock_on_hand": stock, "lead_time_days": lead, "reorder_point": 25})
        costs.append({"sku": sku, "unit_cost": cost, "selling_price": price, "supplier_name": supplier})
        
    df_inv = pd.DataFrame(products)
    df_cost = pd.DataFrame(costs)
    
    sales = []
    start_date = datetime.date.today() - datetime.timedelta(days=365)
    
    for day in range(365):
        current_date = start_date + datetime.timedelta(days=day)
        # Hyper growth
        growth_multiplier = 1.0 + (day / 365) * 1.5
        daily_txs = int(random.randint(15, 30) * growth_multiplier)
        
        for _ in range(daily_txs):
            item_cost = random.choice(costs)
            sku = item_cost["sku"]
            qty = random.randint(2, 6) # high volume
            unit_price = item_cost["selling_price"]
            
            sales.append({
                "sku": sku, "date": current_date.strftime("%Y-%m-%d"),
                "quantity": qty, "unit_price": unit_price, "revenue": round(qty * unit_price, 2)
            })
            
    df_sales = pd.DataFrame(sales)
    if len(df_sales) > 5000:
        df_sales = df_sales.sample(n=5000, random_state=42).sort_values("date")
        
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

    company_name = "NovaWear Fashion"
    if demo_company == "urban_threads": company_name = "Urban Threads"
    if demo_company == "essentials_co": company_name = "Essentials Co."

    # Documents and Conversations specific to scenario
    if demo_company == "urban_threads":
        doc = ProcessedDocument(
            id=uuid.uuid4(), organization_id=org_id, filename="warehouse_fees_q2.pdf", content_type="application/pdf", file_size=15000,
            status="completed", document_type="Invoice", classification_confidence=0.99,
            extracted_data={"total_amount": 6000.0, "supplier_name": "StoragePro Inc"}, quality_assessment={"quality_score": 95.0, "issues": []},
            coo_insights={
                "summary": "Storage penalty invoice processed. Dead stock is increasing carrying costs significantly.",
                "risks": [{"description": "Working capital locked in aged inventory.", "impact_level": "high"}],
                "opportunities": [],
                "recommendations": ["Liquidate UT-DEAD series items to reduce next month's storage footprint."]
            }, file_path="uploads/warehouse.pdf"
        )
        db.add(doc)
    elif demo_company == "essentials_co":
        doc = ProcessedDocument(
            id=uuid.uuid4(), organization_id=org_id, filename="supplier_expedited_shipping.pdf", content_type="application/pdf", file_size=12000,
            status="completed", document_type="Invoice", classification_confidence=0.99,
            extracted_data={"total_amount": 8000.0, "supplier_name": "SpeedyTextiles Logistics"}, quality_assessment={"quality_score": 98.0, "issues": []},
            coo_insights={
                "summary": "Expedited air freight charges to prevent stockout of EC-FAST-001.",
                "risks": [{"description": "High freight costs eroding gross margins.", "impact_level": "medium"}],
                "opportunities": [{"description": "Improve demand forecasting to switch back to ocean freight.", "value_potential": 5000}],
                "recommendations": ["Increase safety stock on fast movers to avoid rush shipping."]
            }, file_path="uploads/freight.pdf"
        )
        db.add(doc)
    else: # NovaWear
        doc = ProcessedDocument(
            id=uuid.uuid4(), organization_id=org_id, filename="q3_optimization_plan.pdf", content_type="application/pdf", file_size=12000,
            status="completed", document_type="Report", classification_confidence=0.95,
            extracted_data={"title": "Q3 Target Metrics"}, quality_assessment={"quality_score": 99.0, "issues": []},
            coo_insights={
                "summary": "Q3 Optimization plan looks solid. Current inventory turnover is healthy, but we can fine-tune reorder points.",
                "risks": [], "opportunities": [{"description": "Adjust NW-OPT safety stocks for 2% margin gain.", "value_potential": 2000}],
                "recommendations": ["Review EOQ (Economic Order Quantity) for top 5 SKUs."]
            }, file_path="uploads/q3_plan.pdf"
        )
        db.add(doc)
        
    db.flush()

    conv = ExecutiveConversation(id=uuid.uuid4(), organization_id=org_id, title="Strategy Review")
    db.add(conv)
    db.flush()
    
    if demo_company == "urban_threads":
        q = "How do we fix our cash flow?"
        a = "We need to immediately address the working capital locked in dead stock. SKUs like UT-DEAD-101 and UT-DEAD-102 have not moved in months. I recommend a 40% markdown clearance to free up space and cash."
    elif demo_company == "essentials_co":
        q = "Why are we losing revenue?"
        a = "We are consistently stocking out of our bestsellers like the Everyday White Tee. Our sales velocity has outpaced our reorder frequency. I recommend increasing our order volumes by 30% and raising safety stock."
    else:
        q = "How can we optimize our current performance?"
        a = "Our baseline is very healthy. To optimize further, we should fine-tune our replenishment timing. For example, slightly increasing the reorder point on NW-OPT-001 while holding less safety stock on slower variants will improve capital efficiency."

    msg1 = ExecutiveMessage(id=uuid.uuid4(), conversation_id=conv.id, role="user", content=q, created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=1))
    msg2 = ExecutiveMessage(id=uuid.uuid4(), conversation_id=conv.id, role="assistant", content=a, agent_data={}, created_at=datetime.datetime.utcnow())
    db.add_all([msg1, msg2])
    db.flush()

    seed_demo_recommendation_traces(db, org_id, demo_company)
    db.commit()


def seed_demo_recommendation_traces(db, org_id, demo_company):
    from app.models.recommendation_trace import RecommendationTrace
    from app.models.inventory import InventoryItem
    from sqlalchemy.orm import joinedload
    
    traces = []
    inventory_items = db.query(InventoryItem).options(joinedload(InventoryItem.product)).filter(InventoryItem.organization_id == org_id).all()
    
    for item in inventory_items:
        if demo_company == "urban_threads" and item.stock_on_hand > 500:
            trace = RecommendationTrace(
                recommendation_id=f"REC-{org_id.hex[:4]}-D{item.product.sku}", organization_id=org_id,
                recommendation_type="dead_stock", action=f"Liquidate {item.product.sku}", status="Generated", version=1, priority="High",
                related_skus=[item.product.sku], estimated_financial_impact=float(item.stock_on_hand * item.product.unit_cost),
                confidence_score=0.95, validation_status="GENERATED", source_datasets=["Inventory", "Sales"],
                supporting_metrics={"Inventory Days": f"{round(item.stock_on_hand / max(1.0, item.avg_daily_sales))} days", "Current Stock": f"{item.stock_on_hand} units"},
                reasoning_chain=[
                    f"Observed: SKU {item.product.sku} has {item.stock_on_hand} units gathering dust.",
                    "Inference: SKU has not sold consistently. Working capital is locked.",
                    "Risk: High warehouse storage fees and cash crunch.",
                    "Recommendation: Apply aggressive markdown pricing immediately to liquidate.",
                    "Expected Business Outcome: Recover cash flow and reduce excess inventory."
                ],
                evidence_snapshot={"summary": "Dead stock tying up capital.", "impact": f"${round(item.stock_on_hand * item.product.unit_cost)} potential recovery."},
                trigger_type="SYSTEM_ALERT", created_from_query=False
            )
            traces.append(trace)
            
        elif demo_company == "essentials_co" and item.stock_on_hand < (item.avg_daily_sales * item.lead_time_days) + 20:
            shortage = round((item.avg_daily_sales * item.lead_time_days) * 1.5)
            trace = RecommendationTrace(
                recommendation_id=f"REC-{org_id.hex[:4]}-G{item.product.sku}", organization_id=org_id,
                recommendation_type="low_stock", action=f"Aggressively Increase Reorder for {item.product.sku}", status="Generated", version=1, priority="High",
                related_skus=[item.product.sku], estimated_financial_impact=float(shortage * item.product.selling_price),
                confidence_score=0.98, validation_status="GENERATED", source_datasets=["Inventory", "Sales"],
                supporting_metrics={"Sales Velocity": f"{item.avg_daily_sales} units/day", "Suggested Reorder": f"{shortage} units"},
                reasoning_chain=[
                    f"Observed: Average daily sales ({item.avg_daily_sales}/day) exceed historical reorder thresholds.",
                    "Inference: Demand is outpacing supply. Stockout expected within days.",
                    "Risk: Severe missed revenue opportunities due to stockouts.",
                    f"Recommendation: Increase order quantities to {shortage} units and raise safety stock level.",
                    "Expected Business Outcome: Prevent stockouts and scale operations to capture demand."
                ],
                evidence_snapshot={"summary": "Hyper-growth SKU at risk of stockout.", "impact": f"Capture ${round(shortage * item.product.selling_price)} in potential revenue."},
                trigger_type="SYSTEM_ALERT", created_from_query=False
            )
            traces.append(trace)
            
        elif demo_company == "novawear":
            # Just do optimization suggestions for the first few SKUs
            if item.product.sku in ["NW-OPT-001", "NW-OPT-002"]:
                trace = RecommendationTrace(
                    recommendation_id=f"REC-{org_id.hex[:4]}-O{item.product.sku}", organization_id=org_id,
                    recommendation_type="optimization", action=f"Fine-tune Reorder Point for {item.product.sku}", status="Generated", version=1, priority="Medium",
                    related_skus=[item.product.sku], estimated_financial_impact=1500.0,
                    confidence_score=0.90, validation_status="GENERATED", source_datasets=["Inventory"],
                    supporting_metrics={"Current Safety Stock": "45 units", "Recommended Safety Stock": "30 units"},
                    reasoning_chain=[
                        f"Observed: Demand trend for {item.product.sku} is stable but safety stock is slightly oversized.",
                        "Inference: Capital efficiency can be marginally improved.",
                        "Recommendation: Fine-tune replenishment timing and slightly lower safety stock.",
                        "Expected Business Outcome: Optimize working capital without risking stockouts."
                    ],
                    evidence_snapshot={"summary": "Healthy business, minor optimization identified.", "impact": "Increase capital efficiency."},
                    trigger_type="SYSTEM_ALERT", created_from_query=False
                )
                traces.append(trace)
                
    if len(traces) == 0:
        # Fallback trace to guarantee Decision Traceability is populated for any demo workspace
        fallback_trace = RecommendationTrace(
            recommendation_id=f"REC-{org_id.hex[:4]}-SYS01", organization_id=org_id,
            recommendation_type="optimization" if demo_company == "novawear" else ("dead_stock" if demo_company == "urban_threads" else "low_stock"),
            action=f"System Baseline Strategy for {demo_company.replace('_', ' ').title()}", status="Generated", version=1, priority="High",
            related_skus=["DEMO-SKU-001"], estimated_financial_impact=5000.0,
            confidence_score=0.95, validation_status="GENERATED", source_datasets=["Inventory", "Sales"],
            supporting_metrics={"Status": "Seeded Scenario Active"},
            reasoning_chain=[
                f"Observed: Baseline inventory audit for {demo_company.replace('_', ' ').title()}.",
                "Inference: Scenario initialized with dedicated parameters.",
                "Recommendation: Execute operational strategy specific to scenario context."
            ],
            evidence_snapshot={"summary": f"Seeded scenario audit for {demo_company}.", "impact": "Target operational goals."},
            trigger_type="SYSTEM_ALERT", created_from_query=False
        )
        traces.append(fallback_trace)

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
