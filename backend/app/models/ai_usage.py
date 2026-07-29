import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, UUID, Integer, Numeric, Boolean, Index
from app.database import Base


class AIUsageLog(Base):
    """
    Append-only record of every AI provider call made by EVE.

    Provider-agnostic by design: `provider` + `model` identify what ran, and
    pricing is the only provider-specific concern (see app/core/ai_runtime.py).
    Adding OpenAI or an OCR provider later means new rows here, not a new table.

    This is the source of truth for spend. Nothing else should attempt to
    reconstruct cost from feature-specific tables.
    """
    __tablename__ = "ai_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Nullable: background jobs and system tasks have no owning org/user, but
    # their spend must still count against the global cap.
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True, index=True)

    feature = Column(String, nullable=False, index=True)   # "executive_chat", "inventory_analysis", ...
    provider = Column(String, nullable=False)              # "google", "openai", ...
    model = Column(String, nullable=False)

    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    cached_tokens = Column(Integer, nullable=False, default=0)

    latency_ms = Column(Integer, nullable=True)
    # Numeric, not Float — float error accumulates across millions of rows and
    # this column is summed to make spend decisions.
    cost_usd = Column(Numeric(12, 6), nullable=False, default=0)

    # success | error | timeout | blocked_quota | blocked_kill | blocked_injection
    status = Column(String, nullable=False, index=True)
    error_code = Column(String, nullable=True)

    # Correlates with recommendation_trace / telemetry for a single request.
    request_id = Column(String, nullable=True, index=True)

    retry_count = Column(Integer, nullable=False, default=0)
    cache_hit = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        # Serves both the global daily cap and per-org spend queries.
        Index("ix_ai_usage_logs_org_created", "organization_id", "created_at"),
        Index("ix_ai_usage_logs_feature_created", "feature", "created_at"),
    )
