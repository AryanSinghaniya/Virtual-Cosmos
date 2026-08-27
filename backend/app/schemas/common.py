from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Page number starting at 1")
    limit: int = Field(default=20, ge=1, le=100, description="Items per page (max 100)")


class CursorPaginationParams(BaseModel):
    cursor: Optional[str] = Field(default=None, description="Cursor for pagination (e.g., ISO timestamp or item ID)")
    limit: int = Field(default=30, ge=1, le=100, description="Items to fetch")


class PaginationMeta(BaseModel):
    total_items: int
    total_pages: int
    current_page: int
    limit: int
    has_next: bool
    has_prev: bool


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    meta: PaginationMeta


class ResponseEnvelope(BaseModel, Generic[T]):
    success: bool = True
    data: T
    message: Optional[str] = None
