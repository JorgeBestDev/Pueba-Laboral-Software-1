from flask import Blueprint, g, jsonify, request

from app.api.auth import admin_required, token_required
from app.api.serializers import serialize_order
from app.services.commerce.order_service import OrderService
from app.services.commerce.payment_service import PaymentService
from app.schemas.validation import enum_value, integer_value, require_object, string_value, validate_payload

orders_bp = Blueprint("orders", __name__, url_prefix="/orders")
order_service = OrderService()
payment_service = PaymentService()


@orders_bp.post("/checkout")
@token_required
def checkout():
    payload = validate_payload(
        request.get_json(silent=True),
        required={"cart_id": lambda value: integer_value(value, field="cart_id", minimum=1)},
        optional={
            "shipping_address": lambda value: string_value(value, field="shipping_address", max_length=500),
            "address_id": lambda value: integer_value(value, field="address_id", minimum=1),
            "payment_method": lambda value: enum_value(
                value,
                field="payment_method",
                choices={"card", "paypal", "cash_on_delivery"},
            ),
        },
    )
    if "shipping_address" not in payload and "address_id" not in payload:
        from app.services.exceptions import ValidationError
        raise ValidationError("shipping_address or address_id is required")
    order = order_service.checkout(
        cart_id=payload.get("cart_id"),
        user_id=g.current_user.id,
        shipping_address=payload.get("shipping_address"),
        address_id=payload.get("address_id"),
        payment_method=payload.get("payment_method", "card"),
        idempotency_key=request.headers.get("Idempotency-Key"),
    )
    return jsonify({"data": serialize_order(order)}), 201


@orders_bp.get("/<int:order_id>")
@token_required
def get_order(order_id: int):
    order = order_service.get_order(order_id, g.current_user.id)
    return jsonify({"data": serialize_order(order)})


@orders_bp.post("/<int:order_id>/cancel")
@token_required
def cancel_order(order_id: int):
    return jsonify({"data": serialize_order(order_service.cancel(order_id, g.current_user.id))})


@orders_bp.patch("/<int:order_id>/status")
@admin_required
def update_order_status(order_id: int):
    payload = validate_payload(
        request.get_json(silent=True),
        required={
            "status": lambda value: enum_value(
                value,
                field="status",
                choices={"pending", "paid", "processing", "shipped", "completed", "cancelled"},
            )
        },
    )
    order = order_service.update_status(
        order_id, payload.get("status"), g.current_user.id
    )
    return jsonify({"data": serialize_order(order)})


@orders_bp.patch("/<int:order_id>/payment")
@admin_required
def update_payment(order_id: int):
    payload = validate_payload(
        request.get_json(silent=True),
        required={
            "status": lambda value: enum_value(
                value,
                field="status",
                choices={"pending", "authorized", "paid", "failed", "refunded"},
            )
        },
    )
    order = payment_service.update_status(
        order_id, payload.get("status"), g.current_user.id
    )
    return jsonify({"data": serialize_order(order)})


@orders_bp.patch("/<int:order_id>/shipment")
@admin_required
def update_shipment(order_id: int):
    payload = require_object(request.get_json(silent=True))
    order = order_service.update_shipment(
        order_id,
        payload.get("status"),
        g.current_user.id,
        tracking_number=payload.get("tracking_number"),
        carrier=payload.get("carrier"),
    )
    return jsonify({"data": serialize_order(order)})


@orders_bp.get("")
@token_required
def list_orders():
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), 100)
    orders, total = order_service.list_orders(
        g.current_user.id, page=page, per_page=per_page, status=request.args.get("status")
    )
    return jsonify(
        {
            "data": [serialize_order(order) for order in orders],
            "meta": {
                "page": page,
                "per_page": per_page,
                "count": len(orders),
                "total": total,
                "pages": (total + per_page - 1) // per_page,
            },
        }
    )
