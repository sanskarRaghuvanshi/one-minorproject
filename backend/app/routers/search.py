import re
from typing import List, Optional
from fastapi import APIRouter, Depends, Query

from app.db import db
from app.security import get_current_user
from app.schemas import (
    SearchResponse,
    TaskResponse,
    NoteResponse,
    ResourceResponse,
    FileResponse,
)
from app.services.workspace_service import (
    get_workspace_for_user,
    to_iso,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/search", tags=["search"])


@router.get("/", response_model=SearchResponse)
async def search_workspace(
    workspace_id: str,
    q: Optional[str] = Query(default=""),
    current_user: str = Depends(get_current_user),
):
    """Case-insensitive search across tasks, notes, resources, and files in a workspace."""
    await get_workspace_for_user(workspace_id, current_user)
    query = (q or "").strip()
    if not query:
        return SearchResponse(tasks=[], notes=[], resources=[], files=[])

    safe_regex = {"$regex": re.escape(query), "$options": "i"}

    # Search tasks
    tasks_cursor = db["tasks"].find({
        "workspace_id": workspace_id,
        "$or": [
            {"title": safe_regex},
            {"description": safe_regex},
            {"status": safe_regex},
            {"priority": safe_regex},
        ],
    })
    tasks = await tasks_cursor.to_list(100)

    # Search notes
    notes_cursor = db["notes"].find({
        "workspace_id": workspace_id,
        "$or": [
            {"title": safe_regex},
            {"body": safe_regex},
        ],
    })
    notes = await notes_cursor.to_list(100)

    # Search resources
    resources_cursor = db["resources"].find({
        "workspace_id": workspace_id,
        "$or": [
            {"title": safe_regex},
            {"description": safe_regex},
            {"url": safe_regex},
        ],
    })
    resources = await resources_cursor.to_list(100)

    # Search files
    files_cursor = db["files"].find({
        "workspace_id": workspace_id,
        "filename": safe_regex,
    })
    files = await files_cursor.to_list(100)

    return SearchResponse(
        tasks=[
            TaskResponse(
                id=t["id"],
                workspace_id=t["workspace_id"],
                title=t["title"],
                description=t.get("description"),
                status=t.get("status", "To Do"),
                priority=t.get("priority", "Medium"),
                due_date=t.get("due_date"),
                created_at=to_iso(t.get("created_at")),
                updated_at=to_iso(t.get("updated_at")),
            )
            for t in tasks
        ],
        notes=[
            NoteResponse(
                id=n["id"],
                workspace_id=n["workspace_id"],
                title=n["title"],
                body=n.get("body"),
                created_at=to_iso(n.get("created_at")),
                updated_at=to_iso(n.get("updated_at")),
            )
            for n in notes
        ],
        resources=[
            ResourceResponse(
                id=r["id"],
                workspace_id=r["workspace_id"],
                title=r["title"],
                url=r.get("url"),
                description=r.get("description"),
                created_at=to_iso(r.get("created_at")),
                updated_at=to_iso(r.get("updated_at")),
            )
            for r in resources
        ],
        files=[
            FileResponse(
                id=f["id"],
                workspace_id=f["workspace_id"],
                filename=f["filename"],
                size=f.get("size", 0),
                upload_date=to_iso(f.get("upload_date") or f.get("created_at")),
            )
            for f in files
        ],
    )