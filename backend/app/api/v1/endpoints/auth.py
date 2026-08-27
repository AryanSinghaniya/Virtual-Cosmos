from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshTokenRequest, RegisterRequest, Token
from app.schemas.common import ResponseEnvelope
from app.schemas.user import ProfileResponse, ProfileUpdate, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication & Profiles"])


@router.post("/register", response_model=ResponseEnvelope[dict], status_code=status.HTTP_201_CREATED)
async def register(
    register_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user, automatically provision profile, and generate JWT tokens."""
    user, tokens = await AuthService.register_user(db, register_data)
    return ResponseEnvelope(
        success=True,
        data={
            "user": UserResponse.model_validate(user).model_dump(),
            "tokens": tokens.model_dump()
        },
        message="User registered successfully."
    )


@router.post("/login", response_model=ResponseEnvelope[dict])
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate with email and password to receive JWT access and refresh tokens.
    Protected by token bucket rate limiter to mitigate brute-force attempts.
    """
    user, tokens = await AuthService.authenticate_user(db, login_data)
    return ResponseEnvelope(
        success=True,
        data={
            "user": UserResponse.model_validate(user).model_dump(),
            "tokens": tokens.model_dump()
        },
        message="Authenticated successfully."
    )


@router.post("/refresh", response_model=ResponseEnvelope[Token])
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """Obtain a new access token using a valid refresh token."""
    tokens = await AuthService.refresh_access_token(db, refresh_data.refresh_token)
    return ResponseEnvelope(
        success=True,
        data=tokens,
        message="Token refreshed successfully."
    )


@router.get("/me", response_model=ResponseEnvelope[UserResponse])
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """Fetch currently authenticated user details and profile."""
    return ResponseEnvelope(
        success=True,
        data=UserResponse.model_validate(current_user),
        message="Profile retrieved."
    )


@router.put("/profile", response_model=ResponseEnvelope[ProfileResponse])
async def update_profile(
    profile_update: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user display name, avatar, bio, and technical skills."""
    profile = current_user.profile
    if not profile:
        from app.models.profile import Profile
        import uuid
        profile = Profile(user_id=current_user.id, display_name=current_user.username)
        db.add(profile)

    update_dict = profile_update.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    return ResponseEnvelope(
        success=True,
        data=ProfileResponse.model_validate(profile),
        message="Profile updated successfully."
    )
