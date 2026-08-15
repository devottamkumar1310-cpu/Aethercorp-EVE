"""Add Stripe billing tables

Revision ID: d2b3c4e5f6a8
Revises: c1a2b3d4e5f7
Create Date: 2026-08-15 12:00:00.000000

Adds the three tables backing Stripe billing: stripe_customers (one Stripe
Customer per workspace), stripe_subscriptions (subscription lifecycle state —
the source of truth for plan entitlement), and stripe_webhook_events (delivery
idempotency ledger). Every table carries organization_id so the existing
tenant-isolation rules apply without change. Fully reversible.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2b3c4e5f6a8'
down_revision: Union[str, Sequence[str], None] = 'c1a2b3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'stripe_customers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('stripe_customer_id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', name='uq_stripe_customers_organization'),
        sa.UniqueConstraint('stripe_customer_id', name='uq_stripe_customers_customer_id'),
    )
    op.create_index(op.f('ix_stripe_customers_id'), 'stripe_customers', ['id'])
    op.create_index(op.f('ix_stripe_customers_organization_id'), 'stripe_customers', ['organization_id'])
    op.create_index(op.f('ix_stripe_customers_user_id'), 'stripe_customers', ['user_id'])
    op.create_index(op.f('ix_stripe_customers_stripe_customer_id'), 'stripe_customers', ['stripe_customer_id'])

    op.create_table(
        'stripe_subscriptions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('stripe_customer_id', sa.String(), nullable=False),
        sa.Column('stripe_subscription_id', sa.String(), nullable=False),
        sa.Column('stripe_price_id', sa.String(), nullable=True),
        sa.Column('plan_key', sa.String(), nullable=False, server_default='operator'),
        sa.Column('billing_interval', sa.String(), nullable=False, server_default='month'),
        sa.Column('status', sa.String(), nullable=False, server_default='incomplete'),
        sa.Column('amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('currency', sa.String(), nullable=True),
        sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('current_period_start', sa.DateTime(), nullable=True),
        sa.Column('current_period_end', sa.DateTime(), nullable=True),
        sa.Column('trial_start', sa.DateTime(), nullable=True),
        sa.Column('trial_end', sa.DateTime(), nullable=True),
        sa.Column('canceled_at', sa.DateTime(), nullable=True),
        sa.Column('raw', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('stripe_subscription_id', name='uq_stripe_subscriptions_subscription_id'),
    )
    op.create_index(op.f('ix_stripe_subscriptions_id'), 'stripe_subscriptions', ['id'])
    op.create_index(op.f('ix_stripe_subscriptions_organization_id'), 'stripe_subscriptions', ['organization_id'])
    op.create_index(op.f('ix_stripe_subscriptions_user_id'), 'stripe_subscriptions', ['user_id'])
    op.create_index(op.f('ix_stripe_subscriptions_stripe_customer_id'), 'stripe_subscriptions', ['stripe_customer_id'])
    op.create_index(op.f('ix_stripe_subscriptions_stripe_subscription_id'), 'stripe_subscriptions', ['stripe_subscription_id'])
    op.create_index(op.f('ix_stripe_subscriptions_stripe_price_id'), 'stripe_subscriptions', ['stripe_price_id'])
    op.create_index(op.f('ix_stripe_subscriptions_plan_key'), 'stripe_subscriptions', ['plan_key'])
    op.create_index(op.f('ix_stripe_subscriptions_status'), 'stripe_subscriptions', ['status'])
    op.create_index('ix_stripe_subscriptions_org_status', 'stripe_subscriptions', ['organization_id', 'status'])

    op.create_table(
        'stripe_webhook_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('stripe_event_id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='received'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('received_at', sa.DateTime(), nullable=False),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('stripe_event_id', name='uq_stripe_webhook_events_event_id'),
    )
    op.create_index(op.f('ix_stripe_webhook_events_id'), 'stripe_webhook_events', ['id'])
    op.create_index(op.f('ix_stripe_webhook_events_stripe_event_id'), 'stripe_webhook_events', ['stripe_event_id'])
    op.create_index(op.f('ix_stripe_webhook_events_event_type'), 'stripe_webhook_events', ['event_type'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('stripe_webhook_events')
    op.drop_table('stripe_subscriptions')
    op.drop_table('stripe_customers')
