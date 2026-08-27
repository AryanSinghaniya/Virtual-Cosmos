from typing import AsyncGenerator, Optional
from fastapi import Depends, Header, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.exceptions import UnauthorizedException
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User

security = HTTPBearer(auto_error=False)


async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Validate Bearer JWT token from Authorization header and return current User."""
    if not auth or not auth.credentials:
        raise UnauthorizedException("Authentication token is missing.")

    payload = decode_token(auth.credentials)
    if not payload or payload.get("type") != "access":
        raise UnauthorizedException("Invalid or expired access token.")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Token payload missing subject.")

    query = select(User).options(selectinload(User.profile)).where(User.id == user_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedException("User not found.")

    if not user.is_active:
        raise UnauthorizedException("User account is inactive.")

    return user


async def get_optional_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Optionally returns User if valid Bearer token is present, otherwise None."""
    if not auth or not auth.credentials:
        return None

    try:
        payload = decode_token(auth.credentials)
        if not payload or payload.get("type") != "access":
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        query = select(User).options(selectinload(User.profile)).where(User.id == user_id)
        result = await db.execute(query)
        return result.scalar_one_or_none()
    except Exception:
        return None
