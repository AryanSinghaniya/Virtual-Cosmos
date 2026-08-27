import pytest
from httpx import ASGITransport, AsyncClient
from app.main import fastapi_app


@pytest.mark.asyncio
async def test_root_and_health():
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as ac:
        res = await ac.get("/")
        assert res.status_code == 200
        assert res.json()["status"] == "online"

        res_health = await ac.get("/health")
        assert res_health.status_code == 200
        assert res_health.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_auth_registration_and_login():
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as ac:
        # Register new user
        reg_payload = {
            "email": "test_engineer_2@cosmos.io",
            "username": "test_engineer_2",
            "password": "SecurePassword123!",
            "display_name": "Test Engineer 2",
            "avatar_emoji": "🚀",
            "bio": "Building FastAPI and React spatial apps",
            "interests": ["Python", "FastAPI", "React", "PostGIS"],
            "skills": ["Python", "PostgreSQL", "Docker"]
        }
        reg_res = await ac.post("/api/v1/auth/register", json=reg_payload)
        assert reg_res.status_code == 201
        data = reg_res.json()["data"]
        assert "tokens" in data
        assert data["user"]["email"] == "test_engineer_2@cosmos.io"
        access_token = data["tokens"]["access_token"]

        # Access /me with token
        headers = {"Authorization": f"Bearer {access_token}"}
        me_res = await ac.get("/api/v1/auth/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["data"]["username"] == "test_engineer_2"

        # Login
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "test_engineer_2@cosmos.io",
            "password": "SecurePassword123!"
        })
        assert login_res.status_code == 200
        assert "tokens" in login_res.json()["data"]
