from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import socketio
from slowapi.errors import RateLimitExceeded

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.exceptions import APIException, api_exception_handler, validation_exception_handler
from app.core.rate_limiter import limiter
from app.db.init_db import init_db
from app.services.socketio_manager import sio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("virtual_cosmos")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}...")
    await init_db()
    logger.info("Database initialized and ready.")
    yield
    logger.info("Shutting down Virtual Cosmos...")


fastapi_app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="""
## Virtual Cosmos: Real-Time Spatial Engine & Production REST API

A high-performance asynchronous spatial platform combining:
* **Python (FastAPI)**: Asynchronous REST endpoints & Socket.IO multiplayer
* **PostgreSQL (PostGIS & pgvector)**: Spatial proximity calculations and AI vector semantic profile matchmaking
* **JWT Authentication**: Secure Bearer tokens with refresh token rotation
* **Rate Limiting**: Integrated SlowAPI rate limiting
* **Real-Time Multiplayer & WebRTC**: 60fps movement synchronization & peer-to-peer AV mesh calling
    """,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# SlowAPI Rate Limiter integration
fastapi_app.state.limiter = limiter


# Rate Limit Handler
@fastapi_app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": f"Rate limit exceeded: {exc.detail}",
                "path": str(request.url.path)
            }
        }
    )


# Exception Handlers
fastapi_app.add_exception_handler(APIException, api_exception_handler)
fastapi_app.add_exception_handler(RequestValidationError, validation_exception_handler)

# CORS Middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
fastapi_app.include_router(api_router, prefix=settings.API_V1_STR)


@fastapi_app.get("/", tags=["Health & Status"])
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "status": "online",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR
    }


@fastapi_app.get("/health", tags=["Health & Status"])
async def health():
    return {
        "status": "healthy",
        "database": "connected",
        "realtime_engine": "active"
    }


# Mount Socket.IO directly onto the ASGI application
app = socketio.ASGIApp(
    sio,
    other_asgi_app=fastapi_app,
    socketio_path="socket.io"
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
