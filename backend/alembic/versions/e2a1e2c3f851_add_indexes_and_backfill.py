"""add_indexes_and_backfill

Revision ID: e2a1e2c3f851
Revises: dd165cfe4281
Create Date: 2026-06-11 04:19:00.760340

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2a1e2c3f851'
down_revision: Union[str, Sequence[str], None] = 'dd165cfe4281'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    
    # 1. Backfill NULL organization_id values using the first organization ID in the database
    # This prevents orphaned rows and foreign key failures on subsequent constraint changes.
    tables_to_backfill = [
        "clients",
        "projects",
        "tasks",
        "revenues",
        "expenses",
        "activity_logs",
        "intelligence_snapshots"
    ]
    
    for table in tables_to_backfill:
        bind.execute(sa.text(f"""
            UPDATE {table} 
            SET organization_id = (SELECT id FROM organizations LIMIT 1) 
            WHERE organization_id IS NULL AND EXISTS (SELECT 1 FROM organizations);
        """))

    # 2. Create indexes on organization_id columns to optimize lookup times and tenant scoping queries
    op.create_index('ix_clients_organization_id', 'clients', ['organization_id'])
    op.create_index('ix_projects_organization_id', 'projects', ['organization_id'])
    op.create_index('ix_tasks_organization_id', 'tasks', ['organization_id'])
    op.create_index('ix_revenues_organization_id', 'revenues', ['organization_id'])
    op.create_index('ix_expenses_organization_id', 'expenses', ['organization_id'])
    op.create_index('ix_activity_logs_organization_id', 'activity_logs', ['organization_id'])
    op.create_index('ix_intelligence_snapshots_organization_id', 'intelligence_snapshots', ['organization_id'])
    op.create_index('ix_products_organization_id', 'products', ['organization_id'])
    op.create_index('ix_inventory_items_organization_id', 'inventory_items', ['organization_id'])
    op.create_index('ix_sales_records_organization_id', 'sales_records', ['organization_id'])
    op.create_index('ix_suppliers_organization_id', 'suppliers', ['organization_id'])
    op.create_index('ix_artifacts_organization_id', 'artifacts', ['organization_id'])
    op.create_index('ix_conversation_sessions_organization_id', 'conversation_sessions', ['organization_id'])
    op.create_index('ix_memory_entries_organization_id', 'memory_entries', ['organization_id'])
    op.create_index('ix_forecasts_organization_id', 'forecasts', ['organization_id'])
    op.create_index('ix_recommendations_organization_id', 'recommendations', ['organization_id'])
    op.create_index('ix_reports_organization_id', 'reports', ['organization_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_reports_organization_id', table_name='reports')
    op.drop_index('ix_recommendations_organization_id', table_name='recommendations')
    op.drop_index('ix_forecasts_organization_id', table_name='forecasts')
    op.drop_index('ix_memory_entries_organization_id', table_name='memory_entries')
    op.drop_index('ix_conversation_sessions_organization_id', table_name='conversation_sessions')
    op.drop_index('ix_artifacts_organization_id', table_name='artifacts')
    op.drop_index('ix_suppliers_organization_id', table_name='suppliers')
    op.drop_index('ix_sales_records_organization_id', table_name='sales_records')
    op.drop_index('ix_inventory_items_organization_id', table_name='inventory_items')
    op.drop_index('ix_products_organization_id', table_name='products')
    op.drop_index('ix_intelligence_snapshots_organization_id', table_name='intelligence_snapshots')
    op.drop_index('ix_activity_logs_organization_id', table_name='activity_logs')
    op.drop_index('ix_expenses_organization_id', table_name='expenses')
    op.drop_index('ix_revenues_organization_id', table_name='revenues')
    op.drop_index('ix_tasks_organization_id', table_name='tasks')
    op.drop_index('ix_projects_organization_id', table_name='projects')
    op.drop_index('ix_clients_organization_id', table_name='clients')
