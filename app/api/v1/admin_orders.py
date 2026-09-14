from flask import Blueprint, g, jsonify, request

from app.api.auth import admin_required
from app.api.serializers import serialize_order
from app.services.commerce.order_service import OrderService
from app.services.commerce.payment_service import PaymentService
from app.schemas.validation import enum_value, require_object, validate_payload

admin_orders_bp = Blueprint("admin_orders", __name__, url_prefix="/admin/orders")
order_service = OrderService()
payment_service = PaymentService()


@admin_orders_bp.get("")
@admin_required
def list_all_orders():
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), 100)
    orders, total = order_service.list_all_orders(
        page=page,
        per_page=per_page,
        status=request.args.get("status"),
        search=request.args.get("q"),
    )
    return jsonify(
        {
            "data": [serialize_order(order, include_customer=True) for order in orders],
            "meta": {
                "page": page,
                "per_page": per_page,
                "count": len(orders),
                "total": total,
                "pages": (total + per_page - 1) // per_page,
            },
        }
    )


@admin_orders_bp.get("/<int:order_id>")
@admin_required
def get_any_order(order_id: int):
    order = order_service.get_order_any(order_id)
    return jsonify({"data": serialize_order(order, include_customer=True)})


@admin_orders_bp.patch("/<int:order_id>/status")
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
    order = order_service.update_status(order_id, payload.get("status"), g.current_user.id)
    return jsonify({"data": serialize_order(order, include_customer=True)})


@admin_orders_bp.patch("/<int:order_id>/payment")
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
    order = payment_service.update_status(order_id, payload.get("status"), g.current_user.id)
    return jsonify({"data": serialize_order(order, include_customer=True)})


@admin_orders_bp.patch("/<int:order_id>/shipment")
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
    return jsonify({"data": serialize_order(order, include_customer=True)})
