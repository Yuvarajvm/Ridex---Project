"""Mock payment provider implementing realistic gateway simulation for RIDEX."""

from decimal import Decimal
from uuid import uuid4

from app.modules.api.v1.payments.providers.base import PaymentProvider


class MockPaymentProvider(PaymentProvider):
    """
    Simulates UPI/Card/NetBanking payment orders, authorization, and capture
    without requiring third-party credentials.
    """

    async def create_order(
        self,
        amount: Decimal,
        currency: str,
        reference_id: str,
    ) -> dict:
        clean_ref = reference_id.replace("-", "")
        order_id = f"order_mock_{clean_ref[:12]}"
        client_secret = f"sec_mock_{clean_ref[:16]}"
        return {
            "order_id": order_id,
            "amount": amount,
            "currency": currency,
            "client_secret": client_secret,
        }

    async def verify_and_capture(
        self,
        payment_id: str,
        order_id: str,
        simulate_failure: bool = False,
        **kwargs,
    ) -> dict:
        if simulate_failure:
            return {
                "success": False,
                "error": "Payment simulation: Insufficient funds or card declined.",
            }

        return {
            "success": True,
            "provider_payment_id": f"pay_mock_{uuid4().hex[:14]}",
            "status": "succeeded",
        }
