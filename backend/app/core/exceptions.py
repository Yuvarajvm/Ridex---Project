"""Consistent application errors and FastAPI exception handlers."""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "application_error"
    message = "The request could not be completed."

    def __init__(self, message: str | None = None, *, details: Any = None) -> None:
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    message = "The requested resource was not found."


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"
    message = "The request conflicts with the current resource state."


class AuthenticationError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "authentication_failed"
    message = "Authentication credentials are invalid or missing."


class AuthorizationError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"
    message = "You do not have permission to perform this action."


def error_response(error: AppError) -> JSONResponse:
    body: dict[str, Any] = {"error": {"code": error.code, "message": error.message}}
    if error.details is not None:
        body["error"]["details"] = error.details
    return JSONResponse(status_code=error.status_code, content=body)


async def app_error_handler(_: Request, error: AppError) -> JSONResponse:
    return error_response(error)


async def validation_error_handler(_: Request, error: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "validation_error", "message": "Request validation failed.", "details": error.errors()}},
    )


async def http_error_handler(_: Request, error: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"error": {"code": "http_error", "message": str(error.detail)}},
    )


async def unhandled_error_handler(request: Request, _: Exception) -> JSONResponse:
    logger.exception("Unhandled server error", extra={"path": request.url.path})
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"code": "internal_server_error", "message": "An unexpected error occurred."}},
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register every API-wide exception handler in one place."""
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
