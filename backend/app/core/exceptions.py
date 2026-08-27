from typing import Any, Dict, Optional
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError


class APIException(HTTPException):
    """Base API Exception for domain errors."""
    def __init__(
        self,
        status_code: int,
        message: str,
        error_code: str = "GENERIC_ERROR",
        details: Optional[Any] = None
    ):
        super().__init__(status_code=status_code, detail=message)
        self.message = message
        self.error_code = error_code
        self.details = details


class ResourceNotFoundException(APIException):
    def __init__(self, resource: str, identifier: Any):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            message=f"{resource} with identifier '{identifier}' was not found.",
            error_code="RESOURCE_NOT_FOUND"
        )


class UnauthorizedException(APIException):
    def __init__(self, message: str = "Invalid credentials or expired session."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message=message,
            error_code="UNAUTHORIZED"
        )


class ForbiddenException(APIException):
    def __init__(self, message: str = "You do not have permission to perform this action."):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            message=message,
            error_code="FORBIDDEN"
        )


class ConflictException(APIException):
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            message=message,
            error_code="RESOURCE_CONFLICT"
        )


async def api_exception_handler(request: Request, exc: APIException) -> JSONResponse:
    """Standardized error envelope for domain API exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
                "path": str(request.url.path)
            }
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Standardized error envelope for Pydantic validation errors."""
    errors = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err.get("loc", []))
        errors.append({
            "field": field,
            "message": err.get("msg", "Invalid input"),
            "type": err.get("type", "value_error")
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Input validation failed for the request payload.",
                "details": errors,
                "path": str(request.url.path)
            }
        }
    )
