"""Add profile settings columns: timezone, language, avatar_url

Revision ID: d4e5f6a1b2c3
Revises: c3d4e5f6a1b2
Create Date: 2026-06-29 11:52:00.000000

Root Cause Fix:
    The Profile SQLAlchemy model (app/models/profile.py) defines three columns
    that were never created through Alembic:
        - profiles.timezone  (String, default='UTC', NOT NULL)
        - profiles.language  (String, default='en',  NOT NULL)
        - profiles.avatar_url (String, nullable)

    The initial table was created by Supabase directly (or via create_all) from
    the model definition at an earlier point, but the production Supabase schema
    predates these columns. No prior migration adds them. This migration is the
    authoritative fix.

Affected endpoints (HTTP 500 before this migration):
    GET /api/profile/me
    GET /api/organization/workspaces
    PUT /api/profile/me

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a1b2c3'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add missing profile settings columns to the profiles table.

    Each ADD COLUMN uses a safe server_default so that existing rows are
    immediately backfilled and NOT NULL constraints can be enforced without
    requiring a separate backfill step.
    """
    # 1. Add timezone column (NOT NULL, default 'UTC')
    #    Existing rows receive 'UTC' immediately via server_default.
    op.add_column(
        'profiles',
        sa.Column(
            'timezone',
            sa.String(),
            nullable=False,
            server_default='UTC',
        )
    )

    # 2. Add language column (NOT NULL, default 'en')
    #    Existing rows receive 'en' immediately via server_default.
    op.add_column(
        'profiles',
        sa.Column(
            'language',
            sa.String(),
            nullable=False,
            server_default='en',
        )
    )

    # 3. Add avatar_url column (nullable — no default required)
    op.add_column(
        'profiles',
        sa.Column(
            'avatar_url',
            sa.String(),
            nullable=True,
        )
    )


def downgrade() -> None:
    """
    Remove the profile settings columns added in this migration.
    This is destructive — all stored timezone, language and avatar_url data
    will be permanently lost on downgrade. Only run in non-production environments.
    """
    op.drop_column('profiles', 'avatar_url')
    op.drop_column('profiles', 'language')
    op.drop_column('profiles', 'timezone')
