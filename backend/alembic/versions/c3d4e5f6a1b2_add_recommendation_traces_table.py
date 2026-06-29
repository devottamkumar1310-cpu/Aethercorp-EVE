"""Add recommendation_traces table

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-06-29 09:12:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a1b2'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'recommendation_traces',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('recommendation_type', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=False),
        sa.Column('validation_status', sa.String(), nullable=False, server_default='verified'),
        sa.Column('source_datasets', sa.JSON(), nullable=False),
        sa.Column('supporting_metrics', sa.JSON(), nullable=False),
        sa.Column('reasoning_chain', sa.JSON(), nullable=False),
        sa.Column('evidence_snapshot', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_recommendation_traces_id'), 'recommendation_traces', ['id'], unique=False)
    op.create_index(op.f('ix_recommendation_traces_organization_id'), 'recommendation_traces', ['organization_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_recommendation_traces_organization_id'), table_name='recommendation_traces')
    op.drop_index(op.f('ix_recommendation_traces_id'), table_name='recommendation_traces')
    op.drop_table('recommendation_traces')
