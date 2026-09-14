from app import db
from app.models import User, UserRole
from app.services.exceptions import AuthenticationError, ValidationError


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
