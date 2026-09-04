"""API v1 router composition."""

from fastapi import APIRouter

from app.modules.api.v1.rides.router import router as rides_router
from app.modules.api.v1.vehicles.router import router as vehicles_router


api_router = APIRouter()

api_router.include_router(rides_router)
api_router.include_router(vehicles_router)