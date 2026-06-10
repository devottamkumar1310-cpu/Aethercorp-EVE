import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.services.client_service import ClientService
from app.core.security import get_current_user, get_required_workspace_id
from app.models.profile import Profile

router = APIRouter(prefix="/clients", tags=["Clients"])

@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(client: ClientCreate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return ClientService.create_client(db=db, client=client, user_id=current_user.id, workspace_id=workspace_id)

@router.get("/", response_model=List[ClientResponse])
def get_clients(skip: int = 0, limit: int = 100, status: Optional[str] = None, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    return ClientService.get_clients(db=db, skip=skip, limit=limit, status=status, workspace_id=workspace_id)

@router.get("/{client_id}", response_model=ClientResponse)
def get_client(client_id: uuid.UUID, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    client = ClientService.get_client(db=db, client_id=client_id, workspace_id=workspace_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@router.put("/{client_id}", response_model=ClientResponse)
def update_client(client_id: uuid.UUID, client_update: ClientUpdate, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    client = ClientService.update_client(db=db, client_id=client_id, client_update=client_update, user_id=current_user.id, workspace_id=workspace_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: uuid.UUID, db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user), workspace_id: uuid.UUID = Depends(get_required_workspace_id)):
    success = ClientService.delete_client(db=db, client_id=client_id, user_id=current_user.id, workspace_id=workspace_id)
    if not success:
        raise HTTPException(status_code=404, detail="Client not found")
    return None
