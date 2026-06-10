"""add_multi_tenant_columns

Revision ID: dd165cfe4281
Revises: f883444fdb64
Create Date: 2026-06-11 03:44:48.479995

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd165cfe4281'
down_revision: Union[str, Sequence[str], None] = 'f883444fdb64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add organization_id columns as nullable=True
    op.add_column('clients', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.add_column('projects', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.add_column('tasks', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.add_column('revenues', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.add_column('expenses', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.add_column('activity_logs', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.add_column('intelligence_snapshots', sa.Column('organization_id', sa.UUID(), nullable=True))

    # 2. Add foreign keys referencing organizations.id
    op.create_foreign_key('fk_clients_organization_id', 'clients', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_projects_organization_id', 'projects', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_tasks_organization_id', 'tasks', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_revenues_organization_id', 'revenues', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_expenses_organization_id', 'expenses', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_activity_logs_organization_id', 'activity_logs', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_intelligence_snapshots_organization_id', 'intelligence_snapshots', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Drop foreign keys
    op.drop_constraint('fk_clients_organization_id', 'clients', type_='foreignkey')
    op.drop_constraint('fk_projects_organization_id', 'projects', type_='foreignkey')
    op.drop_constraint('fk_tasks_organization_id', 'tasks', type_='foreignkey')
    op.drop_constraint('fk_revenues_organization_id', 'revenues', type_='foreignkey')
    op.drop_constraint('fk_expenses_organization_id', 'expenses', type_='foreignkey')
    op.drop_constraint('fk_activity_logs_organization_id', 'activity_logs', type_='foreignkey')
    op.drop_constraint('fk_intelligence_snapshots_organization_id', 'intelligence_snapshots', type_='foreignkey')

    # 2. Drop columns
    op.drop_column('clients', 'organization_id')
    op.drop_column('projects', 'organization_id')
    op.drop_column('tasks', 'organization_id')
    op.drop_column('revenues', 'organization_id')
    op.drop_column('expenses', 'organization_id')
    op.drop_column('activity_logs', 'organization_id')
    op.drop_column('intelligence_snapshots', 'organization_id')
