from functools import wraps
from datetime import datetime, timezone
from typing import Any, Callable, TypeVar
from uuid import uuid4

import jwt
from flask import current_app, g, jsonify, request

from app import db
from app.models import AuthSession
from app.services.identity import AuthService

F = TypeVar("F", bound=Callable[..., Any])
auth_service = AuthService()


def create_access_token(user_id: int, session_jti: str) -> str:
    now = datetime.now(timezone.utc)
    expires_at = now + current_app.config["JWT_ACCESS_TOKEN_EXPIRES"]
    return jwt.encode(
        {
            "sub": str(user_id),
            "type": "access",
            # Bind the short-lived access token to the server-side refresh
            # session. Revoking that session now invalidates access immediately.
            "sid": session_jti,
            "iat": now,
            "exp": expires_at,
        },
        current_app.config["SECRET_KEY"],
        algorithm="HS256",
    )


def token_required(view: F) -> F:
    @wraps(view)
    def wrapped(*args: Any, **kwargs: Any):
        header = request.headers.get("Authorization", "")
        scheme, _, token = header.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return jsonify(
                {"error": {"code": "authentication_required", "message": "Bearer token is required"}}
            ), 401
        try:
            payload = jwt.decode(
                token,
                current_app.config["SECRET_KEY"],
                algorithms=["HS256"],
            )
            if payload.get("type", "access") != "access":
                raise jwt.InvalidTokenError("Not an access token")
            user_id = int(payload["sub"])
            session_jti = payload["sid"]
            if not isinstance(session_jti, str):
                raise jwt.InvalidTokenError("Access token session is invalid")

            session = db.session.scalar(
                db.select(AuthSession).where(AuthSession.jti == session_jti)
            )
            expires_at = (
                session.expires_at.replace(tzinfo=timezone.utc)
                if session is not None and session.expires_at.tzinfo is None
                else session.expires_at if session is not None else None
            )
            if (
                session is None
                or session.user_id != user_id
                or session.revoked_at is not None
                or expires_at is None
                or expires_at <= datetime.now(timezone.utc)
            ):
                raise jwt.InvalidTokenError("Access token session is invalid")
        except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
            return jsonify(
                {"error": {"code": "invalid_token", "message": "Token is invalid or expired"}}
            ), 401
        g.current_user = auth_service.get_user(user_id)
        g.current_session_jti = session_jti
        return view(*args, **kwargs)

    return wrapped  # type: ignore[return-value]


def create_refresh_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    jti = str(uuid4())
    expires_at = now + current_app.config["JWT_REFRESH_TOKEN_EXPIRES"]
    token = jwt.encode(
        {
            "sub": str(user_id),
            "type": "refresh",
            "jti": jti,
            "iat": now,
            "exp": expires_at,
        },
        current_app.config["SECRET_KEY"],
        algorithm="HS256",
    )
    db.session.add(
        AuthSession(user_id=user_id, jti=jti, expires_at=expires_at)
    )
    db.session.commit()
    return token


def revoke_refresh_token(
    token: str,
    *,
    user_id: int | None = None,
    session_jti: str | None = None,
) -> None:
    try:
        claims = jwt.decode(
            token,
            current_app.config["SECRET_KEY"],
            algorithms=["HS256"],
        )
        if claims.get("type") != "refresh" or not claims.get("jti"):
            return
    except jwt.InvalidTokenError:
        return
    statement = db.select(AuthSession).where(AuthSession.jti == claims["jti"])
    if user_id is not None:
        statement = statement.where(AuthSession.user_id == user_id)
    if session_jti is not None:
        statement = statement.where(AuthSession.jti == session_jti)
    session = db.session.scalar(statement)
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.session.commit()


def token_optional(view: F) -> F:
    @wraps(view)
    def wrapped(*args: Any, **kwargs: Any):
        header = request.headers.get("Authorization", "")
        if not header:
            g.current_user = None
            return view(*args, **kwargs)
        return token_required(view)(*args, **kwargs)

    return wrapped  # type: ignore[return-value]


def admin_required(view: F) -> F:
    @wraps(view)
    @token_required
    def wrapped(*args: Any, **kwargs: Any):
        if g.current_user.role.value != "admin":
            return jsonify({"error": {"code": "forbidden", "message": "Administrator role required"}}), 403
        return view(*args, **kwargs)

    return wrapped  # type: ignore[return-value]
