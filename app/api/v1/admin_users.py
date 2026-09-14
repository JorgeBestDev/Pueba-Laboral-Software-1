from flask import Blueprint, g, jsonify, request

from app.api.auth import admin_required
from app.schemas.validation import require_object
from app.services.identity import AdminUserService

admin_users_bp = Blueprint("admin_users", __name__, url_prefix="/admin/users")
admin_user_service = AdminUserService()


def _serialize_user(user, with_stats: bool = False) -> dict:
    data = {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role.value,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat(),
    }
    if with_stats:
        data["stats"] = admin_user_service.get_stats(user.id)
    return data


@admin_users_bp.get("")
@admin_required
def list_users():
    page = max(request.args.get("page", 1, type=int), 1)
    per_page = min(max(request.args.get("per_page", 20, type=int), 1), 100)
    is_active_param = request.args.get("is_active")
    is_active = None
    if is_active_param is not None:
        is_active = is_active_param.lower() == "true"
    users, total = admin_user_service.list_users(
        page=page,
        per_page=per_page,
        search=request.args.get("q"),
        role=request.args.get("role"),
        is_active=is_active,
    )
    return jsonify(
        {
            "data": [_serialize_user(user) for user in users],
            "meta": {
                "page": page,
                "per_page": per_page,
                "count": len(users),
                "total": total,
                "pages": (total + per_page - 1) // per_page,
            },
        }
    )


@admin_users_bp.get("/<int:user_id>")
@admin_required
def get_user(user_id: int):
    user = admin_user_service.get_user(user_id)
    return jsonify({"data": _serialize_user(user, with_stats=True)})


@admin_users_bp.post("")
@admin_required
def create_user():
    user = admin_user_service.create_user(require_object(request.get_json(silent=True)))
    return jsonify({"data": _serialize_user(user)}), 201


@admin_users_bp.patch("/<int:user_id>")
@admin_required
def update_user(user_id: int):
    user = admin_user_service.update_user(
        user_id, require_object(request.get_json(silent=True)), g.current_user.id
    )
    return jsonify({"data": _serialize_user(user)})


@admin_users_bp.delete("/<int:user_id>")
@admin_required
def deactivate_user(user_id: int):
    user = admin_user_service.deactivate_user(user_id, g.current_user.id)
    return jsonify({"data": _serialize_user(user)})
