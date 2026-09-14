import enum

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app import db
from app.models.common import TimestampMixin


class ShipmentStatus(enum.Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    RETURNED = "returned"


class Shipment(TimestampMixin, db.Model):
    __tablename__ = "shipments"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"), nullable=False, unique=True, index=True
    )
    status: Mapped[ShipmentStatus] = mapped_column(
        Enum(ShipmentStatus), default=ShipmentStatus.PENDING, nullable=False
    )
    tracking_number: Mapped[str | None] = mapped_column(String(120), unique=True)
    carrier: Mapped[str | None] = mapped_column(String(100))

    order: Mapped["Order"] = relationship(back_populates="shipment")
