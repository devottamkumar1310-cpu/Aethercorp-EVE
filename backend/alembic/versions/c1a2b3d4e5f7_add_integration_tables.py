"""Add Shopify and messaging channel integration tables

Revision ID: c1a2b3d4e5f7
Revises: b7c1d2e3f4a5
Create Date: 2026-08-14 10:00:00.000000

Adds the eight tables backing the Shopify store integration and the Telegram /
WhatsApp messaging channels. Every table carries organization_id so the existing
tenant-isolation rules apply without change. Fully reversible.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f7'
down_revision: Union[str, Sequence[str], None] = 'b7c1d2e3f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ---------------------------------------------------------------- Shopify
    op.create_table(
        'shopify_connections',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('connected_by_user_id', sa.UUID(), nullable=True),
        sa.Column('shop_domain', sa.String(), nullable=False),
        sa.Column('access_token_encrypted', sa.Text(), nullable=False),
        sa.Column('scopes', sa.String(), nullable=True),
        sa.Column('api_version', sa.String(), nullable=False, server_default='2024-07'),
        sa.Column('status', sa.String(), nullable=False, server_default='connected'),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('last_successful_sync_at', sa.DateTime(), nullable=True),
        sa.Column('sync_status', sa.String(), nullable=False, server_default='idle'),
        sa.Column('webhook_ids', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('shop_domain', name='uq_shopify_connections_shop_domain'),
    )
    op.create_index(op.f('ix_shopify_connections_id'), 'shopify_connections', ['id'])
    op.create_index(op.f('ix_shopify_connections_organization_id'), 'shopify_connections', ['organization_id'])
    op.create_index(op.f('ix_shopify_connections_shop_domain'), 'shopify_connections', ['shop_domain'])
    op.create_index(op.f('ix_shopify_connections_status'), 'shopify_connections', ['status'])
    op.create_index('ix_shopify_connections_org_status', 'shopify_connections', ['organization_id', 'status'])

    op.create_table(
        'shopify_sync_jobs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('connection_id', sa.UUID(), nullable=False),
        sa.Column('job_type', sa.String(), nullable=False, server_default='initial'),
        sa.Column('status', sa.String(), nullable=False, server_default='running'),
        sa.Column('products_synced', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('variants_synced', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('inventory_synced', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('orders_synced', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sales_records_synced', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['connection_id'], ['shopify_connections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_shopify_sync_jobs_id'), 'shopify_sync_jobs', ['id'])
    op.create_index(op.f('ix_shopify_sync_jobs_organization_id'), 'shopify_sync_jobs', ['organization_id'])
    op.create_index(op.f('ix_shopify_sync_jobs_connection_id'), 'shopify_sync_jobs', ['connection_id'])
    op.create_index(op.f('ix_shopify_sync_jobs_status'), 'shopify_sync_jobs', ['status'])
    op.create_index('ix_shopify_sync_jobs_org_started', 'shopify_sync_jobs', ['organization_id', 'started_at'])

    op.create_table(
        'shopify_webhook_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=True),
        sa.Column('webhook_id', sa.String(), nullable=False),
        sa.Column('topic', sa.String(), nullable=False),
        sa.Column('shop_domain', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='received'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('received_at', sa.DateTime(), nullable=False),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('webhook_id', name='uq_shopify_webhook_events_webhook_id'),
    )
    op.create_index(op.f('ix_shopify_webhook_events_id'), 'shopify_webhook_events', ['id'])
    op.create_index(op.f('ix_shopify_webhook_events_organization_id'), 'shopify_webhook_events', ['organization_id'])
    op.create_index(op.f('ix_shopify_webhook_events_webhook_id'), 'shopify_webhook_events', ['webhook_id'])
    op.create_index(op.f('ix_shopify_webhook_events_shop_domain'), 'shopify_webhook_events', ['shop_domain'])
    op.create_index('ix_shopify_webhook_events_org_topic', 'shopify_webhook_events', ['organization_id', 'topic'])

    op.create_table(
        'shopify_product_mappings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('connection_id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('shopify_product_id', sa.String(), nullable=False),
        sa.Column('shopify_variant_id', sa.String(), nullable=False),
        sa.Column('shopify_inventory_item_id', sa.String(), nullable=True),
        sa.Column('sku', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['connection_id'], ['shopify_connections.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'shopify_variant_id', name='uq_shopify_mapping_org_variant'),
    )
    op.create_index(op.f('ix_shopify_product_mappings_id'), 'shopify_product_mappings', ['id'])
    op.create_index(op.f('ix_shopify_product_mappings_organization_id'), 'shopify_product_mappings', ['organization_id'])
    op.create_index(op.f('ix_shopify_product_mappings_connection_id'), 'shopify_product_mappings', ['connection_id'])
    op.create_index(op.f('ix_shopify_product_mappings_product_id'), 'shopify_product_mappings', ['product_id'])
    op.create_index(op.f('ix_shopify_product_mappings_shopify_product_id'), 'shopify_product_mappings', ['shopify_product_id'])
    op.create_index(op.f('ix_shopify_product_mappings_shopify_variant_id'), 'shopify_product_mappings', ['shopify_variant_id'])
    op.create_index(op.f('ix_shopify_product_mappings_shopify_inventory_item_id'), 'shopify_product_mappings', ['shopify_inventory_item_id'])
    op.create_index(op.f('ix_shopify_product_mappings_sku'), 'shopify_product_mappings', ['sku'])
    op.create_index('ix_shopify_mapping_org_inventory_item', 'shopify_product_mappings', ['organization_id', 'shopify_inventory_item_id'])

    op.create_table(
        'shopify_oauth_states',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('shop_domain', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('consumed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('state', name='uq_shopify_oauth_states_state'),
    )
    op.create_index(op.f('ix_shopify_oauth_states_id'), 'shopify_oauth_states', ['id'])
    op.create_index(op.f('ix_shopify_oauth_states_state'), 'shopify_oauth_states', ['state'])
    op.create_index(op.f('ix_shopify_oauth_states_organization_id'), 'shopify_oauth_states', ['organization_id'])

    # --------------------------------------------------------------- Channels
    op.create_table(
        'channel_links',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('channel', sa.String(), nullable=False),
        sa.Column('external_id_hash', sa.String(), nullable=False),
        sa.Column('delivery_address_encrypted', sa.Text(), nullable=False),
        sa.Column('display_hint', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_message_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('channel', 'external_id_hash', name='uq_channel_links_channel_external'),
    )
    op.create_index(op.f('ix_channel_links_id'), 'channel_links', ['id'])
    op.create_index(op.f('ix_channel_links_organization_id'), 'channel_links', ['organization_id'])
    op.create_index(op.f('ix_channel_links_user_id'), 'channel_links', ['user_id'])
    op.create_index(op.f('ix_channel_links_channel'), 'channel_links', ['channel'])
    op.create_index(op.f('ix_channel_links_external_id_hash'), 'channel_links', ['external_id_hash'])
    op.create_index(op.f('ix_channel_links_status'), 'channel_links', ['status'])
    op.create_index('ix_channel_links_org_channel', 'channel_links', ['organization_id', 'channel'])

    op.create_table(
        'channel_link_codes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('channel', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('consumed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_channel_link_codes_code'),
    )
    op.create_index(op.f('ix_channel_link_codes_id'), 'channel_link_codes', ['id'])
    op.create_index(op.f('ix_channel_link_codes_code'), 'channel_link_codes', ['code'])
    op.create_index(op.f('ix_channel_link_codes_organization_id'), 'channel_link_codes', ['organization_id'])

    op.create_table(
        'channel_message_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('channel', sa.String(), nullable=False),
        sa.Column('external_event_id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='received'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('received_at', sa.DateTime(), nullable=False),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('channel', 'external_event_id', name='uq_channel_message_events_channel_event'),
    )
    op.create_index(op.f('ix_channel_message_events_id'), 'channel_message_events', ['id'])
    op.create_index(op.f('ix_channel_message_events_channel'), 'channel_message_events', ['channel'])
    op.create_index(op.f('ix_channel_message_events_external_event_id'), 'channel_message_events', ['external_event_id'])
    op.create_index(op.f('ix_channel_message_events_organization_id'), 'channel_message_events', ['organization_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('channel_message_events')
    op.drop_table('channel_link_codes')
    op.drop_table('channel_links')
    op.drop_table('shopify_oauth_states')
    op.drop_table('shopify_product_mappings')
    op.drop_table('shopify_webhook_events')
    op.drop_table('shopify_sync_jobs')
    op.drop_table('shopify_connections')
