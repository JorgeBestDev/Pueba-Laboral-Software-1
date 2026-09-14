from decimal import Decimal

from sqlalchemy import select

from app import db
from app.models import (
    Order,
    OrderStatus,
    OrderStatusHistory,
    Payment,
    PaymentMethod,
    PaymentStatus,
)
from app.services.commerce.payment_gateway import ManualPaymentGateway, PaymentGateway
from app.services.exceptions import BusinessRuleError, ResourceNotFoundError, ValidationError


class PaymentService:
    def __init__(self, gateway: PaymentGateway | None = None):
        self.gateway = gateway or ManualPaymentGateway()

    def create_pending_payment(
        self, order: Order, amount: Decimal, method: str
    ) -> Payment:
        try:
            payment_method = PaymentMethod(method)
        except (TypeError, ValueError) as error:
            raise ValidationError("Invalid payment_method") from error
        intent = self.gateway.create_intent(amount, payment_method.value)
        payment = Payment(
            order=order,
            amount=amount,
            method=payment_method,
            provider=intent.provider,
            provider_reference=intent.reference,
            status=PaymentStatus.PENDING,
        )
        db.session.add(payment)
        return payment

    def update_status(self, order_id: int, status: str, admin_id: int) -> Order:
        order = db.session.get(Order, order_id)
        if order is None or order.payment is None:
            raise ResourceNotFoundError("Order payment not found")
        try:
            next_status = PaymentStatus(status)
        except (TypeError, ValueError) as error:
            raise ValidationError("Invalid payment status") from error
        allowed = {
            PaymentStatus.PENDING: {
                PaymentStatus.AUTHORIZED,
                PaymentStatus.PAID,
                PaymentStatus.FAILED,
            },
            PaymentStatus.AUTHORIZED: {PaymentStatus.PAID, PaymentStatus.FAILED},
            PaymentStatus.PAID: {PaymentStatus.REFUNDED},
            PaymentStatus.FAILED: set(),
            PaymentStatus.REFUNDED: set(),
        }
        current_status = order.payment.status
        if next_status not in allowed[current_status]:
            raise BusinessRuleError(
                f"Cannot transition payment from {current_status.value} to {next_status.value}"
            )
        order.payment.status = next_status
        if next_status in (PaymentStatus.AUTHORIZED, PaymentStatus.PAID):
            if order.status != OrderStatus.PENDING:
                raise BusinessRuleError("Payment cannot be confirmed for this order")
            order.status = OrderStatus.PAID
            order.status_history.append(
                OrderStatusHistory(
                    status=OrderStatus.PAID,
                    note="Payment confirmed",
                    changed_by=admin_id,
                )
            )
        elif next_status == PaymentStatus.REFUNDED:
            order.status_history.append(
                OrderStatusHistory(
                    status=order.status,
                    note="Payment refunded",
                    changed_by=admin_id,
                )
            )
        db.session.commit()
        return order

    def get_for_order(self, order_id: int, user_id: int) -> Payment:
        payment = db.session.scalar(
            select(Payment)
            .join(Order)
            .where(Payment.order_id == order_id, Order.user_id == user_id)
        )
        if payment is None:
            raise ResourceNotFoundError("Payment not found")
        return payment
