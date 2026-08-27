import pytest
from httpx import ASGITransport, AsyncClient
from app.main import fastapi_app


@pytest.mark.asyncio
async def test_chat_endpoints():
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as ac:
        # Login
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "aryan@cosmos.io",
            "password": "Password123!"
        })
        assert login_res.status_code == 200
        token = login_res.json()["data"]["tokens"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Send message
        msg_payload = {
            "space_id": "default-alpha-cosmos",
            "room_key": "space:default-alpha-cosmos:general",
            "content": "Hello from pytest spatial chat!",
            "message_type": "text"
        }
        send_res = await ac.post("/api/v1/chat", headers=headers, json=msg_payload)
        assert send_res.status_code == 201
        assert send_res.json()["data"]["content"] == msg_payload["content"]

        # Fetch history
        hist_res = await ac.get(
            "/api/v1/chat/history",
            params={"room_key": "space:default-alpha-cosmos:general", "limit": 10}
        )
        assert hist_res.status_code == 200
        hist_data = hist_res.json()
        assert "items" in hist_data
        assert len(hist_data["items"]) >= 1
