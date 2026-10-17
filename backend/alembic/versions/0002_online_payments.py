"""online payments (Stripe Connect, autopay, payment status)

NOT NULL columns carry server defaults so existing rows (production data) migrate cleanly.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-17 16:16:54.382070
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('stripe_events',
    sa.Column('id', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
    sa.Column('event_type', sqlmodel.sql.sqltypes.AutoString(length=60), nullable=False),
    sa.Column('processed_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('autopay_enrollments',
    sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.Column('updated_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('org_id', sa.Uuid(), nullable=False),
    sa.Column('lease_id', sa.Uuid(), nullable=False),
    sa.Column('tenant_id', sa.Uuid(), nullable=False),
    sa.Column('stripe_customer_id', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
    sa.Column('stripe_payment_method_id', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
    sa.Column('method_type', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
    sa.Column('method_label', sqlmodel.sql.sqltypes.AutoString(length=60), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['lease_id'], ['leases.id'], ),
    sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('lease_id', 'tenant_id', name='uq_autopay_lease_tenant')
    )
    with op.batch_alter_table('autopay_enrollments', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_autopay_enrollments_lease_id'), ['lease_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_autopay_enrollments_org_id'), ['org_id'], unique=False)

    with op.batch_alter_table('leases', schema=None) as batch_op:
        batch_op.add_column(sa.Column('block_online_payments', sa.Boolean(), nullable=False, server_default=sa.false()))

    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('stripe_account_id', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True))
        batch_op.add_column(sa.Column('stripe_charges_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('stripe_payouts_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('stripe_details_submitted', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('online_payments_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('allow_partial_payments', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.add_column(sa.Column('pass_card_fee', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('returned_payment_fee_cents', sa.Integer(), nullable=False, server_default='0'))

    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=12), nullable=False, server_default='succeeded'))
        batch_op.add_column(sa.Column('source', sqlmodel.sql.sqltypes.AutoString(length=10), nullable=False, server_default='manual'))
        batch_op.add_column(sa.Column('fee_cents', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('stripe_payment_intent_id', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True))
        batch_op.add_column(sa.Column('failure_reason', sqlmodel.sql.sqltypes.AutoString(length=300), nullable=True))
        batch_op.create_unique_constraint('uq_payments_stripe_payment_intent_id', ['stripe_payment_intent_id'])

    with op.batch_alter_table('tenants', schema=None) as batch_op:
        batch_op.add_column(sa.Column('stripe_customer_id', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True))



def downgrade() -> None:
    with op.batch_alter_table('tenants', schema=None) as batch_op:
        batch_op.drop_column('stripe_customer_id')

    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.drop_constraint('uq_payments_stripe_payment_intent_id', type_='unique')
        batch_op.drop_column('failure_reason')
        batch_op.drop_column('stripe_payment_intent_id')
        batch_op.drop_column('fee_cents')
        batch_op.drop_column('source')
        batch_op.drop_column('status')

    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.drop_column('returned_payment_fee_cents')
        batch_op.drop_column('pass_card_fee')
        batch_op.drop_column('allow_partial_payments')
        batch_op.drop_column('online_payments_enabled')
        batch_op.drop_column('stripe_details_submitted')
        batch_op.drop_column('stripe_payouts_enabled')
        batch_op.drop_column('stripe_charges_enabled')
        batch_op.drop_column('stripe_account_id')

    with op.batch_alter_table('leases', schema=None) as batch_op:
        batch_op.drop_column('block_online_payments')

    with op.batch_alter_table('autopay_enrollments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_autopay_enrollments_org_id'))
        batch_op.drop_index(batch_op.f('ix_autopay_enrollments_lease_id'))

    op.drop_table('autopay_enrollments')
    op.drop_table('stripe_events')
