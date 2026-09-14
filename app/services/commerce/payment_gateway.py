from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol
from uuid import uuid4


@dataclass(frozen=True)
class PaymentIntent:
    provider: str
    reference: str | None = None


class PaymentGateway(Protocol):
    def create_intent(self, amount: Decimal, method: str) -> PaymentIntent:
        ...


class ManualPaymentGateway:
    """Deterministic gateway used until a real provider is configured."""

    def create_intent(self, amount: Decimal, method: str) -> PaymentIntent:
        return PaymentIntent(provider="manual", reference=f"manual-{uuid4()}")
