# ==============================================================================
# PURPOSE: Unified Memory Manager.
# DATA FLOW: Takes queries -> resolves short-term sliding context and long-term vector recalls ->
#            compiles them into a single string to feed into agent prompts.
# EXTENSION POINTS: Add cache decorators or context compression algorithms.
# ARCHITECTURAL DECISION:
# - Serves as the single face to the entire memory sub-system, hiding implementation
#   complexities from agents.
# ==============================================================================

import logging
from typing import Dict, Any
from sqlalchemy.orm import Session

from app.core.dependency_container import container

logger = logging.getLogger("eve.memory.memory_manager")


class MemoryManager:
    """
    Unified manager coordinating short-term history and semantic vector memory.
    """
    def __init__(self):
        self.short_term = container.get("short_term_memory_service")
        self.long_term = container.get("long_term_memory_service")
        self.retrieval = container.get("vector_retrieval_service")

    def get_agent_context(
        self,
        db: Session,
        organization_id: int,
        session_id: int,
        query: str,
        history_limit: int = 10,
        memory_limit: int = 3
    ) -> Dict[str, Any]:
        """
        Gathers both short term conversation lines and relevant long term semantic memories.
        """
        logger.info(f"MemoryManager: compiling agent context (Session: {session_id}, Org: {organization_id})")
        
        # 1. Fetch short term chat logs
        short_term_history = self.short_term.get_formatted_history(db, session_id, organization_id, history_limit)

        # 2. Fetch long term matching memories
        similar_entries = self.retrieval.search_similar_memories(
            db=db,
            organization_id=organization_id,
            query=query,
            limit=memory_limit
        )
        
        long_term_recalled = []
        for entry, score in similar_entries:
            # Only include entries with a decent similarity match
            if score >= 0.35:
                long_term_recalled.append(f"- {entry.content} (Relevance: {score * 100:.1f}%)")

        return {
            "short_term_history": short_term_history,
            "long_term_memories": "\n".join(long_term_recalled) if long_term_recalled else "No relevant memories recalled."
        }

    def record_interaction(
        self,
        db: Session,
        organization_id: int,
        session_id: int,
        user_message: str,
        assistant_response: str
    ):
        """
        Records dialogue exchanges in short term, and extracts salient facts to save to vector memory.
        """
        # Save user message
        self.short_term.add_message(db, session_id, organization_id, "user", user_message)
        # Save assistant message
        self.short_term.add_message(db, session_id, organization_id, "assistant", assistant_response)

        # Automatically extract salient facts and store in vector memory
        # In a fully autonomous loop, we would call LLM to extract facts.
        # For the MVP, we record the key recommendations directly as a long-term memory item.
        if "recommend" in assistant_response.lower() or "price" in assistant_response.lower():
            summary = f"Executive Summary Action: {assistant_response[:250]}..."
            self.long_term.save_memory(
                db=db,
                organization_id=organization_id,
                content=summary,
                metadata_json={"source": "chat_synthesis", "session_id": session_id}
            )


# Register MemoryManager inside Container
container.register_singleton("memory_manager", MemoryManager())
