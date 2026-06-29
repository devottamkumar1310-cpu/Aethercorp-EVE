"""Merge two Alembic heads into a single linear chain.

Revision ID: e5f6a1b2c3d4
Revises: e2a1e2c3f851, d4e5f6a1b2c3
Create Date: 2026-06-29 12:26:00.000000

WHY THIS EXISTS:
    The migration history had two separate branches originating from f883444fdb64:

    Branch A (multi-tenant path):
        f883444fdb64
          └── dd165cfe4281 (add_multi_tenant_columns)
                └── e2a1e2c3f851 (add_indexes_and_backfill)   ← head

    Branch B (audit + features path):
        f883444fdb64
          └── a1b2c3d4e5f6 (add_phase_1_audit_fields)
                └── b2c3d4e5f6a1 (add_upload_security_sha256)
                      └── c3d4e5f6a1b2 (add_recommendation_traces_table)
                            └── d4e5f6a1b2c3 (add_profile_settings_columns) ← head

    Without this merge migration, `alembic upgrade head` fails with:
        "Multiple head revisions are present for given argument 'head'"

    This migration has no SQL of its own — its only purpose is to declare
    both heads as its parents, creating a single new head that both branches
    converge into. Production databases that have applied all migrations from
    both branches will be stamped to this revision automatically.

HOW TO APPLY:
    alembic upgrade head

    If alembic reports the DB is already at both heads, use:
    alembic stamp e5f6a1b2c3d4
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a1b2c3d4'
# Both branch heads are listed as parents — this is the merge point.
down_revision: Union[str, Sequence[str], None] = ('e2a1e2c3f851', 'd4e5f6a1b2c3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    No schema changes. This migration exists purely to merge two Alembic
    branch heads into one so that `alembic upgrade head` is unambiguous.
    """
    pass


def downgrade() -> None:
    """
    No-op downgrade — the branch split cannot be meaningfully restored.
    To downgrade individual branches, use the specific revision IDs.
    """
    pass
