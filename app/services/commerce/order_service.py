from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app import db
from app.models import (
    Address,
    Cart,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    PaymentMethod,
    Shipment,
    ShipmentStatus,
    User,
)
from app.services.exceptions import BusinessRuleError, ResourceNotFoundError, ValidationError
from app.services.commerce.payment_service import PaymentService

payment_service = PaymentService()


class OrderService:
    def checkout(
        self,
        cart_id: int,
        user_id: int,
        shipping_address: str | None,
        payment_method: str = PaymentMethod.CARD.value,
        idempotency_key: str | None = None,
        address_id: int | None = None,
    ) -> Order:
        if not isinstance(cart_id, int):
            raise ValidationError("cart_id is required")
        if not isinstance(idempotency_key, str) or not idempotency_key.strip():
            raise ValidationError("Idempotency-Key header is required")
        idempotency_key = idempotency_key.strip()
        if len(idempotency_key) > 128:
            raise ValidationError("Idempotency-Key must not exceed 128 characters")
        address = None
        if address_id is not None:
            address = db.session.get(Address, address_id)
            if address is None or address.user_id != user_id:
                raise ResourceNotFoundError("Address not found")
            shipping_address = ", ".join(
                filter(None, [address.street, address.city, address.state, address.postal_code, address.country])
            )
        if not shipping_address or not shipping_address.strip():
            raise ValidationError("shipping_address is required")
        existing_order = db.session.scalar(
            select(Order).where(
                Order.user_id == user_id,
                Order.idempotency_key == idempotency_key,
            )
        )
        if existing_order is not None:
            return existing_order

        cart = db.session.get(Cart, cart_id)
        if cart is None:
            raise ResourceNotFoundError("Cart not found")
        if cart.user_id != user_id:
            raise BusinessRuleError("Cart does not belong to the authenticated user")
        if cart.status != "active":
            raise BusinessRuleError("Cart has already been checked out")
        if not cart.items:
            raise BusinessRuleError("Cannot checkout an empty cart")

        total = Decimal("0.00")
        order = Order(
            user_id=user_id,
            status=OrderStatus.PENDING,
            total=Decimal("0.00"),
            shipping_address=shipping_address.strip(),
            address_id=address.id if address else None,
            shipping_address_snapshot=(
                {
                    "label": address.label,
                    "street": address.street,
                    "city": address.city,
                    "state": address.state,
                    "postal_code": address.postal_code,
                    "country": address.country,
                }
                if address
                else {"street": shipping_address.strip()}
            ),
            idempotency_key=idempotency_key,
        )
        db.session.add(order)

        for cart_item in cart.items:
            variant = cart_item.variant
            if not variant.is_active or variant.stock_quantity < cart_item.quantity:
                raise BusinessRuleError(
                    f"Insufficient stock for variant {variant.sku}"
                )
            unit_price = Decimal(variant.price)
            total += unit_price * cart_item.quantity
            order.items.append(
                OrderItem(
                    variant_id=variant.id,
                    product_name=variant.product.name,
                    quantity=cart_item.quantity,
                    unit_price=unit_price,
                )
            )
            variant.stock_quantity -= cart_item.quantity

        order.total = total
        order.payment = payment_service.create_pending_payment(
            order, total, payment_method
        )
        order.shipment = Shipment(status=ShipmentStatus.PENDING)
        order.status_history.append(
            OrderStatusHistory(status=OrderStatus.PENDING, note="Order created")
        )
        cart.status = "checked_out"
        cart.items.clear()
        db.session.commit()
        return order

    def update_shipment(
        self,
        order_id: int,
        status: str,
        admin_id: int,
        tracking_number: str | None = None,
        carrier: str | None = None,
    ) -> Order:
        order = db.session.get(Order, order_id)
        if order is None or order.shipment is None:
            raise ResourceNotFoundError("Order shipment not found")
        try:
            next_status = ShipmentStatus(status)
        except ValueError as error:
            raise ValidationError("Invalid shipment status") from error
        order.shipment.status = next_status
        if tracking_number is not None:
            order.shipment.tracking_number = tracking_number.strip() or None
        if carrier is not None:
            order.shipment.carrier = carrier.strip() or None
        if next_status == ShipmentStatus.SHIPPED:
            order.status = OrderStatus.SHIPPED
            order.status_history.append(
                OrderStatusHistory(
                    status=OrderStatus.SHIPPED,
                    note="Shipment dispatched",
                    changed_by=admin_id,
                )
            )
        elif next_status == ShipmentStatus.DELIVERED:
            order.status = OrderStatus.COMPLETED
            order.status_history.append(
                OrderStatusHistory(
                    status=OrderStatus.COMPLETED,
                    note="Shipment delivered",
                    changed_by=admin_id,
                )
            )
        db.session.commit()
        return order

    def get_order(self, order_id: int, user_id: int) -> Order:
        order = db.session.get(Order, order_id)
        if order is None or order.user_id != user_id:
            raise ResourceNotFoundError("Order not found")
        return order

    def get_order_any(self, order_id: int) -> Order:
        """Admin-only lookup: any order regardless of owner, with all relations eager-loaded."""
        order = db.session.scalar(
            select(Order)
            .where(Order.id == order_id)
            .options(
                selectinload(Order.user),
                selectinload(Order.items),
                selectinload(Order.payment),
                selectinload(Order.shipment),
                selectinload(Order.status_history),
            )
        )
        if order is None:
            raise ResourceNotFoundError("Order not found")
        return order

    def list_orders(
        self, user_id: int, page: int = 1, per_page: int = 20, status: str | None = None
    ) -> tuple[list[Order], int]:
        query = select(Order).where(Order.user_id == user_id)
        if status:
            try:
                query = query.where(Order.status == OrderStatus(status))
            except ValueError as error:
                raise ValidationError("Invalid order status") from error
        total = db.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        orders = db.session.scalars(
            query
            .order_by(Order.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
        return orders, total

    def list_all_orders(
        self,
        page: int = 1,
        per_page: int = 20,
        status: str | None = None,
        search: str | None = None,
    ) -> tuple[list[Order], int]:
        """Admin-only listing across every customer, with optional filters."""
        query = select(Order)
        if status:
            try:
                query = query.where(Order.status == OrderStatus(status))
            except ValueError as error:
                raise ValidationError("Invalid order status") from error
        if search:
            like = f"%{search.strip()}%"
            query = query.join(User, Order.user_id == User.id).where(
                or_(
                    User.email.ilike(like),
                    User.first_name.ilike(like),
                    User.last_name.ilike(like),
                )
            )
        total = db.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        orders = db.session.scalars(
            query
            .order_by(Order.created_at.desc())
            .options(
                selectinload(Order.user),
                selectinload(Order.items),
                selectinload(Order.payment),
                selectinload(Order.shipment),
                selectinload(Order.status_history),
            )
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
        return orders, total

    def cancel(self, order_id: int, user_id: int) -> Order:
        order = self.get_order(order_id, user_id)
        if order.status not in (OrderStatus.PENDING, OrderStatus.PAID):
            raise BusinessRuleError("Order cannot be cancelled in its current status")
        for item in order.items:
            item.variant.stock_quantity += item.quantity
        order.status = OrderStatus.CANCELLED
        order.status_history.append(
            OrderStatusHistory(status=OrderStatus.CANCELLED, note="Cancelled by customer")
        )
        db.session.commit()
        return order

    def update_status(self, order_id: int, status: str, admin_id: int) -> Order:
        order = db.session.get(Order, order_id)
        if order is None:
            raise ResourceNotFoundError("Order not found")
        try:
            next_status = OrderStatus(status)
        except ValueError as error:
            raise ValidationError("Invalid order status") from error
        allowed = {
            OrderStatus.PENDING: {OrderStatus.PAID, OrderStatus.CANCELLED},
            OrderStatus.PAID: {OrderStatus.PROCESSING, OrderStatus.CANCELLED},
            OrderStatus.PROCESSING: {OrderStatus.SHIPPED},
            OrderStatus.SHIPPED: {OrderStatus.COMPLETED},
            OrderStatus.COMPLETED: set(),
            OrderStatus.CANCELLED: set(),
        }
        if next_status not in allowed[order.status]:
            raise BusinessRuleError(
                f"Cannot transition order from {order.status.value} to {next_status.value}"
            )
        order.status = next_status
        order.status_history.append(
            OrderStatusHistory(status=next_status, changed_by=admin_id)
        )
        db.session.commit()
        return order
