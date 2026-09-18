"""add password reset tokens

Revision ID: b7e3a4f2c911
Revises: a1f89c45b7e2
Create Date: 2026-09-17 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "b7e3a4f2c911"
down_revision = "a1f89c45b7e2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    with op.batch_alter_table("password_reset_tokens", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_password_reset_tokens_token_hash"), ["token_hash"], unique=True)
        batch_op.create_index(batch_op.f("ix_password_reset_tokens_user_id"), ["user_id"], unique=False)


def downgrade():
    with op.batch_alter_table("password_reset_tokens", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_password_reset_tokens_user_id"))
        batch_op.drop_index(batch_op.f("ix_password_reset_tokens_token_hash"))
    op.drop_table("password_reset_tokens")
