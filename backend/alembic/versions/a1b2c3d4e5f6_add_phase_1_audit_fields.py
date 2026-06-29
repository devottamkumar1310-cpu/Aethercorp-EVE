"""Add Phase 1 audit fields to audit_logs

Revision ID: a1b2c3d4e5f6
Revises: f883444fdb64
Create Date: 2026-06-28 14:04:28.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f883444fdb64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add columns user_id, client_ip, before_state, after_state to audit_logs
    op.add_column('audit_logs', sa.Column('user_id', sa.UUID(), sa.ForeignKey('profiles.id', ondelete='SET NULL'), nullable=True))
    op.add_column('audit_logs', sa.Column('client_ip', sa.String(), nullable=True))
    op.add_column('audit_logs', sa.Column('before_state', sa.JSON(), nullable=True))
    op.add_column('audit_logs', sa.Column('after_state', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('audit_logs', 'after_state')
    op.drop_column('audit_logs', 'before_state')
    op.drop_column('audit_logs', 'client_ip')
    op.drop_column('audit_logs', 'user_id')
