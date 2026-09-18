from decimal import Decimal, InvalidOperation

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app import db
from app.models import Category, Product, ProductVariant
from app.services.exceptions import ResourceNotFoundError, ValidationError


class AdminCatalogService:
    def list_categories(self) -> list[Category]:
        return db.session.scalars(select(Category).order_by(Category.name.asc())).all()

    def list_products(
        self, search: str | None = None, page: int = 1, per_page: int = 20
    ) -> tuple[list[Product], int]:
        query = select(Product)
        if search:
            like = f"%{search.strip()}%"
            query = query.where(or_(Product.name.ilike(like), Product.brand.ilike(like)))
        total = db.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        products = db.session.scalars(
            query.order_by(Product.created_at.desc())
            .options(
                selectinload(Product.categories),
                selectinload(Product.variants),
                selectinload(Product.images),
                selectinload(Product.reviews),
            )
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
        return products, total

    def get_product(self, product_id: int) -> Product:
        product = db.session.scalar(
            select(Product)
            .where(Product.id == product_id)
            .options(
                selectinload(Product.categories),
                selectinload(Product.variants),
                selectinload(Product.images),
                selectinload(Product.reviews),
            )
        )
        if product is None:
            raise ResourceNotFoundError("Product not found")
        return product

    def create_category(self, data: dict) -> Category:
        name = self._required_string(data, "name", 100)
        slug = self._required_string(data, "slug", 120)
        category = Category(
            name=name,
            slug=slug,
            description=self._optional_string(data.get("description")),
            is_active=data.get("is_active", True),
        )
        db.session.add(category)
        db.session.commit()
        return category

    def update_category(self, category_id: int, data: dict) -> Category:
        category = db.session.get(Category, category_id)
        if category is None:
            raise ResourceNotFoundError("Category not found")
        for field, max_length in (("name", 100), ("slug", 120)):
            if field in data:
                setattr(category, field, self._required_string(data, field, max_length))
        if "description" in data:
            category.description = self._optional_string(data["description"])
        if "is_active" in data:
            category.is_active = self._required_bool(data, "is_active")
        db.session.commit()
        return category

    def delete_category(self, category_id: int) -> Category:
        category = db.session.get(Category, category_id)
        if category is None:
            raise ResourceNotFoundError("Category not found")
        category.is_active = False
        db.session.commit()
        return category

    def create_product(self, data: dict) -> Product:
        product = Product(
            name=self._required_string(data, "name", 180),
            slug=self._required_string(data, "slug", 200),
            description=self._optional_string(data.get("description")),
            brand=self._optional_string(data.get("brand")),
            base_price=self._decimal(data, "base_price"),
            is_active=data.get("is_active", True),
            is_featured=data.get("is_featured", False),
        )
        self._set_categories(product, data.get("category_ids"))
        db.session.add(product)
        db.session.commit()
        return product

    def update_product(self, product_id: int, data: dict) -> Product:
        product = self._get_product(product_id)
        string_fields = (("name", 180), ("slug", 200), ("description", 10000), ("brand", 100))
        for field, max_length in string_fields:
            if field in data:
                setattr(
                    product,
                    field,
                    self._optional_string(data[field], max_length)
                    if data[field] is not None
                    else None,
                )
        if "base_price" in data:
            product.base_price = self._decimal(data, "base_price")
        for field in ("is_active", "is_featured"):
            if field in data:
                setattr(product, field, self._required_bool(data, field))
        if "category_ids" in data:
            self._set_categories(product, data["category_ids"])
        db.session.commit()
        return product

    def delete_product(self, product_id: int) -> Product:
        product = self._get_product(product_id)
        product.is_active = False
        for variant in product.variants:
            variant.is_active = False
        db.session.commit()
        return product

    def create_variant(self, product_id: int, data: dict) -> ProductVariant:
        product = self._get_product(product_id)
        variant = ProductVariant(
            product=product,
            sku=self._required_string(data, "sku", 80),
            name=self._required_string(data, "name", 120),
            price=self._decimal(data, "price"),
            stock_quantity=self._non_negative_int(data, "stock_quantity"),
            is_active=data.get("is_active", True),
        )
        db.session.add(variant)
        db.session.commit()
        return variant

    def update_variant(self, variant_id: int, data: dict) -> ProductVariant:
        variant = db.session.get(ProductVariant, variant_id)
        if variant is None:
            raise ResourceNotFoundError("Product variant not found")
        for field, max_length in (("sku", 80), ("name", 120)):
            if field in data:
                setattr(variant, field, self._required_string(data, field, max_length))
        if "price" in data:
            variant.price = self._decimal(data, "price")
        if "stock_quantity" in data:
            variant.stock_quantity = self._non_negative_int(data, "stock_quantity")
        if "is_active" in data:
            variant.is_active = self._required_bool(data, "is_active")
        db.session.commit()
        return variant

    def _get_product(self, product_id: int) -> Product:
        product = db.session.get(Product, product_id)
        if product is None:
            raise ResourceNotFoundError("Product not found")
        return product

    def _set_categories(self, product: Product, category_ids: object) -> None:
        if category_ids is None:
            return
        if not isinstance(category_ids, list) or any(
            isinstance(category_id, bool) or not isinstance(category_id, int)
            for category_id in category_ids
        ):
            raise ValidationError("category_ids must be an array of integers")
        categories = db.session.scalars(
            select(Category).where(Category.id.in_(category_ids))
        ).all()
        if len(categories) != len(set(category_ids)):
            raise ResourceNotFoundError("One or more categories were not found")
        product.categories = list(categories)

    @staticmethod
    def _required_string(data: dict, field: str, max_length: int) -> str:
        value = data.get(field)
        if not isinstance(value, str) or not value.strip():
            raise ValidationError(f"{field} is required")
        value = value.strip()
        if len(value) > max_length:
            raise ValidationError(f"{field} must not exceed {max_length} characters")
        return value

    @staticmethod
    def _optional_string(value: object, max_length: int = 255) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValidationError("Text fields must be strings")
        value = value.strip()
        if len(value) > max_length:
            raise ValidationError(f"Text value must not exceed {max_length} characters")
        return value or None

    @staticmethod
    def _decimal(data: dict, field: str) -> Decimal:
        value = data.get(field)
        try:
            decimal = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError) as error:
            raise ValidationError(f"{field} must be a valid decimal") from error
        if decimal < 0:
            raise ValidationError(f"{field} must not be negative")
        return decimal.quantize(Decimal("0.01"))

    @staticmethod
    def _non_negative_int(data: dict, field: str) -> int:
        value = data.get(field)
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValidationError(f"{field} must be a non-negative integer")
        return value

    @staticmethod
    def _required_bool(data: dict, field: str) -> bool:
        value = data.get(field)
        if not isinstance(value, bool):
            raise ValidationError(f"{field} must be a boolean")
        return value
