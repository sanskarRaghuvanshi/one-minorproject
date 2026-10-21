import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.db import db
from app.security import get_current_user
from app.schemas import SnippetCreate, SnippetUpdate, SnippetResponse
from app.services.workspace_service import (
    get_workspace_for_user,
    log_activity,
    now_iso,
    to_iso,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/snippets", tags=["snippets"])


@router.get("/", response_model=List[SnippetResponse])
async def list_snippets(
    workspace_id: str,
    current_user: str = Depends(get_current_user),
):
    """List all saved snippets/programs in a workspace."""
    await get_workspace_for_user(workspace_id, current_user)
    snippets = await db["snippets"].find({"workspace_id": workspace_id}).to_list(1000)
    return [
        SnippetResponse(
            id=s["id"],
            workspace_id=s["workspace_id"],
            title=s.get("title", "Untitled program"),
            language=s.get("language", "python"),
            code=s.get("code", ""),
            created_at=to_iso(s.get("created_at")),
            updated_at=to_iso(s.get("updated_at")),
        )
        for s in snippets
    ]


@router.post("/", response_model=SnippetResponse)
async def create_snippet(
    workspace_id: str,
    data: SnippetCreate,
    current_user: str = Depends(get_current_user),
):
    """Create a new snippet in a workspace."""
    await get_workspace_for_user(workspace_id, current_user)
    now = now_iso()
    snippet = {
        "id": f"snippet-{uuid.uuid4().hex[:12]}",
        "workspace_id": workspace_id,
        "title": (data.title or "").strip() or "Untitled program",
        "language": data.language or "python",
        "code": data.code if data.code is not None else "",
        "created_at": now,
        "updated_at": now,
    }
    await db["snippets"].insert_one(snippet)
    await log_activity(workspace_id, "snippet_created", f'Saved program "{snippet["title"]}"')

    return SnippetResponse(
        id=snippet["id"],
        workspace_id=snippet["workspace_id"],
        title=snippet["title"],
        language=snippet["language"],
        code=snippet["code"],
        created_at=snippet["created_at"],
        updated_at=snippet["updated_at"],
    )


@router.patch("/{snippet_id}/", response_model=SnippetResponse)
async def update_snippet(
    workspace_id: str,
    snippet_id: str,
    data: SnippetUpdate,
    current_user: str = Depends(get_current_user),
):
    """Update a snippet."""
    await get_workspace_for_user(workspace_id, current_user)
    existing = await db["snippets"].find_one({"id": snippet_id, "workspace_id": workspace_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Program not found.",
        )

    updates = {"updated_at": now_iso()}
    if data.title is not None:
        updates["title"] = data.title.strip() or "Untitled program"
    if data.language is not None:
        updates["language"] = data.language
    if data.code is not None:
        updates["code"] = data.code

    await db["snippets"].update_one({"id": snippet_id, "workspace_id": workspace_id}, {"$set": updates})
    updated = await db["snippets"].find_one({"id": snippet_id, "workspace_id": workspace_id})
    await log_activity(workspace_id, "snippet_updated", f'Updated program "{updated["title"]}"')

    return SnippetResponse(
        id=updated["id"],
        workspace_id=updated["workspace_id"],
        title=updated.get("title", "Untitled program"),
        language=updated.get("language", "python"),
        code=updated.get("code", ""),
        created_at=to_iso(updated.get("created_at")),
        updated_at=to_iso(updated.get("updated_at")),
    )


@router.delete("/{snippet_id}/")
async def delete_snippet(
    workspace_id: str,
    snippet_id: str,
    current_user: str = Depends(get_current_user),
):
    """Delete a snippet."""
    await get_workspace_for_user(workspace_id, current_user)
    result = await db["snippets"].delete_one({"id": snippet_id, "workspace_id": workspace_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Program not found.",
        )
    return {"success": True}