# ==============================================================================
# PURPOSE: Hybrid Vector Retrieval Layer.
# DATA FLOW: Takes query text -> generates embedding -> runs database query -> returns sorted memories.
# EXTENSION POINTS: Add filtering by metadata JSON parameters (e.g. key match) or semantic scores thresholds.
# ARCHITECTURAL DECISION:
# - Connects to pgvector L2/cosine distance indexes in PostgreSQL.
# - Implements a pure-Python cosine-similarity calculator fallback when SQLite is active,
#   enabling seamless offline local development.
# ==============================================================================

import math
import logging
from typing import List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models.memory import MemoryEntry
from app.core.dependency_container import container

logger = logging.getLogger("eve.memory.retrieval")


class VectorRetrievalService:
    """
    Retrieves semantically similar memories from database.
    """
    def __init__(self):
        self.embeddings_service = container.get("embeddings_service")

    def search_similar_memories(
        self,
        db: Session,
        organization_id: int,
        query: str,
        limit: int = 5
    ) -> List[Tuple[MemoryEntry, float]]:
        """
        Queries DB for matching memories. Returns List of (MemoryEntry, similarity_score).
        """
        logger.info(f"Vector Retrieval: Searching similar memories for query: '{query}' (Limit: {limit})")
        query_vector = self.embeddings_service.get_embedding(query)

        # 1. PostgreSQL Native Vector query
        if "postgresql" in db.bind.dialect.name:
            try:
                # Query using pgvector distance operations
                # MemoryEntry.embedding.cosine_distance (or l2_distance)
                # Note: cosine_distance is 1 - cosine_similarity. So lower distance means higher similarity.
                results = db.query(MemoryEntry).filter(
                    MemoryEntry.organization_id == organization_id,
                    MemoryEntry.embedding != None
                ).order_by(
                    MemoryEntry.embedding.cosine_distance(query_vector)
                ).limit(limit).all()
                
                # Convert cosine distance back to similarity score: similarity = 1.0 - distance
                # (pgvector cosine_distance returns value in [0, 2])
                return [(m, 1.0 - float(db.scalar(m.embedding.cosine_distance(query_vector)))) for m in results]
            except Exception as e:
                logger.error(f"PostgreSQL pgvector query failed: {e}. Falling back to Python calculations.")

        # 2. SQLite / In-Memory Fallback calculation
        candidates = db.query(MemoryEntry).filter(
            MemoryEntry.organization_id == organization_id
        ).all()
        
        scored_candidates = []
        for candidate in candidates:
            cand_embedding = candidate.embedding
            # If embedding is string (sqlite JSON format), the decorator automatically parsed it to List[float]
            if cand_embedding and isinstance(cand_embedding, list) and len(cand_embedding) == len(query_vector):
                similarity = self._cosine_similarity(query_vector, cand_embedding)
                scored_candidates.append((candidate, similarity))
                
        # Sort by similarity descending
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        return scored_candidates[:limit]

    def _cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        """
        Computes the cosine similarity of two vectors.
        """
        dot_product = sum(x * y for x, y in zip(v1, v2))
        mag1 = math.sqrt(sum(x * x for x in v1))
        mag2 = math.sqrt(sum(x * x for x in v2))
        
        if mag1 <= 0.0 or mag2 <= 0.0:
            return 0.0
            
        return dot_product / (mag1 * mag2)


# Register VectorRetrievalService inside Container
container.register_singleton("vector_retrieval_service", VectorRetrievalService())
