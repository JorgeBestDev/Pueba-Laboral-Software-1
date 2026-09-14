from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app import db
from app.models.common import TimestampMixin


class AIInteraction(TimestampMixin, db.Model):
    """Stores explainable AI requests/results without coupling to a provider."""

    __tablename__ = "ai_interactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    use_case: Mapped[str] = mapped_column(String(80), nullable=False)
    prompt: Mapped[str] = mapped_column(String(10000), nullable=False)
    response: Mapped[str | None] = mapped_column(String(10000))
    provider: Mapped[str | None] = mapped_column(String(80))
    model: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(30), default="completed", nullable=False)
