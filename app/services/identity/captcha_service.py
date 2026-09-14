"""Self-contained math captcha used to slow down attacks on the admin login.

The challenge/answer pair is never stored server-side: the expected answer is
signed (JWT, HS256) and handed back to the client alongside the question, and
verified again on submit. This keeps the admin login endpoint free of any
external dependency (reCAPTCHA/hCaptcha keys, Redis, etc.) while still adding
real friction against scripted brute-force attempts.
"""
import random
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from flask import current_app

from app.services.exceptions import ValidationError

_PURPOSE = "admin_captcha"
_OPERATIONS = ("+", "-", "x")


class CaptchaService:
    def generate(self) -> dict[str, Any]:
        left = random.randint(1, 12)
        right = random.randint(1, 12)
        operation = random.choice(_OPERATIONS)
        if operation == "+":
            answer = left + right
        elif operation == "-":
            left, right = max(left, right), min(left, right)
            answer = left - right
        else:
            left, right = random.randint(1, 9), random.randint(1, 9)
            answer = left * right

        ttl = current_app.config["CAPTCHA_TOKEN_TTL_SECONDS"]
        now = datetime.now(timezone.utc)
        token = jwt.encode(
            {
                "purpose": _PURPOSE,
                "answer": answer,
                "iat": now,
                "exp": now + timedelta(seconds=ttl),
            },
            current_app.config["SECRET_KEY"],
            algorithm="HS256",
        )
        return {
            "question": f"¿Cuánto es {left} {operation} {right}?",
            "token": token,
            "expires_in": ttl,
        }

    def verify(self, token: Any, answer: Any) -> None:
        if not isinstance(token, str) or not token.strip():
            raise ValidationError("captcha_token is required")
        if answer is None or isinstance(answer, bool):
            raise ValidationError("captcha_answer is required")
        try:
            claims = jwt.decode(
                token, current_app.config["SECRET_KEY"], algorithms=["HS256"]
            )
        except jwt.ExpiredSignatureError as error:
            raise ValidationError("El captcha ha expirado, solicita uno nuevo") from error
        except jwt.InvalidTokenError as error:
            raise ValidationError("Captcha inválido") from error
        if claims.get("purpose") != _PURPOSE:
            raise ValidationError("Captcha inválido")
        try:
            provided = int(answer)
        except (TypeError, ValueError) as error:
            raise ValidationError("La respuesta del captcha debe ser numérica") from error
        if provided != claims.get("answer"):
            raise ValidationError("La respuesta del captcha es incorrecta")
