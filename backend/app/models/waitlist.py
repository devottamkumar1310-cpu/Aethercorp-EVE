import uuid
import datetime
from sqlalchemy import Column, String, DateTime, UUID
from app.database import Base


class WaitlistEntry(Base):
    """
    Represents an entry in the pre-expiry priority waitlist.
    """
    __tablename__ = "waitlist_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    name = Column(String, nullable=True)
    email = Column(String, nullable=True, index=True)
    company_name = Column(String, nullable=True)
    company_website = Column(String, nullable=True)
    revenue_range = Column(String, nullable=True)
    biggest_inventory_challenge = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
