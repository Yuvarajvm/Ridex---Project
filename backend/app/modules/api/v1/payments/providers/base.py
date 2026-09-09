"""Abstract base class for payment gateway providers."""

from abc import ABC, abstractmethod
from decimal import Decimal


class PaymentProvider(ABC):
    """Interface required for all RIDEX payment integrations."""

    @abstractmethod
    async def create_order(
        self,
        amount: Decimal,
        currency: str,
        reference_id: str,
    ) -> dict:
        """Create an order with the external payment gateway."""
        pass

    @abstractmethod
    async def verify_and_capture(
        self,
        payment_id: str,
        order_id: str,
        simulate_failure: bool = False,
        **kwargs,
    ) -> dict:
        """Verify transaction authorization and settle the funds."""
        pass
