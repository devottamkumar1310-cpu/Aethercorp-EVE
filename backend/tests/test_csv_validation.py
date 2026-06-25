import io
import pytest
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.services.importer_service import ImporterService

# SQLite In-memory setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

MOCK_ORG_ID = "00000000-0000-0000-0000-000000000001"

from app.models.organization import Organization
import uuid

@pytest.fixture(autouse=True, scope="module")
def seed_mock_org():
    db = TestingSessionLocal()
    org = Organization(id=uuid.UUID(MOCK_ORG_ID), name="Mock Org", slug="mock-org")
    db.add(org)
    db.commit()
    db.close()


def test_inventory_csv_missing_columns():
    db = TestingSessionLocal()
    # Missing 'name' column
    df = pd.DataFrame([
        {"sku": "SKU-1", "category": "General"}
    ])
    report = ImporterService.import_inventory(db, MOCK_ORG_ID, df)
    db.close()
    
    assert report["status"] == "error"
    assert "name" in report["missing_columns"]


def test_inventory_csv_negative_values_and_types():
    db = TestingSessionLocal()
    # Negative stock and invalid type for lead time
    df = pd.DataFrame([
        {"sku": "SKU-1", "name": "Prod 1", "stock_on_hand": -5, "lead_time_days": "abc"}
    ])
    report = ImporterService.import_inventory(db, MOCK_ORG_ID, df)
    db.close()
    
    assert report["status"] == "error"
    assert len(report["errors"]) == 2
    assert any("negative" in err["message"] for err in report["errors"])
    assert any("integer" in err["message"] for err in report["errors"])


def test_inventory_csv_duplicate_rows():
    db = TestingSessionLocal()
    # Duplicate SKU
    df = pd.DataFrame([
        {"sku": "SKU-DUP", "name": "Prod 1", "stock_on_hand": 10},
        {"sku": "SKU-DUP", "name": "Prod 2", "stock_on_hand": 15}
    ])
    report = ImporterService.import_inventory(db, MOCK_ORG_ID, df)
    db.close()
    
    assert report["status"] == "error"
    assert report["duplicate_rows"] == 1
    assert any("Duplicate SKU" in err["message"] for err in report["errors"])


def test_sales_csv_invalid_dates_and_negatives():
    db = TestingSessionLocal()
    # Invalid date and negative price
    df = pd.DataFrame([
        {"sku": "SKU-1", "date": "invalid_date_format", "quantity": 5, "unit_price": -20.0, "revenue": 100.0}
    ])
    report = ImporterService.import_sales(db, MOCK_ORG_ID, df)
    db.close()
    
    assert report["status"] == "error"
    assert len(report["errors"]) == 2
    assert any("parse date" in err["message"] for err in report["errors"])
    assert any("negative" in err["message"] for err in report["errors"])


def test_costs_csv_validation_success():
    db = TestingSessionLocal()
    df = pd.DataFrame([
        {"sku": "SKU-OK-1", "unit_cost": 12.50, "selling_price": 25.00, "supplier_name": "Trusted Vendor"}
    ])
    report = ImporterService.import_costs(db, MOCK_ORG_ID, df)
    db.close()
    
    assert report["status"] == "success"
    assert report["processed_count"] == 1
    assert report["total_rows"] == 1
    assert report["invalid_rows"] == 0
