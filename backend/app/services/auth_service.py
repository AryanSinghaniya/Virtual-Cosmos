import uuid
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.exceptions import ConflictException, ResourceNotFoundException, UnauthorizedException
from app.core.security import create_access_token, create_refresh_token, decode_token, get_password_hash, verify_password
from app.models.profile import Profile
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, Token


class AuthService:
    @staticmethod
    async def register_user(db: AsyncSession, register_data: RegisterRequest) -> Tuple[User, Token]:
        """Register a new user, create their profile, and issue JWT tokens."""
        # Check existing user
        query = select(User).where((User.email == register_data.email) | (User.username == register_data.username))
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        if existing:
            if existing.email == register_data.email:
                raise ConflictException("A user with this email address already exists.")
            raise ConflictException("This username is already taken.")

        # Create user
        user = User(
            id=str(uuid.uuid4()),
            email=register_data.email,
            username=register_data.username,
            hashed_password=get_password_hash(register_data.password),
            is_active=True
        )
        db.add(user)
        await db.flush()

        # Create profile
        display_name = register_data.display_name or register_data.username
        profile = Profile(
            id=str(uuid.uuid4()),
            user_id=user.id,
            display_name=display_name,
            avatar_emoji=register_data.avatar_emoji or "🚀",
            bio=register_data.bio or f"Explorer in Virtual Cosmos. Interested in {', '.join(register_data.interests or ['Tech'])}.",
            interests=register_data.interests or ["Python", "FastAPI", "React", "AI"],
            skills=register_data.skills or ["Fullstack", "PostgreSQL", "WebSockets"]
        )
        db.add(profile)
        await db.commit()
        await db.refresh(user)

        tokens = AuthService.create_user_tokens(user)
        return user, tokens

    @staticmethod
    async def authenticate_user(db: AsyncSession, login_data: LoginRequest) -> Tuple[User, Token]:
        """Authenticate user by email and password, returning user and JWT tokens."""
        query = select(User).options(selectinload(User.profile)).where(User.email == login_data.email)
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user or not verify_password(login_data.password, user.hashed_password):
            raise UnauthorizedException("Invalid email or password.")

        if not user.is_active:
            raise UnauthorizedException("This account is currently deactivated.")

        tokens = AuthService.create_user_tokens(user)
        return user, tokens

    @staticmethod
    async def refresh_access_token(db: AsyncSession, refresh_token: str) -> Token:
        """Validate refresh token and issue new access & refresh tokens."""
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise UnauthorizedException("Invalid or expired refresh token.")

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedException("Invalid token payload.")

        query = select(User).options(selectinload(User.profile)).where(User.id == user_id)
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise UnauthorizedException("User not found or inactive.")

        return AuthService.create_user_tokens(user)

    @staticmethod
    def create_user_tokens(user: User) -> Token:
        """Create access and refresh tokens for user."""
        access_token = create_access_token(
            subject=user.id,
            additional_claims={
                "username": user.username,
                "email": user.email,
                "display_name": user.profile.display_name if user.profile else user.username,
                "avatar_emoji": user.profile.avatar_emoji if user.profile else "🚀"
            }
        )
        refresh_token = create_refresh_token(subject=user.id)
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=60 * 24 * 60  # seconds
        )
