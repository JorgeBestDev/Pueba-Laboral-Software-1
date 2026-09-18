from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app import db
from app.models import Order, OrderStatus, Product, ProductVariant, Review, User, UserRole
from app.models.commerce.order import OrderItem

LOW_STOCK_THRESHOLD = 5
RECENT_ORDERS_LIMIT = 8
LOW_STOCK_LIMIT = 6

# Order of the pipeline shown on the dashboard, oldest stage first.
_STATUS_PIPELINE = [
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
]
_STATUS_LABELS = {
    OrderStatus.PENDING: "Pendiente",
    OrderStatus.PAID: "Pagado",
    OrderStatus.PROCESSING: "En preparación",
    OrderStatus.SHIPPED: "Enviado",
    OrderStatus.COMPLETED: "Completado",
    OrderStatus.CANCELLED: "Cancelado",
}
_ACTIVE_STATUSES = (
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
)


class AdminDashboardService:
    def get_summary(self) -> dict:
        counts_by_status = self._counts_by_status()
        total_orders = sum(counts_by_status.values())
        active_orders = sum(counts_by_status.get(status, 0) for status in _ACTIVE_STATUSES)
        completed_orders = counts_by_status.get(OrderStatus.COMPLETED, 0)

        month_start = datetime.now(timezone.utc).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        sales_month_total = db.session.scalar(
            select(func.coalesce(func.sum(Order.total), 0)).where(
                Order.status != OrderStatus.CANCELLED,
                Order.created_at >= month_start,
            )
        ) or Decimal("0")
        sales_all_time_total = db.session.scalar(
            select(func.coalesce(func.sum(Order.total), 0)).where(
                Order.status != OrderStatus.CANCELLED
            )
        ) or Decimal("0")

        customers_count = db.session.scalar(
            select(func.count()).select_from(User).where(User.role == UserRole.CUSTOMER)
        ) or 0
        products_count = db.session.scalar(
            select(func.count()).select_from(Product).where(Product.is_active.is_(True))
        ) or 0
        average_rating = db.session.scalar(select(func.avg(Review.rating)))

        return {
            "kpis": {
                "active_orders": active_orders,
                "completed_orders": completed_orders,
                "total_orders": total_orders,
                "sales_month_total": str(Decimal(sales_month_total).quantize(Decimal("0.01"))),
                "sales_all_time_total": str(Decimal(sales_all_time_total).quantize(Decimal("0.01"))),
                "customers_count": customers_count,
                "products_count": products_count,
                "average_rating": round(float(average_rating), 2) if average_rating else None,
            },
            "orders_by_status": [
                {
                    "status": status.value,
                    "label": _STATUS_LABELS[status],
                    "count": counts_by_status.get(status, 0),
                    "percentage": (
                        round(counts_by_status.get(status, 0) / total_orders * 100, 1)
                        if total_orders
                        else 0
                    ),
                }
                for status in _STATUS_PIPELINE
            ],
            "low_stock_alerts": self._low_stock_alerts(),
            "recent_orders": self._recent_orders(),
        }

    def _counts_by_status(self) -> dict[OrderStatus, int]:
        rows = db.session.execute(
            select(Order.status, func.count()).group_by(Order.status)
        ).all()
        return {status: count for status, count in rows}

    def _low_stock_alerts(self) -> list[dict]:
        variants = db.session.scalars(
            select(ProductVariant)
            .join(Product)
            .where(
                ProductVariant.is_active.is_(True),
                Product.is_active.is_(True),
                ProductVariant.stock_quantity <= LOW_STOCK_THRESHOLD,
            )
            .options(selectinload(ProductVariant.product))
            .order_by(ProductVariant.stock_quantity.asc())
            .limit(LOW_STOCK_LIMIT)
        ).all()
        return [
            {
                "variant_id": variant.id,
                "product_name": variant.product.name,
                "variant_name": variant.name,
                "sku": variant.sku,
                "stock_quantity": variant.stock_quantity,
                "threshold": LOW_STOCK_THRESHOLD,
            }
            for variant in variants
        ]

    def _recent_orders(self) -> list[dict]:
        orders = db.session.scalars(
            select(Order)
            .options(
                selectinload(Order.user),
                selectinload(Order.items),
                selectinload(Order.payment),
            )
            .order_by(Order.created_at.desc())
            .limit(RECENT_ORDERS_LIMIT)
        ).all()
        result = []
        for order in orders:
            result.append(
                {
                    "id": order.id,
                    "customer_name": f"{order.user.first_name} {order.user.last_name}".strip(),
                    "customer_email": order.user.email,
                    "status": order.status.value,
                    "status_label": _STATUS_LABELS[order.status],
                    "total": str(order.total),
                    "items_count": sum(item.quantity for item in order.items),
                    "payment_status": order.payment.status.value if order.payment else None,
                    "created_at": order.created_at.isoformat(),
                }
            )
        return result
