"""Add variant size and color fields

Revision ID: a7b8c9d0e1f2
Revises: 96413e027c87
Create Date: 2026-07-15 12:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = '96413e027c87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add size and color columns to products table for apparel variant support."""
    op.add_column('products', sa.Column('size', sa.String(), nullable=True))
    op.add_column('products', sa.Column('color', sa.String(), nullable=True))


def downgrade() -> None:
    """Remove size and color columns from products table."""
    op.drop_column('products', 'color')
    op.drop_column('products', 'size')
