"""add ai_usage_logs table for AI cost governance

Revision ID: b7c1d2e3f4a5
Revises: a4b2091b9563
Create Date: 2026-07-29

Note: this repository initialises schema via Base.metadata.create_all() in
app/database.py:init_db(), which is the mechanism that actually creates this
table at runtime. This revision exists so the migration history records the
change. The alembic history had three heads before this revision was added;
resolving that branch is tracked separately and is not attempted here.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b7c1d2e3f4a5'
down_revision = 'a4b2091b9563'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ai_usage_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('profiles.id', ondelete='SET NULL'), nullable=True),
        sa.Column('feature', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('model', sa.String(), nullable=False),
        sa.Column('input_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('output_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cached_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('cost_usd', sa.Numeric(12, 6), nullable=False, server_default='0'),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('error_code', sa.String(), nullable=True),
        sa.Column('request_id', sa.String(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('cache_hit', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_index('ix_ai_usage_logs_organization_id', 'ai_usage_logs', ['organization_id'])
    op.create_index('ix_ai_usage_logs_user_id', 'ai_usage_logs', ['user_id'])
    op.create_index('ix_ai_usage_logs_feature', 'ai_usage_logs', ['feature'])
    op.create_index('ix_ai_usage_logs_status', 'ai_usage_logs', ['status'])
    op.create_index('ix_ai_usage_logs_request_id', 'ai_usage_logs', ['request_id'])
    op.create_index('ix_ai_usage_logs_created_at', 'ai_usage_logs', ['created_at'])
    # Composite indexes serving the daily-cap and per-org spend queries.
    op.create_index('ix_ai_usage_logs_org_created', 'ai_usage_logs',
                    ['organization_id', 'created_at'])
    op.create_index('ix_ai_usage_logs_feature_created', 'ai_usage_logs',
                    ['feature', 'created_at'])


def downgrade():
    op.drop_index('ix_ai_usage_logs_feature_created', table_name='ai_usage_logs')
    op.drop_index('ix_ai_usage_logs_org_created', table_name='ai_usage_logs')
    op.drop_index('ix_ai_usage_logs_created_at', table_name='ai_usage_logs')
    op.drop_index('ix_ai_usage_logs_request_id', table_name='ai_usage_logs')
    op.drop_index('ix_ai_usage_logs_status', table_name='ai_usage_logs')
    op.drop_index('ix_ai_usage_logs_feature', table_name='ai_usage_logs')
    op.drop_index('ix_ai_usage_logs_user_id', table_name='ai_usage_logs')
    op.drop_index('ix_ai_usage_logs_organization_id', table_name='ai_usage_logs')
    op.drop_table('ai_usage_logs')
