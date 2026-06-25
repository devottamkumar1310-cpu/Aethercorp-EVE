import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.services.project_service import ProjectService
from app.core.security import get_current_user, get_required_workspace_id
from app.models.profile import Profile

router = APIRouter(prefix="/api/projects", tags=["Projects"])

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    try:
        return ProjectService.create_project(db=db, project=project, user_id=current_user.id, workspace_id=workspace_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[ProjectResponse])
def get_projects(skip: int = 0, limit: int = 100, client_id: Optional[uuid.UUID] = None, proj_status: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return ProjectService.get_projects(db=db, workspace_id=workspace_id, skip=skip, limit=limit, client_id=client_id, status=proj_status)

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: uuid.UUID, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    project = ProjectService.get_project(db=db, project_id=project_id, workspace_id=workspace_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: uuid.UUID, project_update: ProjectUpdate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    try:
        project = ProjectService.update_project(db=db, project_id=project_id, project_update=project_update, user_id=current_user.id, workspace_id=workspace_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: uuid.UUID, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    success = ProjectService.delete_project(db=db, project_id=project_id, user_id=current_user.id, workspace_id=workspace_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return None
