import pandas as pd
from app.database import SessionLocal
from app.models.profile import Profile
from app.models.organization import Organization
from app.models.product import Product
from app.services.importer_service import ImporterService
import uuid

db = SessionLocal()

# Find dev user's workspace
user = db.query(Profile).filter(Profile.email == "dev@aethercorp.com").first()
org_id = user.memberships[0].organization_id

print(f"Testing with Organization: {org_id}")

# 1. Create a dummy CSV DataFrame
csv_data = [
    {"sku": f"test-shirt-blk-s-{uuid.uuid4().hex[:6]}", "name": "Test Cotton Shirt - Black / S", "category": "Apparel", "stock_on_hand": 10, "unit_cost": 5.0, "selling_price": 20.0},
    {"sku": f"test-shirt-blk-m-{uuid.uuid4().hex[:6]}", "name": "Test Cotton Shirt - Black / M", "category": "Apparel", "stock_on_hand": 15, "unit_cost": 5.0, "selling_price": 20.0},
    {"sku": f"test-shirt-blk-l-{uuid.uuid4().hex[:6]}", "name": "Test Cotton Shirt - Black / L", "category": "Apparel", "stock_on_hand": 5, "unit_cost": 5.0, "selling_price": 20.0},
]
df = pd.DataFrame(csv_data)

# 2. Run importer service
result = ImporterService.import_inventory(db, org_id, df)
print(f"Import Result: {result}")

# 3. Verify variant detector populated fields
skus = [r["sku"] for r in csv_data]
products = db.query(Product).filter(Product.sku.in_(skus)).all()

print("\n--- DB PRODUCT VERIFICATION ---")
for p in products:
    print(f"SKU: {p.sku}")
    print(f"  Name: {p.name}")
    print(f"  Parent ID: {p.parent_product_id}")
    print(f"  Size: {p.size}")
    print(f"  Color: {p.color}")

print("\n--- END VERIFICATION ---")
