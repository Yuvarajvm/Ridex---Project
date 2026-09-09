"""RIDEX SQLAlchemy model registry.

All ORM models are imported here so SQLAlchemy can configure their
relationships before application queries are executed.
"""

from app.modules.api.v1.bookings.models import Booking
from app.modules.api.v1.messaging.models import TripMessage
from app.modules.api.v1.notifications.models import Notification
from app.modules.api.v1.payments.models import Payment
from app.modules.api.v1.reviews.models import Review
from app.modules.api.v1.rides.models import Ride
from app.modules.api.v1.safety.models import IncidentReport
from app.modules.api.v1.users.models import Profile, User
from app.modules.api.v1.vehicles.models import Vehicle

__all__ = [
    "Booking",
    "IncidentReport",
    "Notification",
    "Payment",
    "Profile",
    "Review",
    "Ride",
    "TripMessage",
    "User",
    "Vehicle",
]