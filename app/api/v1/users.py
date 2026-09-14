from flask import Blueprint, g, jsonify, request

from app.api.auth import token_required
from app.api.serializers import serialize_address
from app.schemas.validation import require_object
from app.services.identity import AddressService

users_bp = Blueprint("users", __name__, url_prefix="/users/me/addresses")
address_service = AddressService()


@users_bp.get("")
@token_required
def list_addresses():
    return jsonify(
        {"data": [serialize_address(address) for address in address_service.list(g.current_user.id)]}
    )


@users_bp.post("")
@token_required
def create_address():
    address = address_service.create(g.current_user.id, require_object(request.get_json(silent=True)))
    return jsonify({"data": serialize_address(address)}), 201


@users_bp.patch("/<int:address_id>")
@token_required
def update_address(address_id: int):
    address = address_service.update(
        g.current_user.id, address_id, require_object(request.get_json(silent=True))
    )
    return jsonify({"data": serialize_address(address)})


@users_bp.delete("/<int:address_id>")
@token_required
def delete_address(address_id: int):
    address_service.delete(g.current_user.id, address_id)
    return "", 204
