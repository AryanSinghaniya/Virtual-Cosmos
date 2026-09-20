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
    import uuid
    rand_suffix = uuid.uuid4().hex[:6]
    test_email = f"test_engineer_{rand_suffix}@cosmos.io"
    test_username = f"test_engineer_{rand_suffix}"

    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as ac:
        # Register new user
        reg_payload = {
            "email": test_email,
            "username": test_username,
            "password": "SecurePassword123!",
            "display_name": f"Test Engineer {rand_suffix}",
            "avatar_emoji": "🚀",
            "bio": "Building FastAPI and React spatial apps",
            "interests": ["Python", "FastAPI", "React", "PostGIS"],
            "skills": ["Python", "PostgreSQL", "Docker"]
        }
        reg_res = await ac.post("/api/v1/auth/register", json=reg_payload)
        assert reg_res.status_code == 201
        data = reg_res.json()["data"]
        assert "tokens" in data
        assert data["user"]["email"] == test_email
        access_token = data["tokens"]["access_token"]

        # Access /me with token
        headers = {"Authorization": f"Bearer {access_token}"}
        me_res = await ac.get("/api/v1/auth/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["data"]["username"] == test_username

        # Login
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": test_email,
            "password": "SecurePassword123!"
        })
        assert login_res.status_code == 200
        assert "tokens" in login_res.json()["data"]
