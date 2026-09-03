"""RIDEX SQLAlchemy model registry.

All ORM models are imported here so SQLAlchemy can configure their
relationships before application queries are executed.
"""

from app.modules.api.v1.users.models import Profile, User
from app.modules.api.v1.vehicles.models import Vehicle
from app.modules.api.v1.rides.models import Ride

__all__ = [
    "Profile",
    "Ride",
    "User",
    "Vehicle",
]