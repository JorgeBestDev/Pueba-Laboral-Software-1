from sqlalchemy import func, or_, select

from app import db
from app.models import Order, OrderStatus, User, UserRole
from app.services.exceptions import BusinessRuleError, ResourceNotFoundError, ValidationError


class AdminUserService:
    def list_users(
        self,
        page: int = 1,
        per_page: int = 20,
        search: str | None = None,
        role: str | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[User], int]:
        query = select(User)
        if search:
            like = f"%{search.strip()}%"
            query = query.where(
                or_(
                    User.email.ilike(like),
                    User.first_name.ilike(like),
                    User.last_name.ilike(like),
                )
            )
        if role:
            try:
                query = query.where(User.role == UserRole(role))
            except ValueError as error:
                raise ValidationError("Invalid role") from error
        if is_active is not None:
            query = query.where(User.is_active == is_active)
        total = db.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        users = db.session.scalars(
            query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
        ).all()
        return users, total

    def get_user(self, user_id: int) -> User:
        user = db.session.get(User, user_id)
        if user is None:
            raise ResourceNotFoundError("User not found")
        return user

    def get_stats(self, user_id: int) -> dict:
        user = self.get_user(user_id)
        orders_count = db.session.scalar(
            select(func.count()).select_from(Order).where(Order.user_id == user_id)
        ) or 0
        total_spent = db.session.scalar(
            select(func.coalesce(func.sum(Order.total), 0)).where(
                Order.user_id == user_id, Order.status != OrderStatus.CANCELLED
            )
        ) or 0
        return {"orders_count": orders_count, "total_spent": str(total_spent)}

    def create_user(self, data: dict) -> User:
        email = self._required_email(data)
        password = data.get("password")
        if not isinstance(password, str) or len(password) < 8:
            raise ValidationError("password must contain at least 8 characters")
        first_name = self._required_string(data, "first_name", 100)
        last_name = self._required_string(data, "last_name", 100)
        role = self._role_from(data.get("role", UserRole.CUSTOMER.value))
        if db.session.query(User).filter_by(email=email).first():
            raise ValidationError("email is already registered")
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_active=data.get("is_active", True),
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user

    def update_user(self, user_id: int, data: dict, current_admin_id: int) -> User:
        user = self.get_user(user_id)
        if "email" in data:
            email = self._required_email(data)
            existing = db.session.query(User).filter(
                User.email == email, User.id != user.id
            ).first()
            if existing:
                raise ValidationError("email is already registered")
            user.email = email
        for field, max_length in (("first_name", 100), ("last_name", 100)):
            if field in data:
                setattr(user, field, self._required_string(data, field, max_length))
        if "role" in data:
            if user.id == current_admin_id and data["role"] != UserRole.ADMIN.value:
                raise BusinessRuleError("You cannot remove your own administrator role")
            user.role = self._role_from(data["role"])
        if "is_active" in data:
            if user.id == current_admin_id and data["is_active"] is False:
                raise BusinessRuleError("You cannot deactivate your own account")
            if not isinstance(data["is_active"], bool):
                raise ValidationError("is_active must be a boolean")
            user.is_active = data["is_active"]
        if "password" in data and data["password"]:
            if not isinstance(data["password"], str) or len(data["password"]) < 8:
                raise ValidationError("password must contain at least 8 characters")
            user.set_password(data["password"])
        db.session.commit()
        return user

    def deactivate_user(self, user_id: int, current_admin_id: int) -> User:
        if user_id == current_admin_id:
            raise BusinessRuleError("You cannot deactivate your own account")
        user = self.get_user(user_id)
        user.is_active = False
        db.session.commit()
        return user

    @staticmethod
    def _required_email(data: dict) -> str:
        value = data.get("email")
        if not isinstance(value, str) or not value.strip():
            raise ValidationError("email is required")
        return value.strip().lower()

    @staticmethod
    def _required_string(data: dict, field: str, max_length: int) -> str:
        value = data.get(field)
        if not isinstance(value, str) or not value.strip():
            raise ValidationError(f"{field} is required")
        value = value.strip()
        if len(value) > max_length:
            raise ValidationError(f"{field} must not exceed {max_length} characters")
        return value

    @staticmethod
    def _role_from(value: object) -> UserRole:
        if not isinstance(value, str):
            raise ValidationError("role must be a string")
        try:
            return UserRole(value)
        except ValueError as error:
            raise ValidationError("role must be customer or admin") from error
