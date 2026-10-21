import io
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.db import db
from app.security import create_jwt


@pytest.mark.asyncio
async def test_auth_edge_cases():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Invalid email format or short password
        res = await ac.post("/api/auth/register/", json={
            "name": "Short",
            "email": "short@test.com",
            "password": "123",  # < 6 chars
        })
        assert res.status_code == 422
        assert "message" in res.json()

        # Empty name
        res = await ac.post("/api/auth/register/", json={
            "name": "",
            "email": "empty@test.com",
            "password": "validpassword",
        })
        assert res.status_code == 422

        # Invalid token formats
        res = await ac.get("/api/workspaces/", headers={"Authorization": "Basic 12345"})
        assert res.status_code == 401
        assert res.json()["message"] == "Invalid or missing authentication token"

        res = await ac.get("/api/workspaces/", headers={"Authorization": "Bearer not-a-valid-jwt"})
        assert res.status_code == 401

        # Expired token
        expired_token = create_jwt("some-user", expire_minutes=-10)
        res = await ac.get("/api/workspaces/", headers={"Authorization": f"Bearer {expired_token}"})
        assert res.status_code == 401
        assert "expired" in res.json()["message"].lower()


@pytest.mark.asyncio
async def test_non_existent_resources_404():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Register a valid user
        await db["users"].delete_many({"email": "edge_tester@onespace.test"})
        reg = await ac.post("/api/auth/register/", json={
            "name": "Edge Tester",
            "email": "edge_tester@onespace.test",
            "password": "password123",
        })
        token = (await ac.post("/api/auth/login/", json={
            "identifier": "edge_tester@onespace.test",
            "password": "password123",
        })).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Query non-existent workspace
        fake_ws = "ws-non-existent-12345"
        res = await ac.get(f"/api/workspaces/{fake_ws}/tasks/", headers=headers)
        assert res.status_code == 404
        assert res.json()["message"] == "Workspace not found."

        res = await ac.get(f"/api/workspaces/{fake_ws}/notes/", headers=headers)
        assert res.status_code == 404

        res = await ac.get(f"/api/workspaces/{fake_ws}/resources/", headers=headers)
        assert res.status_code == 404

        res = await ac.get(f"/api/workspaces/{fake_ws}/files/", headers=headers)
        assert res.status_code == 404

        res = await ac.get(f"/api/workspaces/{fake_ws}/snippets/", headers=headers)
        assert res.status_code == 404

        res = await ac.get(f"/api/workspaces/{fake_ws}/activity/", headers=headers)
        assert res.status_code == 404

        res = await ac.get(f"/api/workspaces/{fake_ws}/search/?q=anything", headers=headers)
        assert res.status_code == 404

        # Create real workspace
        ws = (await ac.post("/api/workspaces/", json={"name": "Real WS"}, headers=headers)).json()
        real_ws_id = ws["id"]

        # 404s on child items with non-existent child IDs
        assert (await ac.patch(f"/api/workspaces/{real_ws_id}/tasks/task-fake/", json={"title": "New"}, headers=headers)).status_code == 404
        assert (await ac.delete(f"/api/workspaces/{real_ws_id}/tasks/task-fake/", headers=headers)).status_code == 404

        assert (await ac.patch(f"/api/workspaces/{real_ws_id}/notes/note-fake/", json={"title": "New"}, headers=headers)).status_code == 404
        assert (await ac.delete(f"/api/workspaces/{real_ws_id}/notes/note-fake/", headers=headers)).status_code == 404

        assert (await ac.patch(f"/api/workspaces/{real_ws_id}/resources/res-fake/", json={"title": "New"}, headers=headers)).status_code == 404
        assert (await ac.delete(f"/api/workspaces/{real_ws_id}/resources/res-fake/", headers=headers)).status_code == 404

        assert (await ac.get(f"/api/workspaces/{real_ws_id}/files/file-fake/download/", headers=headers)).status_code == 404
        assert (await ac.delete(f"/api/workspaces/{real_ws_id}/files/file-fake/", headers=headers)).status_code == 404

        assert (await ac.patch(f"/api/workspaces/{real_ws_id}/snippets/snippet-fake/", json={"title": "New"}, headers=headers)).status_code == 404
        assert (await ac.delete(f"/api/workspaces/{real_ws_id}/snippets/snippet-fake/", headers=headers)).status_code == 404

        # Cleanup
        await ac.delete(f"/api/workspaces/{real_ws_id}/", headers=headers)
        await db["users"].delete_many({"email": "edge_tester@onespace.test"})


@pytest.mark.asyncio
async def test_search_and_activity_filtering():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        await db["users"].delete_many({"email": "search_user@onespace.test"})
        await ac.post("/api/auth/register/", json={
            "name": "Search User",
            "email": "search_user@onespace.test",
            "password": "password123",
        })
        token = (await ac.post("/api/auth/login/", json={
            "identifier": "search_user@onespace.test",
            "password": "password123",
        })).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        ws = (await ac.post("/api/workspaces/", json={"name": "Search WS"}, headers=headers)).json()
        ws_id = ws["id"]

        # Search with empty query string returns empty arrays
        empty_search = (await ac.get(f"/api/workspaces/{ws_id}/search/?q=", headers=headers)).json()
        assert empty_search == {"tasks": [], "notes": [], "resources": [], "files": []}

        # Add items matching keyword "quantum"
        await ac.post(f"/api/workspaces/{ws_id}/tasks/", json={"title": "Quantum Algorithm Design"}, headers=headers)
        await ac.post(f"/api/workspaces/{ws_id}/notes/", json={"title": "Quantum Notes", "body": "Superposition principles"}, headers=headers)
        await ac.post(f"/api/workspaces/{ws_id}/resources/", json={"title": "Qiskit SDK", "url": "https://qiskit.org", "description": "quantum computing"}, headers=headers)
        await ac.post(f"/api/workspaces/{ws_id}/files/", json={"filename": "quantum_report.pdf", "size": 1024}, headers=headers)

        # Search for "quantum" (case-insensitive)
        search_res = (await ac.get(f"/api/workspaces/{ws_id}/search/?q=QuAnTuM", headers=headers)).json()
        assert len(search_res["tasks"]) == 1
        assert len(search_res["notes"]) == 1
        assert len(search_res["resources"]) == 1
        assert len(search_res["files"]) == 1

        # Search for non-matching term
        nomatch_res = (await ac.get(f"/api/workspaces/{ws_id}/search/?q=nonexistentterm123", headers=headers)).json()
        assert len(nomatch_res["tasks"]) == 0
        assert len(nomatch_res["notes"]) == 0
        assert len(nomatch_res["resources"]) == 0
        assert len(nomatch_res["files"]) == 0

        # Activity list limit and sorting
        activity_res = (await ac.get(f"/api/workspaces/{ws_id}/activity/?limit=2", headers=headers)).json()
        assert len(activity_res) == 2

        # Cleanup
        await ac.delete(f"/api/workspaces/{ws_id}/", headers=headers)
        await db["users"].delete_many({"email": "search_user@onespace.test"})
