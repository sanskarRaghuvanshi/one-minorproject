import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.db import db
from app.security import get_current_user
from app.schemas import NoteCreate, NoteUpdate, NoteResponse
from app.services.workspace_service import (
    get_workspace_for_user,
    log_activity,
    now_iso,
    to_iso,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/notes", tags=["notes"])


@router.get("/", response_model=List[NoteResponse])
async def list_notes(
    workspace_id: str,
    current_user: str = Depends(get_current_user),
):
    """List all notes in a workspace."""
    await get_workspace_for_user(workspace_id, current_user)
    notes = await db["notes"].find({"workspace_id": workspace_id}).to_list(1000)
    return [
        NoteResponse(
            id=n["id"],
            workspace_id=n["workspace_id"],
            title=n["title"],
            body=n.get("body"),
            created_at=to_iso(n.get("created_at")),
            updated_at=to_iso(n.get("updated_at")),
        )
        for n in notes
    ]


@router.post("/", response_model=NoteResponse)
async def create_note(
    workspace_id: str,
    data: NoteCreate,
    current_user: str = Depends(get_current_user),
):
    """Create a new note in a workspace."""
    await get_workspace_for_user(workspace_id, current_user)
    now = now_iso()
    note = {
        "id": f"note-{uuid.uuid4().hex[:12]}",
        "workspace_id": workspace_id,
        "title": data.title.strip(),
        "body": data.body,
        "created_at": now,
        "updated_at": now,
    }
    await db["notes"].insert_one(note)
    await log_activity(workspace_id, "note_created", f'Created note "{note["title"]}"')

    return NoteResponse(
        id=note["id"],
        workspace_id=note["workspace_id"],
        title=note["title"],
        body=note["body"],
        created_at=note["created_at"],
        updated_at=note["updated_at"],
    )


@router.patch("/{note_id}/", response_model=NoteResponse)
async def update_note(
    workspace_id: str,
    note_id: str,
    data: NoteUpdate,
    current_user: str = Depends(get_current_user),
):
    """Update a note."""
    await get_workspace_for_user(workspace_id, current_user)
    existing = await db["notes"].find_one({"id": note_id, "workspace_id": workspace_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found.",
        )

    updates = {"updated_at": now_iso()}
    if data.title is not None:
        updates["title"] = data.title.strip()
    if data.body is not None:
        updates["body"] = data.body

    await db["notes"].update_one({"id": note_id, "workspace_id": workspace_id}, {"$set": updates})
    updated = await db["notes"].find_one({"id": note_id, "workspace_id": workspace_id})

    return NoteResponse(
        id=updated["id"],
        workspace_id=updated["workspace_id"],
        title=updated["title"],
        body=updated.get("body"),
        created_at=to_iso(updated.get("created_at")),
        updated_at=to_iso(updated.get("updated_at")),
    )


@router.delete("/{note_id}/")
async def delete_note(
    workspace_id: str,
    note_id: str,
    current_user: str = Depends(get_current_user),
):
    """Delete a note."""
    await get_workspace_for_user(workspace_id, current_user)
    result = await db["notes"].delete_one({"id": note_id, "workspace_id": workspace_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found.",
        )
    return {"success": True}