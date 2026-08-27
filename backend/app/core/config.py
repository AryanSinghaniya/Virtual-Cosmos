import os
from typing import List, Union
from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Virtual Cosmos API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Security & JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production-virtual-cosmos-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7         # 7 days
    
    # Database: Default to sqlite for seamless local development, override with postgresql in docker/production
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./virtual_cosmos.db")
    DATABASE_URL_FALLBACK: str = "sqlite+aiosqlite:///./virtual_cosmos.db"
    
    # Extensions & AI Vector Settings
    ENABLE_POSTGIS: bool = True
    ENABLE_PGVECTOR: bool = True
    EMBEDDING_DIMENSION: int = 384
    
    # Spatial & Cosmos Defaults
    DEFAULT_PROXIMITY_RADIUS: float = 160.0
    DEFAULT_WORLD_WIDTH: int = 3200
    DEFAULT_WORLD_HEIGHT: int = 2400
    MAX_SPACE_CAPACITY: int = 150
    
    # Rate Limiting (SlowAPI)
    RATE_LIMIT_AUTH: str = "20/minute"
    RATE_LIMIT_STANDARD: str = "120/minute"
    RATE_LIMIT_CHAT: str = "60/minute"
    RATE_LIMIT_AI_MATCH: str = "30/minute"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://virtual-cosmos.vercel.app",
        "*"
    ]
    
    REDIS_URL: str = "redis://localhost:6379/0"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )


settings = Settings()
