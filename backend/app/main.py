"""RIDEX FastAPI application composition root."""

import logging
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.database import check_database_connection, close_database_connection
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, request_id_context
from app.modules.api.v1.router import api_router
from app.shared import models as _models

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_logging(debug=settings.debug)
    logger.info("Application starting", extra={"environment": settings.environment})
    yield
    await close_database_connection()
    logger.info("Application stopped")


app = FastAPI(title=settings.app_name, version=settings.app_version, debug=settings.debug, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
register_exception_handlers(app)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    token = request_id_context.set(request_id)
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "Request completed",
            extra={"method": request.method, "path": request.url.path, "status_code": response.status_code, "duration_ms": round((time.perf_counter() - started_at) * 1000, 2)},
        )
        return response
    finally:
        request_id_context.reset(token)


@app.get("/health", tags=["system"], include_in_schema=False)
async def health_check() -> JSONResponse:
    database_connected = await check_database_connection()
    return JSONResponse(
        status_code=200 if database_connected else 503,
        content={"status": "ok" if database_connected else "unavailable", "database": database_connected},
    )


app.include_router(api_router, prefix=settings.api_v1_prefix)
