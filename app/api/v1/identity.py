from datetime import datetime, timezone

from flask import Blueprint, current_app, g, jsonify, request

import jwt
from flask import current_app

from app.api.auth import (
    create_access_token,
    create_refresh_token,
    revoke_refresh_token,
    token_required,
)
from app import db, limiter
from app.models import AuthSession
from app.schemas.validation import (
    email_value,
    require_object,
    require_string,
    string_value,
    validate_payload,
)
from app.services.identity import AuthService, EmailService

identity_bp = Blueprint("identity", __name__, url_prefix="/auth")
auth_service = AuthService()
email_service = EmailService()


def serialize_user(user) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role.value,
        "is_active": user.is_active,
    }


@identity_bp.post("/register")
def register():
    payload = validate_payload(
        request.get_json(silent=True),
        required={"email": email_value, "password": lambda value: string_value(value, field="password", max_length=128)},
        optional={
            "first_name": lambda value: string_value(value, field="first_name", max_length=100),
            "last_name": lambda value: string_value(value, field="last_name", max_length=100),
        },
    )
    user = auth_service.register(
        email=payload.get("email"),
        password=payload.get("password"),
        first_name=payload.get("first_name"),
        last_name=payload.get("last_name"),
    )
    return jsonify(
        {
            "data": {
                "user": serialize_user(user),
                "access_token": create_access_token(user.id),
                "refresh_token": create_refresh_token(user.id),
            }
        }
    ), 201


@identity_bp.post("/login")
def login():
    payload = validate_payload(
        request.get_json(silent=True),
        required={
            "email": email_value,
            "password": lambda value: string_value(value, field="password", max_length=128),
        },
    )
    user = auth_service.authenticate(payload.get("email"), payload.get("password"))
    return jsonify(
        {
            "data": {
                "user": serialize_user(user),
                "access_token": create_access_token(user.id),
                "refresh_token": create_refresh_token(user.id),
            }
        }
    )


@identity_bp.get("/me")
@token_required
def me():
    return jsonify({"data": serialize_user(g.current_user)})


@identity_bp.patch("/me")
@token_required
def update_me():
    payload = validate_payload(
        request.get_json(silent=True),
        optional={
            "email": email_value,
            "first_name": lambda value: string_value(value, field="first_name", max_length=100),
            "last_name": lambda value: string_value(value, field="last_name", max_length=100),
        },
    )
    user = auth_service.update_profile(
        g.current_user,
        payload.get("email"),
        payload.get("first_name"),
        payload.get("last_name"),
    )
    return jsonify({"data": serialize_user(user)})


@identity_bp.patch("/me/password")
@token_required
def change_password():
    payload = validate_payload(
        request.get_json(silent=True),
        required={
            "current_password": lambda value: string_value(value, field="current_password", max_length=128),
            "new_password": lambda value: string_value(value, field="new_password", max_length=128),
        },
    )
    auth_service.change_password(
        g.current_user,
        payload.get("current_password"),
        payload.get("new_password"),
    )
    return "", 204


@identity_bp.post("/password-reset/request")
@limiter.limit(lambda: current_app.config["PASSWORD_RESET_RATE_LIMIT"])
def request_password_reset():
    payload = validate_payload(
        request.get_json(silent=True),
        required={"email": email_value},
    )
    auth_service.request_password_reset(payload["email"], email_service)
    return jsonify(
        {
            "data": {
                "message": (
                    "Si existe una cuenta asociada a ese correo, "
                    "recibirás instrucciones para restablecer tu contraseña."
                )
            }
        }
    ), 202


@identity_bp.post("/password-reset/confirm")
def confirm_password_reset():
    payload = validate_payload(
        request.get_json(silent=True),
        required={
            "token": lambda value: string_value(value, field="token", max_length=256),
            "new_password": lambda value: string_value(value, field="new_password", max_length=128),
        },
    )
    auth_service.reset_password(payload["token"], payload["new_password"])
    return "", 204


@identity_bp.post("/refresh")
def refresh():
    payload = require_object(request.get_json(silent=True))
    try:
        claims = jwt.decode(
            payload["refresh_token"],
            current_app.config["SECRET_KEY"],
            algorithms=["HS256"],
        )
        if claims.get("type") != "refresh":
            raise jwt.InvalidTokenError("Invalid refresh type")
        session = db.session.scalar(
            db.select(AuthSession).where(AuthSession.jti == claims.get("jti"))
        )
        expires_at = (
            session.expires_at.replace(tzinfo=timezone.utc)
            if session is not None and session.expires_at.tzinfo is None
            else session.expires_at if session is not None else None
        )
        if (
            session is None
            or session.revoked_at is not None
            or expires_at <= datetime.now(timezone.utc)
        ):
            raise jwt.InvalidTokenError("Refresh session is invalid")
        user = auth_service.get_user(int(claims["sub"]))
    except (KeyError, TypeError, ValueError, jwt.InvalidTokenError):
        return jsonify({"error": {"code": "invalid_token", "message": "Refresh token is invalid or expired"}}), 401
    new_refresh_token = create_refresh_token(user.id)
    new_claims = jwt.decode(
        new_refresh_token,
        current_app.config["SECRET_KEY"],
        algorithms=["HS256"],
    )
    session.revoked_at = datetime.now(timezone.utc)
    session.replaced_by_jti = new_claims["jti"]
    db.session.commit()
    return jsonify(
        {
            "data": {
                "access_token": create_access_token(user.id),
                "refresh_token": new_refresh_token,
            }
        }
    )


@identity_bp.post("/logout")
@token_required
def logout():
    payload = require_object(request.get_json(silent=True))
    revoke_refresh_token(require_string(payload, "refresh_token", max_length=4096))
    return "", 204
