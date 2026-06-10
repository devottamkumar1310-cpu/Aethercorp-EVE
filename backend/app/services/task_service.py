import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.activity_service import ActivityService

class TaskService:
    @staticmethod
    def create_task(db: Session, task: TaskCreate, user_id: uuid.UUID, workspace_id: uuid.UUID) -> Task:
        # Verify project belongs to active workspace
        from app.models.project import Project
        project = db.query(Project).filter(Project.id == task.project_id, Project.organization_id == workspace_id).first()
        if not project:
            raise ValueError("Project not found in this workspace")

        db_task = Task(**task.model_dump(), organization_id=workspace_id)
        db.add(db_task)
        db.flush()
        
        ActivityService.log_activity(
            db=db, 
            user_id=user_id, 
            organization_id=workspace_id,
            entity_type="Task", 
            entity_id=db_task.id, 
            action="Created", 
            description=f"Task '{db_task.title}' created."
        )
        db.commit()
        db.refresh(db_task)
        return db_task

    @staticmethod
    def get_tasks(db: Session, workspace_id: uuid.UUID, skip: int = 0, limit: int = 100, project_id: Optional[uuid.UUID] = None, status: Optional[str] = None) -> List[Task]:
        query = db.query(Task).filter(Task.organization_id == workspace_id)
        if project_id:
            query = query.filter(Task.project_id == project_id)
        if status:
            query = query.filter(Task.status == status)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def get_task(db: Session, task_id: uuid.UUID, workspace_id: uuid.UUID) -> Optional[Task]:
        return db.query(Task).filter(Task.id == task_id, Task.organization_id == workspace_id).first()

    @staticmethod
    def update_task(db: Session, task_id: uuid.UUID, task_update: TaskUpdate, user_id: uuid.UUID, workspace_id: uuid.UUID) -> Optional[Task]:
        db_task = TaskService.get_task(db, task_id, workspace_id)
        if not db_task:
            return None
        
        update_data = task_update.model_dump(exclude_unset=True)
        if "project_id" in update_data:
            from app.models.project import Project
            project = db.query(Project).filter(Project.id == update_data["project_id"], Project.organization_id == workspace_id).first()
            if not project:
                raise ValueError("Project not found in this workspace")

        old_assignee = db_task.assigned_to
        old_status = db_task.status
        for key, value in update_data.items():
            setattr(db_task, key, value)
            
        action = "Updated"
        desc = f"Task '{db_task.title}' updated."
        
        if "assigned_to" in update_data and update_data["assigned_to"] != old_assignee:
            action = "Assigned"
            desc = f"Task '{db_task.title}' assigned to {update_data['assigned_to']}."
            
        if "status" in update_data and update_data["status"] != old_status:
            if update_data["status"] == "completed":
                action = "Completed"
                desc = f"Task '{db_task.title}' completed."
        
        ActivityService.log_activity(
            db=db, 
            user_id=user_id, 
            organization_id=workspace_id,
            entity_type="Task", 
            entity_id=db_task.id, 
            action=action, 
            description=desc
        )
        db.commit()
        db.refresh(db_task)
        return db_task

    @staticmethod
    def delete_task(db: Session, task_id: uuid.UUID, user_id: uuid.UUID, workspace_id: uuid.UUID) -> bool:
        db_task = TaskService.get_task(db, task_id, workspace_id)
        if not db_task:
            return False
            
        ActivityService.log_activity(
            db=db, 
            user_id=user_id, 
            organization_id=workspace_id,
            entity_type="Task", 
            entity_id=db_task.id, 
            action="Deleted", 
            description=f"Task '{db_task.title}' deleted."
        )
        db.delete(db_task)
        db.commit()
        return True
