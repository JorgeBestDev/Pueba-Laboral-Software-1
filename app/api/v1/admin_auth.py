from flask import Blueprint, current_app, jsonify, request

from app import limiter
from app.api.v1.identity import issue_token_pair, serialize_user
from app.schemas.validation import email_value, require_object, string_value
from app.services.exceptions import AuthenticationError
from app.services.identity import AuthService, CaptchaService

admin_auth_bp = Blueprint("admin_auth", __name__, url_prefix="/admin/auth")
auth_service = AuthService()
captcha_service = CaptchaService()


@admin_auth_bp.get("/captcha")
@limiter.limit(lambda: current_app.config["ADMIN_CAPTCHA_RATE_LIMIT"])
def get_captcha():
    return jsonify({"data": captcha_service.generate()})


@admin_auth_bp.post("/login")
@limiter.limit(lambda: current_app.config["ADMIN_LOGIN_RATE_LIMIT"])
def admin_login():
    payload = require_object(request.get_json(silent=True))
    captcha_service.verify(payload.get("captcha_token"), payload.get("captcha_answer"))

    email = email_value(payload.get("email"))
    password = string_value(payload.get("password"), field="password", max_length=128)
    user = auth_service.authenticate(email, password)
    if user.role.value != "admin":
        raise AuthenticationError("Se requiere una cuenta de administrador")

    access_token, refresh_token = issue_token_pair(user.id)
    return jsonify(
        {
            "data": {
                "user": serialize_user(user),
                "access_token": access_token,
                "refresh_token": refresh_token,
            }
        }
    )
