"""API v1 router composition."""

from fastapi import APIRouter

from app.modules.api.v1.admin.router import router as admin_router
from app.modules.api.v1.auth.router import router as auth_router
from app.modules.api.v1.bookings.router import router as bookings_router
from app.modules.api.v1.messaging.router import router as messaging_router
from app.modules.api.v1.notifications.router import router as notifications_router
from app.modules.api.v1.payments.router import router as payments_router
from app.modules.api.v1.reviews.router import router as reviews_router
from app.modules.api.v1.rides.router import router as rides_router
from app.modules.api.v1.safety.router import router as safety_router
from app.modules.api.v1.users.router import router as users_router
from app.modules.api.v1.vehicles.router import router as vehicles_router


api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(rides_router)
api_router.include_router(vehicles_router)
api_router.include_router(bookings_router)
api_router.include_router(payments_router)
api_router.include_router(reviews_router)
api_router.include_router(notifications_router)
api_router.include_router(messaging_router)
api_router.include_router(safety_router)
api_router.include_router(admin_router)