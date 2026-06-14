# ==============================================================================
# PURPOSE: Short-term Session memory manager.
# DATA FLOW: Takes message text -> persists in ChatMessage table -> retrieves formatted history string.
# EXTENSION POINTS: Add automatic summary truncation of old history when tokens exceed limit.
# ARCHITECTURAL DECISION:
# - Messages are stored in standard tables to persist chat sessions across page reloads.
# ==============================================================================

import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.memory import ConversationSession, ChatMessage

logger = logging.getLogger("eve.memory.short_term")


class ShortTermMemoryService:
    """
    Manages in-session sliding window chat history.
    """

    @classmethod
    def create_session(cls, db: Session, organization_id: int, title: str) -> ConversationSession:
        """
        Creates a new conversation session for a tenant.
        """
        session = ConversationSession(organization_id=organization_id, title=title)
        db.add(session)
        db.commit()
        db.refresh(session)
        logger.info(f"Created chat session {session.id} for Org: {organization_id}")
        return session

    @classmethod
    def add_message(cls, db: Session, session_id: int, organization_id: Any, role: str, content: str) -> ChatMessage:
        """
        Appends a message to the chat session history.
        """
        # Enforce tenant check
        session = db.query(ConversationSession).filter(
            ConversationSession.id == session_id,
            ConversationSession.organization_id == organization_id
        ).first()
        if not session:
            raise ValueError("Conversation session not found or unauthorized.")

        msg = ChatMessage(session_id=session_id, role=role, content=content)
        db.add(msg)
        
        import datetime
        session.updated_at = datetime.datetime.utcnow()
            
        db.commit()
        db.refresh(msg)
        logger.debug(f"Added message ID {msg.id} (Role: {role}) to Session {session_id}")
        return msg

    @classmethod
    def get_formatted_history(cls, db: Session, session_id: int, organization_id: Any, limit: int = 15) -> str:
        """
        Retrieves the last N messages of a session formatted as a prompt context block.
        """
        # Enforce tenant check
        session = db.query(ConversationSession).filter(
            ConversationSession.id == session_id,
            ConversationSession.organization_id == organization_id
        ).first()
        if not session:
            return ""

        messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id)\
                     .order_by(ChatMessage.created_at.desc()).limit(limit).all()
                     
        # Reverse because order_by was descending
        messages.reverse()
        
        history_lines = []
        for msg in messages:
            # Map role names to clear descriptors
            speaker = "User" if msg.role == "user" else "Assistant/EVE"
            history_lines.append(f"{speaker}: {msg.content}")
            
        return "\n".join(history_lines)


# Register ShortTermMemoryService inside Container
from app.core.dependency_container import container
container.register_singleton("short_term_memory_service", ShortTermMemoryService())
