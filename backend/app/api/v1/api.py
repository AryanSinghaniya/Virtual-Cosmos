from fastapi import APIRouter
from app.api.v1.endpoints import ai_matchmaker, auth, chat, spaces, spatial, websockets

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(spaces.router)
api_router.include_router(spatial.router)
api_router.include_router(ai_matchmaker.router)
api_router.include_router(chat.router)
api_router.include_router(websockets.router)
