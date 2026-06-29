"""Add upload security sha256 to processed_documents

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-06-28 15:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a1'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('processed_documents', sa.Column('sha256_hash', sa.String(), nullable=True))
    op.create_index(op.f('ix_processed_documents_sha256_hash'), 'processed_documents', ['sha256_hash'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_processed_documents_sha256_hash'), table_name='processed_documents')
    op.drop_column('processed_documents', 'sha256_hash')
