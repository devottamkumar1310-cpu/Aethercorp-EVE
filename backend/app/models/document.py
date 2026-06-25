import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, UUID, Integer, JSON, Float
from sqlalchemy.orm import relationship
from app.database import Base


class ProcessedDocument(Base):
    """
    Stores documents uploaded, classified, and processed by EVE.
    """
    __tablename__ = "processed_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    status = Column(String, default="processing", nullable=False)  # "processing", "success", "failure"
    document_type = Column(String, nullable=True)  # "Invoice", "PurchaseOrder", "Expense", "SalesReport", "InventoryReport"
    classification_confidence = Column(Float, nullable=True)
    extracted_data = Column(JSON, nullable=True)
    quality_assessment = Column(JSON, nullable=True)
    coo_insights = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="processed_documents")
