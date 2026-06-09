import asyncio
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.profile import Profile
from app.schemas.client import ClientCreate
from app.schemas.project import ProjectCreate
from app.schemas.task import TaskCreate
from app.schemas.finance import RevenueCreate, ExpenseCreate
from app.services.client_service import ClientService
from app.services.project_service import ProjectService
from app.services.task_service import TaskService
from app.services.finance_service import FinanceService
from app.services.business_analytics_service import BusinessAnalyticsService
from app.services.activity_service import ActivityService

# Setup local SQLite test db for verification
engine = create_engine("sqlite:///eve_mvp.db")
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

# 1. Mock User Setup
user_id = uuid.uuid4()
profile = Profile(id=user_id, email="ceo@test.com", hashed_password="mock", full_name="Test CEO")
db.add(profile)
db.commit()
print(f"[*] Mock user created: {user_id}")

try:
    # 2. Create Client
    client_data = ClientCreate(company_name="Acme Corp", industry="Tech", status="active")
    client = ClientService.create_client(db=db, client=client_data, user_id=user_id)
    print(f"[*] Client created: {client.company_name} (ID: {client.id})")

    # 3. Create Project
    project_data = ProjectCreate(name="Acme Web App", client_id=client.id, budget=10000, status="active")
    project = ProjectService.create_project(db=db, project=project_data, user_id=user_id)
    print(f"[*] Project created: {project.name} (ID: {project.id})")

    # 4. Create Task
    task_data = TaskCreate(title="Design Database", project_id=project.id, priority="high", status="todo")
    task = TaskService.create_task(db=db, task=task_data, user_id=user_id)
    print(f"[*] Task created: {task.title} (ID: {task.id})")

    # 5. Add Revenue & Expense
    rev_data = RevenueCreate(amount=5000, project_id=project.id, description="Initial Deposit")
    FinanceService.create_revenue(db=db, revenue=rev_data, user_id=user_id)
    print("[*] Revenue added: 5000")

    exp_data = ExpenseCreate(amount=1000, category="Software", description="Server Hosting")
    FinanceService.create_expense(db=db, expense=exp_data, user_id=user_id)
    print("[*] Expense added: 1000")

    # 6. Verify Analytics
    analytics = BusinessAnalyticsService.get_overview(db)
    print("\n[*] --- Analytics Overview ---")
    for k, v in analytics.items():
        print(f"    {k}: {v}")

    # 7. Verify Activity Logs
    logs = ActivityService.get_activities(db=db, user_id=user_id)
    print(f"\n[*] --- Activity Logs ({len(logs)}) ---")
    for log in logs:
        print(f"    [{log.entity_type}] {log.action}: {log.description}")

    # Assertions for End-to-End Success
    assert analytics["clients"] >= 1, "Client count failed"
    assert analytics["projects"] >= 1, "Project count failed"
    assert analytics["tasks"] >= 1, "Task count failed"
    assert analytics["revenue"] >= 5000, "Revenue calculation failed"
    assert analytics["expenses"] >= 1000, "Expense calculation failed"
    assert analytics["profit"] == (analytics["revenue"] - analytics["expenses"]), "Profit calculation failed"
    assert len(logs) == 5, "Activity logs missing"
    
    print("\n[SUCCESS] End-to-End Database & Service Audit Passed!")

except AssertionError as e:
    print(f"\n[ERROR] Assertion Failed: {e}")
except Exception as e:
    print(f"\n[ERROR] Exception Occurred: {e}")
    import traceback
    traceback.print_exc()
finally:
    # Cleanup mock data
    db.delete(profile) # Cascades should handle the rest since we used CASCADE deletes, wait, profile delete doesn't cascade clients.
    # We should delete the client directly to cascade the rest.
    db.delete(client)
    db.commit()
    db.close()
