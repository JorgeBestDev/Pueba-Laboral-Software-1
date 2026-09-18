import hashlib
import logging
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from flask import current_app

from app import db
from app.models import AuthSession, PasswordResetToken, User, UserRole
from app.services.exceptions import AuthenticationError, DeliveryError, ValidationError

logger = logging.getLogger(__name__)


class AuthService:
    def register(
        self,
        email: str | None,
        password: str | None,
        first_name: str | None,
        last_name: str | None,
    ) -> User:
        normalized_email = email.strip().lower() if isinstance(email, str) else ""
        if not normalized_email or not password or not first_name or not last_name:
            raise ValidationError("email, password, first_name and last_name are required")
        if len(password) < 8:
            raise ValidationError("password must contain at least 8 characters")
        if db.session.query(User).filter_by(email=normalized_email).first():
            raise ValidationError("email is already registered")

        user = User(
            email=normalized_email,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            role=UserRole.CUSTOMER,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user

    def authenticate(self, email: str | None, password: str | None) -> User:
        normalized_email = email.strip().lower() if isinstance(email, str) else ""
        user = db.session.query(User).filter_by(email=normalized_email).first()
        if user is None or not user.is_active or not password or not user.check_password(password):
            raise AuthenticationError("Invalid email or password")
        return user

    def get_user(self, user_id: int) -> User:
        user = db.session.get(User, user_id)
        if user is None or not user.is_active:
            raise AuthenticationError("User is not available")
        return user

    def update_profile(
        self, user: User, email: str | None, first_name: str | None, last_name: str | None
    ) -> User:
        if email is not None:
            normalized_email = email.strip().lower()
            if not normalized_email:
                raise ValidationError("email cannot be empty")
            existing = db.session.query(User).filter(
                User.email == normalized_email, User.id != user.id
            ).first()
            if existing:
                raise ValidationError("email is already registered")
            user.email = normalized_email
        for field, value in (("first_name", first_name), ("last_name", last_name)):
            if value is not None:
                if not isinstance(value, str) or not value.strip():
                    raise ValidationError(f"{field} cannot be empty")
                setattr(user, field, value.strip())
        db.session.commit()
        return user

    def change_password(self, user: User, current_password: str | None, new_password: str | None) -> None:
        if not current_password or not user.check_password(current_password):
            raise AuthenticationError("Current password is invalid")
        if not new_password or len(new_password) < 8:
            raise ValidationError("new_password must contain at least 8 characters")
        user.set_password(new_password)
        db.session.commit()

    def request_password_reset(self, email: str, email_service) -> bool:
        user = db.session.query(User).filter_by(email=email.strip().lower()).first()
        if user is None or not user.is_active:
            return False

        now = datetime.now(timezone.utc)
        for previous in db.session.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        ):
            previous.used_at = now

        raw_token = secrets.token_urlsafe(32)
        token = PasswordResetToken(
            user_id=user.id,
            token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
            expires_at=now + timedelta(seconds=current_app.config["PASSWORD_RESET_TTL_SECONDS"]),
        )
        db.session.add(token)
        db.session.flush()

        base_url = current_app.config["PASSWORD_RESET_URL"].rstrip("/")
        separator = "&" if "?" in base_url else "?"
        reset_url = f"{base_url}{separator}token={quote(raw_token)}"
        try:
            email_service.send_password_reset(user.email, reset_url)
        except (OSError, RuntimeError, smtplib.SMTPException) as error:
            db.session.rollback()
            logger.exception("Password reset email delivery failed")
            message = (
                "El servicio de correo no está configurado"
                if isinstance(error, RuntimeError)
                else "El servicio de correo no está disponible"
            )
            raise DeliveryError(message) from error

        db.session.commit()
        return True

    def reset_password(self, raw_token: str, new_password: str) -> None:
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        token = db.session.scalar(
            db.select(PasswordResetToken)
            .where(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > datetime.now(timezone.utc),
            )
            .with_for_update()
        )
        if token is None:
            raise ValidationError("El enlace de recuperación no es válido o ya expiró")
        if len(new_password) < 8:
            raise ValidationError("new_password must contain at least 8 characters")

        now = datetime.now(timezone.utc)
        token.user.set_password(new_password)
        token.used_at = now
        for session in db.session.query(AuthSession).filter(
            AuthSession.user_id == token.user_id,
            AuthSession.revoked_at.is_(None),
        ):
            session.revoked_at = now
        db.session.commit()
