import enum
from typing import Any

from sqlalchemy import JSON, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app import db
from app.models.common import TimestampMixin


class UserEventType(enum.Enum):
    VIEW_PRODUCT = "view_product"
    SEARCH = "search"
    ADD_TO_CART = "add_to_cart"
    PURCHASE = "purchase"
    REVIEW = "review"


class UserEvent(TimestampMixin, db.Model):
    """Behavioral events for analytics and future recommendations."""

    __tablename__ = "user_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    event_type: Mapped[UserEventType] = mapped_column(Enum(UserEventType), nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"))
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON)
    session_key: Mapped[str | None] = mapped_column(String(100), index=True)

    user: Mapped["User | None"] = relationship(back_populates="events")
    product: Mapped["Product | None"] = relationship()
