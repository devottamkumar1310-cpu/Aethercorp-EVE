import uuid
from typing import List
from sqlalchemy.orm import Session
from app.models.finance import Revenue, Expense
from app.schemas.finance import RevenueCreate, ExpenseCreate
from app.services.activity_service import ActivityService

class FinanceService:
    @staticmethod
    def create_revenue(db: Session, revenue: RevenueCreate, user_id: uuid.UUID, workspace_id: uuid.UUID) -> Revenue:
        # Verify project belongs to active workspace
        from app.models.project import Project
        project = db.query(Project).filter(Project.id == revenue.project_id, Project.organization_id == workspace_id).first()
        if not project:
            raise ValueError("Project not found in this workspace")

        db_revenue = Revenue(**revenue.model_dump(), organization_id=workspace_id)
        db.add(db_revenue)
        db.flush()
        
        ActivityService.log_activity(
            db=db, 
            user_id=user_id, 
            organization_id=workspace_id,
            entity_type="Revenue", 
            entity_id=db_revenue.id, 
            action="Added", 
            description=f"Revenue of {db_revenue.amount} added to project {db_revenue.project_id}."
        )
        db.commit()
        db.refresh(db_revenue)
        return db_revenue

    @staticmethod
    def get_revenues(db: Session, workspace_id: uuid.UUID, skip: int = 0, limit: int = 100) -> List[Revenue]:
        return db.query(Revenue).filter(Revenue.organization_id == workspace_id).offset(skip).limit(limit).all()

    @staticmethod
    def create_expense(db: Session, expense: ExpenseCreate, user_id: uuid.UUID, workspace_id: uuid.UUID) -> Expense:
        db_expense = Expense(**expense.model_dump(), organization_id=workspace_id)
        db.add(db_expense)
        db.flush()
        
        ActivityService.log_activity(
            db=db, 
            user_id=user_id, 
            organization_id=workspace_id,
            entity_type="Expense", 
            entity_id=db_expense.id, 
            action="Added", 
            description=f"Expense of {db_expense.amount} added."
        )
        db.commit()
        db.refresh(db_expense)
        return db_expense

    @staticmethod
    def get_expenses(db: Session, workspace_id: uuid.UUID, skip: int = 0, limit: int = 100) -> List[Expense]:
        return db.query(Expense).filter(Expense.organization_id == workspace_id).offset(skip).limit(limit).all()
