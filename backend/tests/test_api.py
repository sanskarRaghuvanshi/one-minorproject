import io
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.db import db, client


@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/health/")
    assert response.status_code == 200
    data = response.json()
    assert data["healthy"] is True


@pytest.mark.asyncio
async def test_auth_and_workspaces_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Register a new user
        reg_payload = {
            "name": "Integration Tester",
            "email": "test_user_unique@onespace.test",
            "password": "secretpassword123",
        }
        # Clean up if exists from previous run
        await db["users"].delete_many({"email": reg_payload["email"].lower()})

        reg_res = await ac.post("/api/auth/register/", json=reg_payload)
        assert reg_res.status_code == 200, reg_res.text
        reg_data = reg_res.json()
        assert reg_data["email"] == reg_payload["email"].lower()
        user_id = reg_data["id"]

        # Duplicate registration should fail
        dup_res = await ac.post("/api/auth/register/", json=reg_payload)
        assert dup_res.status_code == 400

        # 2. Login
        login_res = await ac.post("/api/auth/login/", json={
            "identifier": reg_payload["email"],
            "password": reg_payload["password"],
        })
        assert login_res.status_code == 200, login_res.text
        login_data = login_res.json()
        token = login_data["token"]
        assert token
        headers = {"Authorization": f"Bearer {token}"}

        # Login with username also works
        login_by_name = await ac.post("/api/auth/login/", json={
            "identifier": "Integration Tester",
            "password": "secretpassword123",
        })
        assert login_by_name.status_code == 200

        # Login with invalid password fails
        bad_login = await ac.post("/api/auth/login/", json={
            "identifier": "Integration Tester",
            "password": "wrongpassword",
        })
        assert bad_login.status_code == 401

        # 3. Unauthorized access check
        unauth_res = await ac.get("/api/workspaces/")
        assert unauth_res.status_code == 401

        # 4. Create Workspace
        ws_res = await ac.post("/api/workspaces/", json={
            "name": "Test Engineering Workspace",
            "description": "Workspace for automated tests",
        }, headers=headers)
        assert ws_res.status_code == 200, ws_res.text
        ws = ws_res.json()
        ws_id = ws["id"]
        assert ws["name"] == "Test Engineering Workspace"
        assert ws["archived"] is False

        # 5. List Workspaces
        list_ws = await ac.get("/api/workspaces/", headers=headers)
        assert list_ws.status_code == 200
        ws_items = list_ws.json()
        assert any(w["id"] == ws_id for w in ws_items)

        # 6. Update Workspace
        patch_ws = await ac.patch(f"/api/workspaces/{ws_id}/", json={
            "name": "Test Engineering Workspace Renamed",
        }, headers=headers)
        assert patch_ws.status_code == 200
        assert patch_ws.json()["name"] == "Test Engineering Workspace Renamed"

        # 7. Tasks
        task_res = await ac.post(f"/api/workspaces/{ws_id}/tasks/", json={
            "title": "Build Architecture Plan",
            "description": "Document specifications",
            "status": "To Do",
            "priority": "High",
            "due_date": "2026-11-01",
        }, headers=headers)
        assert task_res.status_code == 200, task_res.text
        task = task_res.json()
        task_id = task["id"]
        assert task["title"] == "Build Architecture Plan"

        # Update task status to Done
        task_update = await ac.patch(f"/api/workspaces/{ws_id}/tasks/{task_id}/", json={
            "status": "Done",
        }, headers=headers)
        assert task_update.status_code == 200
        assert task_update.json()["status"] == "Done"

        # List tasks
        list_tasks = await ac.get(f"/api/workspaces/{ws_id}/tasks/", headers=headers)
        assert list_tasks.status_code == 200
        assert len(list_tasks.json()) >= 1

        # 8. Notes
        note_res = await ac.post(f"/api/workspaces/{ws_id}/notes/", json={
            "title": "Meeting Notes",
            "body": "Discussed roadmap and test suite.",
        }, headers=headers)
        assert note_res.status_code == 200, note_res.text
        note = note_res.json()
        note_id = note["id"]

        list_notes = await ac.get(f"/api/workspaces/{ws_id}/notes/", headers=headers)
        assert list_notes.status_code == 200
        assert any(n["id"] == note_id for n in list_notes.json())

        # 9. Resources
        res_res = await ac.post(f"/api/workspaces/{ws_id}/resources/", json={
            "title": "FastAPI Docs",
            "url": "https://fastapi.tiangolo.com",
            "description": "Official documentation",
        }, headers=headers)
        assert res_res.status_code == 200, res_res.text
        res_item = res_res.json()
        res_id = res_item["id"]

        list_resources = await ac.get(f"/api/workspaces/{ws_id}/resources/", headers=headers)
        assert list_resources.status_code == 200
        assert any(r["id"] == res_id for r in list_resources.json())

        # 10. Files (Multipart upload & download)
        file_bytes = b"Hello OneSpace File System!"
        files_payload = {
            "file": ("test_doc.txt", io.BytesIO(file_bytes), "text/plain")
        }
        file_upload_res = await ac.post(
            f"/api/workspaces/{ws_id}/files/",
            files=files_payload,
            headers=headers,
        )
        assert file_upload_res.status_code == 200, file_upload_res.text
        file_item = file_upload_res.json()
        file_id = file_item["id"]
        assert file_item["filename"] == "test_doc.txt"
        assert file_item["size"] == len(file_bytes)

        # Download file
        download_res = await ac.get(
            f"/api/workspaces/{ws_id}/files/{file_id}/download/",
            headers=headers,
        )
        assert download_res.status_code == 200
        assert download_res.content == file_bytes

        # 11. Snippets (Saved Programs)
        snippet_res = await ac.post(f"/api/workspaces/{ws_id}/snippets/", json={
            "title": "Quick Sort",
            "language": "python",
            "code": "def quicksort(arr): return arr",
        }, headers=headers)
        assert snippet_res.status_code == 200, snippet_res.text
        snippet = snippet_res.json()
        snippet_id = snippet["id"]

        list_snippets = await ac.get(f"/api/workspaces/{ws_id}/snippets/", headers=headers)
        assert list_snippets.status_code == 200
        assert any(s["id"] == snippet_id for s in list_snippets.json())

        # 12. Search
        search_res = await ac.get(
            f"/api/workspaces/{ws_id}/search/?q=architecture",
            headers=headers,
        )
        assert search_res.status_code == 200, search_res.text
        search_data = search_res.json()
        assert len(search_data["tasks"]) >= 1
        assert search_data["tasks"][0]["title"] == "Build Architecture Plan"

        # 13. Activity log
        activity_res = await ac.get(
            f"/api/workspaces/{ws_id}/activity/",
            headers=headers,
        )
        assert activity_res.status_code == 200, activity_res.text
        activities = activity_res.json()
        assert len(activities) >= 4  # task_created, task_completed, note_created, resource_added, file_uploaded, etc.

        # 14. Workspace Archive
        archive_res = await ac.post(f"/api/workspaces/{ws_id}/archive/", headers=headers)
        assert archive_res.status_code == 200
        assert archive_res.json()["archived"] is True

        # 15. Workspace Isolation / Security Test
        # Create a second user and ensure User B cannot access User A's workspace
        user_b_reg = await ac.post("/api/auth/register/", json={
            "name": "User B",
            "email": "user_b_test@onespace.test",
            "password": "password12345",
        })
        user_b_token = (await ac.post("/api/auth/login/", json={
            "identifier": "user_b_test@onespace.test",
            "password": "password12345",
        })).json()["token"]
        user_b_headers = {"Authorization": f"Bearer {user_b_token}"}

        # User B should NOT be able to access User A's workspace
        forbidden_res = await ac.get(f"/api/workspaces/{ws_id}/tasks/", headers=user_b_headers)
        assert forbidden_res.status_code == 403

        # 16. Delete Workspace (Cascade delete check)
        del_res = await ac.delete(f"/api/workspaces/{ws_id}/", headers=headers)
        assert del_res.status_code == 200

        # Ensure cascade deleted all child items
        assert await db["tasks"].count_documents({"workspace_id": ws_id}) == 0
        assert await db["notes"].count_documents({"workspace_id": ws_id}) == 0
        assert await db["resources"].count_documents({"workspace_id": ws_id}) == 0
        assert await db["files"].count_documents({"workspace_id": ws_id}) == 0
        assert await db["snippets"].count_documents({"workspace_id": ws_id}) == 0
        assert await db["activity"].count_documents({"workspace_id": ws_id}) == 0

        # Cleanup users
        await db["users"].delete_many({"email": {"$in": ["test_user_unique@onespace.test", "user_b_test@onespace.test"]}})
