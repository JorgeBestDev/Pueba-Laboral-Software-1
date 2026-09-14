from flask import Blueprint, g, jsonify, request

from app.api.auth import token_optional, token_required
from app.api.serializers import serialize_cart
from app.schemas.validation import integer_value, require_object, validate_payload
from app.services.commerce import CartService

cart_bp = Blueprint("cart", __name__, url_prefix="/carts")
cart_service = CartService()


@cart_bp.post("")
@token_optional
def create_cart():
    payload = require_object(request.get_json(silent=True))
    cart = cart_service.create_cart(
        user_id=g.current_user.id if g.current_user else None,
        session_key=None if g.current_user else request.headers.get("X-Cart-Session") or payload.get("session_key"),
    )
    return jsonify({"data": serialize_cart(cart)}), 201


@cart_bp.post("/merge")
@token_required
def merge_cart():
    payload = require_object(request.get_json(silent=True))
    cart = cart_service.merge_anonymous(g.current_user.id, payload.get("session_key"))
    return jsonify({"data": serialize_cart(cart)})


@cart_bp.get("/current")
@token_required
def current_cart():
    return jsonify({"data": serialize_cart(cart_service.get_current(g.current_user.id))})


@cart_bp.get("/<int:cart_id>")
@token_optional
def get_cart(cart_id: int):
    cart = cart_service.get_cart(
        cart_id,
        user_id=g.current_user.id if g.current_user else None,
        session_key=None if g.current_user else request.headers.get("X-Cart-Session"),
    )
    return jsonify({"data": serialize_cart(cart)})


@cart_bp.post("/<int:cart_id>/items")
@token_optional
def add_cart_item(cart_id: int):
    payload = validate_payload(
        request.get_json(silent=True),
        required={
            "variant_id": lambda value: integer_value(value, field="variant_id", minimum=1),
        },
        optional={
            "quantity": lambda value: integer_value(value, field="quantity", minimum=1),
        },
    )
    cart = cart_service.add_item(
        cart_id=cart_id,
        variant_id=payload.get("variant_id"),
        quantity=payload.get("quantity", 1),
        user_id=g.current_user.id if g.current_user else None,
        session_key=None if g.current_user else request.headers.get("X-Cart-Session"),
    )
    return jsonify({"data": serialize_cart(cart)}), 201


@cart_bp.patch("/<int:cart_id>/items/<int:item_id>")
@token_optional
def update_cart_item(cart_id: int, item_id: int):
    payload = validate_payload(
        request.get_json(silent=True),
        required={"quantity": lambda value: integer_value(value, field="quantity", minimum=1)},
    )
    cart = cart_service.update_item(
        cart_id,
        item_id,
        payload.get("quantity"),
        user_id=g.current_user.id if g.current_user else None,
        session_key=None if g.current_user else request.headers.get("X-Cart-Session"),
    )
    return jsonify({"data": serialize_cart(cart)})


@cart_bp.delete("/<int:cart_id>/items/<int:item_id>")
@token_optional
def remove_cart_item(cart_id: int, item_id: int):
    cart = cart_service.remove_item(
        cart_id,
        item_id,
        user_id=g.current_user.id if g.current_user else None,
        session_key=None if g.current_user else request.headers.get("X-Cart-Session"),
    )
    return jsonify({"data": serialize_cart(cart)})


@cart_bp.delete("/<int:cart_id>/items")
@token_optional
def clear_cart(cart_id: int):
    cart = cart_service.clear(
        cart_id,
        user_id=g.current_user.id if g.current_user else None,
        session_key=None if g.current_user else request.headers.get("X-Cart-Session"),
    )
    return jsonify({"data": serialize_cart(cart)})
