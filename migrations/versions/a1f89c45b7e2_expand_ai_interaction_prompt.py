"""expand ai interaction prompt

Revision ID: a1f89c45b7e2
Revises: 893155259edd
Create Date: 2026-09-14 08:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1f89c45b7e2'
down_revision = '893155259edd'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('ai_interactions', schema=None) as batch_op:
        batch_op.alter_column(
            'prompt',
            existing_type=sa.String(length=2000),
            type_=sa.String(length=10000),
            existing_nullable=False,
        )


def downgrade():
    with op.batch_alter_table('ai_interactions', schema=None) as batch_op:
        batch_op.alter_column(
            'prompt',
            existing_type=sa.String(length=10000),
            type_=sa.String(length=2000),
            existing_nullable=False,
        )
