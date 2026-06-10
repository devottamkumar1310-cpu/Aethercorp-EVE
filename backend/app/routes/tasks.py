import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse
from app.services.task_service import TaskService
from app.core.security import get_current_user, get_required_workspace_id
from app.models.profile import Profile

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task: TaskCreate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    try:
        return TaskService.create_task(db=db, task=task, user_id=current_user.id, workspace_id=workspace_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[TaskResponse])
def get_tasks(skip: int = 0, limit: int = 100, project_id: Optional[uuid.UUID] = None, task_status: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return TaskService.get_tasks(db=db, workspace_id=workspace_id, skip=skip, limit=limit, project_id=project_id, status=task_status)

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: uuid.UUID, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    task = TaskService.get_task(db=db, task_id=task_id, workspace_id=workspace_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: uuid.UUID, task_update: TaskUpdate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    try:
        task = TaskService.update_task(db=db, task_id=task_id, task_update=task_update, user_id=current_user.id, workspace_id=workspace_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: uuid.UUID, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    success = TaskService.delete_task(db=db, task_id=task_id, user_id=current_user.id, workspace_id=workspace_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return None
