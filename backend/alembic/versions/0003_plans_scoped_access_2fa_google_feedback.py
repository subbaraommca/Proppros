"""plans, scoped access, 2fa, google, feedback

NOT NULL columns carry server defaults so existing rows (production data) migrate cleanly.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-17 16:49:06.204694
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('feedback',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('org_id', sa.Uuid(), nullable=True),
    sa.Column('kind', sqlmodel.sql.sqltypes.AutoString(length=10), nullable=False),
    sa.Column('message', sqlmodel.sql.sqltypes.AutoString(length=5000), nullable=False),
    sa.Column('page', sqlmodel.sql.sqltypes.AutoString(length=300), nullable=True),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=10), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('feedback', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_feedback_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_feedback_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_feedback_user_id'), ['user_id'], unique=False)

    with op.batch_alter_table('invitations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('property_ids', sa.JSON(), nullable=True))

    with op.batch_alter_table('memberships', schema=None) as batch_op:
        batch_op.add_column(sa.Column('property_ids', sa.JSON(), nullable=True))

    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('billing_customer_id', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True))
        batch_op.add_column(sa.Column('subscription_id', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True))
        batch_op.add_column(sa.Column('subscription_status', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False, server_default='none'))
        batch_op.add_column(sa.Column('current_period_end', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
        batch_op.add_column(sa.Column('plan_comped', sa.Boolean(), nullable=False, server_default=sa.false()))

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('mfa_secret', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True))
        batch_op.add_column(sa.Column('mfa_enabled_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
        batch_op.add_column(sa.Column('mfa_recovery_codes', sa.JSON(), nullable=False, server_default=sa.text("'[]'")))
        batch_op.add_column(sa.Column('google_sub', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True))
        batch_op.create_unique_constraint('uq_users_google_sub', ['google_sub'])



def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('uq_users_google_sub', type_='unique')
        batch_op.drop_column('google_sub')
        batch_op.drop_column('mfa_recovery_codes')
        batch_op.drop_column('mfa_enabled_at')
        batch_op.drop_column('mfa_secret')

    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.drop_column('plan_comped')
        batch_op.drop_column('current_period_end')
        batch_op.drop_column('subscription_status')
        batch_op.drop_column('subscription_id')
        batch_op.drop_column('billing_customer_id')

    with op.batch_alter_table('memberships', schema=None) as batch_op:
        batch_op.drop_column('property_ids')

    with op.batch_alter_table('invitations', schema=None) as batch_op:
        batch_op.drop_column('property_ids')

    with op.batch_alter_table('feedback', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_feedback_user_id'))
        batch_op.drop_index(batch_op.f('ix_feedback_status'))
        batch_op.drop_index(batch_op.f('ix_feedback_created_at'))

    op.drop_table('feedback')
