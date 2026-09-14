from flask import Blueprint, g, jsonify, request

from app.api.auth import token_required
from app.api.serializers import serialize_wishlist
from app.schemas.validation import integer_value, validate_payload
from app.services.social import WishlistService

wishlist_bp = Blueprint("wishlist", __name__, url_prefix="/wishlist")
wishlist_service = WishlistService()


@wishlist_bp.get("")
@token_required
def get_wishlist():
    return jsonify({"data": serialize_wishlist(wishlist_service.get_or_create(g.current_user.id))})


@wishlist_bp.post("/items")
@token_required
def add_wishlist_item():
    payload = validate_payload(
        request.get_json(silent=True),
        required={"product_id": lambda value: integer_value(value, field="product_id", minimum=1)},
    )
    wishlist = wishlist_service.add_item(g.current_user.id, payload.get("product_id"))
    return jsonify({"data": serialize_wishlist(wishlist)}), 201


@wishlist_bp.delete("/items/<int:item_id>")
@token_required
def remove_wishlist_item(item_id: int):
    wishlist = wishlist_service.remove_item(g.current_user.id, item_id)
    return jsonify({"data": serialize_wishlist(wishlist)})
