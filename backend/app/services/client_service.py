import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate
from app.services.activity_service import ActivityService

class ClientService:
    @staticmethod
    def create_client(db: Session, client: ClientCreate, user_id: uuid.UUID) -> Client:
        db_client = Client(**client.model_dump())
        db.add(db_client)
        db.flush() # To get the ID
        
        ActivityService.log_activity(
            db=db, 
            user_id=user_id, 
            entity_type="Client", 
            entity_id=db_client.id, 
            action="Created", 
            description=f"Client '{db_client.company_name}' created."
        )
        db.commit()
        db.refresh(db_client)
        return db_client

    @staticmethod
    def get_clients(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> List[Client]:
        query = db.query(Client)
        if status:
            query = query.filter(Client.status == status)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def get_client(db: Session, client_id: uuid.UUID) -> Optional[Client]:
        return db.query(Client).filter(Client.id == client_id).first()

    @staticmethod
    def update_client(db: Session, client_id: uuid.UUID, client_update: ClientUpdate, user_id: uuid.UUID) -> Optional[Client]:
        db_client = ClientService.get_client(db, client_id)
        if not db_client:
            return None
        
        update_data = client_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_client, key, value)
            
        ActivityService.log_activity(
            db=db, 
            user_id=user_id, 
            entity_type="Client", 
            entity_id=db_client.id, 
            action="Updated", 
            description=f"Client '{db_client.company_name}' updated."
        )
        db.commit()
        db.refresh(db_client)
        return db_client

    @staticmethod
    def delete_client(db: Session, client_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        db_client = ClientService.get_client(db, client_id)
        if not db_client:
            return False
            
        ActivityService.log_activity(
            db=db, 
            user_id=user_id, 
            entity_type="Client", 
            entity_id=db_client.id, 
            action="Deleted", 
            description=f"Client '{db_client.company_name}' deleted."
        )
        db.delete(db_client)
        db.commit()
        return True
