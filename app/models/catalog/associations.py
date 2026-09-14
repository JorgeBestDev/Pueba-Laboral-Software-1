from sqlalchemy import Column, ForeignKey, Table

from app import db

product_categories = Table(
    "product_categories",
    db.metadata,
    Column("product_id", ForeignKey("products.id"), primary_key=True),
    Column("category_id", ForeignKey("categories.id"), primary_key=True),
)
