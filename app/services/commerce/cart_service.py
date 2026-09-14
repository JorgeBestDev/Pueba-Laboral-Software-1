from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app import db
from app.models import Cart, CartItem, ProductVariant
from app.services.exceptions import (
    AuthenticationError,
    BusinessRuleError,
    ResourceNotFoundError,
    ValidationError,
)


class CartService:
    def create_cart(self, user_id: int | None, session_key: str | None) -> Cart:
        if user_id is not None and session_key:
            raise ValidationError("Use either user_id or session_key, not both")
        if user_id is None and not session_key:
            raise ValidationError("user_id or session_key is required")

        if session_key is not None:
            if not isinstance(session_key, str) or not session_key.strip():
                raise ValidationError("session_key must be a non-empty string")
            session_key = session_key.strip()
            existing = db.session.scalar(
                select(Cart).where(Cart.session_key == session_key, Cart.status == "active")
            )
            if existing is not None:
                return existing
        if user_id is not None:
            existing = db.session.scalar(
                select(Cart).where(Cart.user_id == user_id, Cart.status == "active")
            )
            if existing is not None:
                return existing
        cart = Cart(user_id=user_id, session_key=session_key)
        db.session.add(cart)
        try:
            db.session.commit()
        except IntegrityError:
            # Two concurrent requests (e.g. a duplicated client-side effect) raced to create
            # the same anonymous or per-user cart. The unique constraint means one of them
            # already committed, so recover by returning that cart instead of failing the request.
            db.session.rollback()
            existing = db.session.scalar(
                select(Cart).where(
                    Cart.session_key == session_key if session_key is not None else Cart.user_id == user_id,
                    Cart.status == "active",
                )
            )
            if existing is None:
                raise
            return existing
        return cart

    def get_current(self, user_id: int) -> Cart:
        cart = db.session.scalar(
            select(Cart).where(Cart.user_id == user_id, Cart.status == "active")
        )
        if cart is None:
            return self.create_cart(user_id=user_id, session_key=None)
        return cart

    def get_cart(
        self,
        cart_id: int,
        user_id: int | None = None,
        session_key: str | None = None,
    ) -> Cart:
        if user_id is None and not session_key:
            raise AuthenticationError("Authentication or X-Cart-Session is required")
        cart = db.session.get(Cart, cart_id)
        if cart is None:
            raise ResourceNotFoundError("Cart not found")
        if user_id is not None and cart.user_id != user_id:
            raise ResourceNotFoundError("Cart not found")
        if user_id is None and (not session_key or cart.session_key != session_key):
            raise ResourceNotFoundError("Cart not found")
        return cart

    def add_item(
        self,
        cart_id: int,
        variant_id: int,
        quantity: int,
        user_id: int | None = None,
        session_key: str | None = None,
    ) -> Cart:
        if not isinstance(variant_id, int) or not isinstance(quantity, int) or quantity < 1:
            raise ValidationError("variant_id and positive quantity are required")

        cart = self.get_cart(cart_id, user_id=user_id, session_key=session_key)
        variant = db.session.get(ProductVariant, variant_id)
        if variant is None:
            raise ResourceNotFoundError("Product variant not found")
        if not variant.is_active or variant.stock_quantity < quantity:
            raise BusinessRuleError("Variant is unavailable or lacks stock")

        item = db.session.scalar(
            select(CartItem).where(
                CartItem.cart_id == cart.id,
                CartItem.variant_id == variant.id,
            )
        )
        requested_quantity = quantity + item.quantity if item else quantity
        if requested_quantity > variant.stock_quantity:
            raise BusinessRuleError("Requested quantity exceeds stock")

        if item:
            item.quantity = requested_quantity
        else:
            db.session.add(
                CartItem(
                    cart=cart,
                    variant_id=variant.id,
                    quantity=quantity,
                    unit_price=Decimal(variant.price),
                )
            )
        db.session.commit()
        return cart

    def update_item(
        self,
        cart_id: int,
        item_id: int,
        quantity: int,
        user_id: int | None = None,
        session_key: str | None = None,
    ) -> Cart:
        if not isinstance(quantity, int) or quantity < 1:
            raise ValidationError("quantity must be a positive integer")
        cart = self.get_cart(cart_id, user_id=user_id, session_key=session_key)
        item = db.session.scalar(
            select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
        )
        if item is None:
            raise ResourceNotFoundError("Cart item not found")
        if not item.variant.is_active or item.variant.stock_quantity < quantity:
            raise BusinessRuleError("Requested quantity exceeds stock")
        item.quantity = quantity
        db.session.commit()
        return cart

    def remove_item(
        self,
        cart_id: int,
        item_id: int,
        user_id: int | None = None,
        session_key: str | None = None,
    ) -> Cart:
        cart = self.get_cart(cart_id, user_id=user_id, session_key=session_key)
        item = db.session.scalar(
            select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
        )
        if item is None:
            raise ResourceNotFoundError("Cart item not found")
        db.session.delete(item)
        db.session.commit()
        return cart

    def clear(self, cart_id: int, user_id: int | None = None, session_key: str | None = None) -> Cart:
        cart = self.get_cart(cart_id, user_id=user_id, session_key=session_key)
        cart.items.clear()
        db.session.commit()
        return cart

    def merge_anonymous(self, user_id: int, session_key: str) -> Cart:
        if not isinstance(session_key, str) or not session_key.strip():
            raise ValidationError("session_key must be a non-empty string")
        session_key = session_key.strip()
        anonymous = db.session.scalar(
            select(Cart).where(
                Cart.session_key == session_key,
                Cart.user_id.is_(None),
                Cart.status == "active",
            )
        )
        if anonymous is None:
            raise ResourceNotFoundError("Anonymous cart not found")
        user_cart = db.session.scalar(
            select(Cart).where(Cart.user_id == user_id, Cart.status == "active")
        )
        if user_cart is None:
            user_cart = Cart(user_id=user_id, status="active")
            db.session.add(user_cart)
            try:
                db.session.flush()
            except IntegrityError:
                # Another concurrent request already created the user's cart; reuse it.
                db.session.rollback()
                anonymous = db.session.scalar(
                    select(Cart).where(
                        Cart.session_key == session_key,
                        Cart.user_id.is_(None),
                        Cart.status == "active",
                    )
                )
                user_cart = db.session.scalar(
                    select(Cart).where(Cart.user_id == user_id, Cart.status == "active")
                )
                if anonymous is None or user_cart is None:
                    raise ResourceNotFoundError("Anonymous cart not found")
        source_items = list(anonymous.items)
        for source_item in source_items:
            target_item = db.session.scalar(
                select(CartItem).where(
                    CartItem.cart_id == user_cart.id,
                    CartItem.variant_id == source_item.variant_id,
                )
            )
            target_quantity = (target_item.quantity if target_item else 0) + source_item.quantity
            if target_quantity > source_item.variant.stock_quantity:
                raise BusinessRuleError(
                    f"Cannot merge quantity for variant {source_item.variant.sku}"
                )
        for source_item in source_items:
            target_item = db.session.scalar(
                select(CartItem).where(
                    CartItem.cart_id == user_cart.id,
                    CartItem.variant_id == source_item.variant_id,
                )
            )
            target_quantity = (target_item.quantity if target_item else 0) + source_item.quantity
            if target_item:
                target_item.quantity = target_quantity
            else:
                user_cart.items.append(
                    CartItem(
                        variant_id=source_item.variant_id,
                        quantity=source_item.quantity,
                        unit_price=source_item.unit_price,
                    )
                )
        db.session.delete(anonymous)
        db.session.commit()
        return user_cart
