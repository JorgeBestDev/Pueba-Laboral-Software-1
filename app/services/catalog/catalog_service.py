from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app import db
from app.models import Category, Product, ProductVariant
from app.services.exceptions import ResourceNotFoundError


class CatalogService:
    def list_products(
        self,
        search: str,
        featured: bool,
        page: int,
        per_page: int,
        category: str | None = None,
        brand: str | None = None,
        min_price: float | None = None,
        max_price: float | None = None,
        available: bool = False,
        sort: str = "newest",
    ) -> tuple[list[Product], int]:
        query = select(Product).where(Product.is_active.is_(True))
        if search:
            term = f"%{search}%"
            query = query.join(Product.variants, isouter=True).where(
                or_(
                    Product.name.ilike(term),
                    Product.description.ilike(term),
                    Product.brand.ilike(term),
                    ProductVariant.sku.ilike(term),
                )
            ).distinct()
        if featured:
            query = query.where(Product.is_featured.is_(True))
        if brand:
            query = query.where(Product.brand.ilike(brand))
        if min_price is not None:
            query = query.where(Product.base_price >= min_price)
        if max_price is not None:
            query = query.where(Product.base_price <= max_price)
        if available:
            query = query.where(Product.variants.any(ProductVariant.stock_quantity > 0))
        if category:
            query = query.join(Product.categories).where(Category.slug == category)
        order = {
            "newest": Product.created_at.desc(),
            "price_asc": Product.base_price.asc(),
            "price_desc": Product.base_price.desc(),
            "name": Product.name.asc(),
        }.get(sort, Product.created_at.desc())
        total = db.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        products = db.session.scalars(
            query.order_by(order)
            .options(
                selectinload(Product.categories),
                selectinload(Product.reviews),
                selectinload(Product.variants),
            )
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
        return products, total

    def get_product(self, product_id: int) -> Product:
        product = db.session.get(Product, product_id)
        if product is None:
            raise ResourceNotFoundError("Product not found")
        return product

    def get_product_by_slug(self, slug: str) -> Product:
        product = db.session.scalar(
            select(Product).where(Product.slug == slug, Product.is_active.is_(True))
        )
        if product is None:
            raise ResourceNotFoundError("Product not found")
        return product

    def list_filters(self) -> dict:
        brands = db.session.scalars(
            select(Product.brand)
            .where(Product.is_active.is_(True), Product.brand.is_not(None))
            .distinct()
            .order_by(Product.brand.asc())
        ).all()
        prices = db.session.execute(
            select(func.min(Product.base_price), func.max(Product.base_price))
            .where(Product.is_active.is_(True))
        ).one()
        return {
            "brands": list(brands),
            "price": {
                "min": str(prices[0]) if prices[0] is not None else None,
                "max": str(prices[1]) if prices[1] is not None else None,
            },
        }

    def list_categories(self) -> list[Category]:
        return db.session.scalars(
            select(Category)
            .where(Category.is_active.is_(True))
            .order_by(Category.name.asc())
        ).all()
