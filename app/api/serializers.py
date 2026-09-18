from decimal import Decimal
from typing import Any

from app.models import (
    Cart,
    Category,
    Product,
    ProductVariant,
    Review,
    Order,
    Address,
    Wishlist,
)


def _decimal(value: Decimal | None) -> str | None:
    return str(value) if value is not None else None


def serialize_variant(variant: ProductVariant) -> dict[str, Any]:
    return {
        "id": variant.id,
        "sku": variant.sku,
        "name": variant.name,
        "price": _decimal(variant.price),
        "stock_quantity": variant.stock_quantity,
        "is_active": variant.is_active,
    }


def serialize_category(category: Category, include_products: bool = False) -> dict[str, Any]:
    data = {
        "id": category.id,
        "name": category.name,
        "slug": category.slug,
        "description": category.description,
        "is_active": category.is_active,
    }
    if include_products:
        data["products"] = [serialize_product(product) for product in category.products]
    return data


def serialize_product(
    product: Product, include_details: bool = False, include_variants: bool = False
) -> dict[str, Any]:
    ratings = [review.rating for review in product.reviews]
    data = {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "description": product.description,
        "brand": product.brand,
        "base_price": _decimal(product.base_price),
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "categories": [
            serialize_category(category) for category in product.categories
        ],
        "reviews": {
            "count": len(ratings),
            "average": round(sum(ratings) / len(ratings), 2) if ratings else None,
        },
    }
    if include_details:
        data["images"] = [
            {
                "id": image.id,
                "url": image.url,
                "alt_text": image.alt_text,
                "sort_order": image.sort_order,
            }
            for image in sorted(product.images, key=lambda i: i.sort_order)
        ]
        data["variants"] = [serialize_variant(variant) for variant in product.variants]
    elif include_variants:
        # The list endpoint includes the first image so the catalog grid can
        # display the product thumbnail without a second round-trip.
        data["variants"] = [serialize_variant(variant) for variant in product.variants]
        images_sorted = sorted(product.images, key=lambda i: i.sort_order)
        data["images"] = [
            {
                "id": image.id,
                "url": image.url,
                "alt_text": image.alt_text,
                "sort_order": image.sort_order,
            }
            for image in images_sorted[:1]  # only the primary image for the grid
        ]
    return data


def serialize_cart(cart: Cart) -> dict[str, Any]:
    items = []
    for item in cart.items:
        product = item.variant.product
        primary_image = min(product.images, key=lambda image: image.sort_order, default=None)
        available_variants = [
            {
                "id": variant.id,
                "name": variant.name,
                "price": _decimal(variant.price),
                "stock_quantity": variant.stock_quantity,
            }
            for variant in product.variants
            if variant.is_active and variant.stock_quantity > 0
        ]
        items.append(
            {
                "id": item.id,
                "variant_id": item.variant_id,
                "variant_name": item.variant.name,
                "product_name": product.name,
                "product_slug": product.slug,
                "image_url": primary_image.url if primary_image else None,
                "available_variants": available_variants,
                "quantity": item.quantity,
                "unit_price": _decimal(item.unit_price),
            }
        )
    total = Decimal("0")
    for item in items:
        unit_price = Decimal(item["unit_price"]) if item["unit_price"] else Decimal("0")
        total += unit_price * item["quantity"]
    return {
        "id": cart.id,
        "user_id": cart.user_id,
        "session_key": cart.session_key,
        "status": cart.status,
        "items": items,
        "total": str(total.quantize(Decimal("0.01"))),
    }


def serialize_review(review: Review) -> dict[str, Any]:
    return {
        "id": review.id,
        "user_id": review.user_id,
        "product_id": review.product_id,
        "rating": review.rating,
        "title": review.title,
        "content": review.content,
        "is_verified_purchase": review.is_verified_purchase,
    }


def serialize_order(order: Order, include_customer: bool = False) -> dict[str, Any]:
    data = {
        "id": order.id,
        "user_id": order.user_id,
        "status": order.status.value,
        "total": _decimal(order.total),
        "shipping_address": order.shipping_address,
        "shipping_address_snapshot": order.shipping_address_snapshot,
        "items": [
            {
                "id": item.id,
                "variant_id": item.variant_id,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price": _decimal(item.unit_price),
            }
            for item in order.items
        ],
        "status_history": [
            {
                "status": history.status.value,
                "note": history.note,
                "created_at": history.created_at.isoformat(),
            }
            for history in order.status_history
        ],
        "payment": (
            {
                "id": order.payment.id,
                "status": order.payment.status.value,
                "method": order.payment.method.value,
                "amount": _decimal(order.payment.amount),
                "provider": order.payment.provider,
                "provider_reference": order.payment.provider_reference,
            }
            if order.payment
            else None
        ),
        "shipment": (
            {
                "id": order.shipment.id,
                "status": order.shipment.status.value,
                "tracking_number": order.shipment.tracking_number,
                "carrier": order.shipment.carrier,
            }
            if order.shipment
            else None
        ),
        "created_at": order.created_at.isoformat(),
    }
    if include_customer:
        data["customer"] = {
            "id": order.user.id,
            "name": f"{order.user.first_name} {order.user.last_name}".strip(),
            "email": order.user.email,
        }
    return data


def serialize_address(address: Address) -> dict[str, Any]:
    return {
        "id": address.id,
        "label": address.label,
        "street": address.street,
        "city": address.city,
        "state": address.state,
        "postal_code": address.postal_code,
        "country": address.country,
        "is_default": address.is_default,
    }


def serialize_wishlist(wishlist: Wishlist) -> dict[str, Any]:
    return {
        "id": wishlist.id,
        "name": wishlist.name,
        "items": [
            {
                "id": item.id,
                "product": serialize_product(item.product),
            }
            for item in wishlist.items
        ],
    }
