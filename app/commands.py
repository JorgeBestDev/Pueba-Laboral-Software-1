from decimal import Decimal

import click

from app import db
from app.models import Category, Product, ProductVariant, User, UserRole


def register_commands(app):
    @app.cli.command("seed")
    def seed():
        """Create deterministic demo data for local development."""
        category = db.session.scalar(db.select(Category).where(Category.slug == "demo"))
        if category is None:
            category = Category(
                name="Demo",
                slug="demo",
                description="Catalog data for local development",
            )
            db.session.add(category)

        product = db.session.scalar(
            db.select(Product).where(Product.slug == "producto-demo")
        )
        if product is None:
            product = Product(
                name="Producto demo",
                slug="producto-demo",
                description="Producto de demostración",
                brand="Vokter",
                base_price=Decimal("25.00"),
                is_featured=True,
            )
            product.categories.append(category)
            product.variants.append(
                ProductVariant(
                    sku="DEMO-001",
                    name="Única",
                    price=Decimal("25.00"),
                    stock_quantity=50,
                )
            )
            db.session.add(product)

        user = db.session.scalar(
            db.select(User).where(User.email == "demo@vokter.local")
        )
        if user is None:
            user = User(
                email="demo@vokter.local",
                first_name="Demo",
                last_name="User",
            )
            user.set_password("demo-password")
            db.session.add(user)

        admin = db.session.scalar(
            db.select(User).where(User.email == "admin@vokter.com")
        )
        if admin is None:
            admin = User(
                email="admin@vokter.com",
                first_name="Admin",
                last_name="Vokter",
                role=UserRole.ADMIN,
            )
            admin.set_password("admin-password")
            db.session.add(admin)

        db.session.commit()
        click.echo("Demo data seeded successfully.")
