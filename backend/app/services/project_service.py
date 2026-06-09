import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services.activity_service import ActivityService

class ProjectService:
    @staticmethod
    def create_project(db: Session, project: ProjectCreate, user_id: uuid.UUID) -> Project:
        db_project = Project(**project.model_dump())
        db.add(db_project)
        db.flush()
        
        ActivityService.log_activity(
            db=db, 
            user_id=user_id, 
            entity_type="Project", 
            entity_id=db_project.id, 
            action="Created", 
            description=f"Project '{db_project.name}' created."
        )
        db.commit()
        db.refresh(db_project)
        return db_project

    @staticmethod
    def get_projects(db: Session, skip: int = 0, limit: int = 100, client_id: Optional[uuid.UUID] = None, status: Optional[str] = None) -> List[Project]:
        query = db.query(Project)
        if client_id:
            query = query.filter(Project.client_id == client_id)
        if status:
            query = query.filter(Project.status == status)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def get_project(db: Session, project_id: uuid.UUID) -> Optional[Project]:
        return db.query(Project).filter(Project.id == project_id).first()

    @staticmethod
    def update_project(db: Session, project_id: uuid.UUID, project_update: ProjectUpdate, user_id: uuid.UUID) -> Optional[Project]:
        db_project = ProjectService.get_project(db, project_id)
        if not db_project:
            return None
        
        old_status = db_project.status
        update_data = project_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_project, key, value)
            
        action = "Updated"
        desc = f"Project '{db_project.name}' updated."
        
        if "status" in update_data and update_data["status"] != old_status:
            if update_data["status"] == "completed":
                action = "Completed"
                desc = f"Project '{db_project.name}' completed."
            else:
                action = "Status Changed"
                desc = f"Project '{db_project.name}' status changed from {old_status} to {update_data['status']}."

        ActivityService.log_activity(
            db=db, 
            user_id=user_id, 
            entity_type="Project", 
            entity_id=db_project.id, 
            action=action, 
            description=desc
        )
        db.commit()
        db.refresh(db_project)
        return db_project

    @staticmethod
    def delete_project(db: Session, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        db_project = ProjectService.get_project(db, project_id)
        if not db_project:
            return False
            
        ActivityService.log_activity(
            db=db, 
            user_id=user_id, 
            entity_type="Project", 
            entity_id=db_project.id, 
            action="Deleted", 
            description=f"Project '{db_project.name}' deleted."
        )
        db.delete(db_project)
        db.commit()
        return True
