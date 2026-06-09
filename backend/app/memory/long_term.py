# ==============================================================================
# PURPOSE: Long-term Episodic Memory Service.
# DATA FLOW: Takes text -> generates embedding -> saves to MemoryEntry database table.
# EXTENSION POINTS: Add automatic memory consolidation (summarizing old memories to form abstract facts).
# ARCHITECTURAL DECISION:
# - Connects content, embeddings, and JSON metadata together to allow rich vector queries.
# ==============================================================================

import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.memory import MemoryEntry
from app.core.dependency_container import container

logger = logging.getLogger("eve.memory.long_term")


class LongTermMemoryService:
    """
    Manages long term vector memories.
    """
    def __init__(self):
        self.embeddings_service = container.get("embeddings_service")

    def save_memory(
        self,
        db: Session,
        organization_id: int,
        content: str,
        metadata_json: Optional[Dict[str, Any]] = None
    ) -> MemoryEntry:
        """
        Generates embedding and saves memory record.
        """
        logger.info(f"Long Term Memory: Saving new memory for Org: {organization_id}...")
        
        # Calculate dense vector embedding
        vector = self.embeddings_service.get_embedding(content)

        memory = MemoryEntry(
            organization_id=organization_id,
            content=content,
            embedding=vector,
            metadata_json=metadata_json or {}
        )
        
        db.add(memory)
        db.commit()
        db.refresh(memory)
        logger.info(f"Long Term Memory: Successfully saved memory ID: {memory.id}")
        return memory


# Register LongTermMemoryService inside Container
container.register_singleton("long_term_memory_service", LongTermMemoryService())
