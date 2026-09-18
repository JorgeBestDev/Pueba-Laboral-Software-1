"""add Cloudinary public IDs to product images

Revision ID: c4d8a1e2f7b9
Revises: b7e3a4f2c911
Create Date: 2026-09-18 01:00:00

"""
from alembic import op
import sqlalchemy as sa


revision = "c4d8a1e2f7b9"
down_revision = "b7e3a4f2c911"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("product_images", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("cloudinary_public_id", sa.String(length=255), nullable=True)
        )


def downgrade():
    with op.batch_alter_table("product_images", schema=None) as batch_op:
        batch_op.drop_column("cloudinary_public_id")
