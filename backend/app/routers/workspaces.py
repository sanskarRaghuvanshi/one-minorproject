import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from app.db import db, get_db
from app.security import get_current_user
from app.schemas import WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse
from app.services.workspace_service import now_iso, to_iso

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("/", response_model=List[WorkspaceResponse])
async def list_workspaces(current_user: str = Depends(get_current_user)):
    """List all workspaces owned by the authenticated user."""
    workspaces = await db["workspaces"].find({"owner_id": current_user}).to_list(1000)
    # Sort with newest updated first
    workspaces.sort(key=lambda w: w.get("updated_at") or w.get("created_at") or "", reverse=True)
    return [
        WorkspaceResponse(
            id=w["id"],
            name=w["name"],
            description=w.get("description"),
            archived=w.get("archived", False),
            created_at=to_iso(w.get("created_at")),
            updated_at=to_iso(w.get("updated_at")),
            owner_id=w.get("owner_id"),
        )
        for w in workspaces
    ]


@router.post("/", response_model=WorkspaceResponse)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: str = Depends(get_current_user),
):
    """Create a new workspace."""
    now = now_iso()
    workspace = {
        "id": f"ws-{uuid.uuid4().hex[:12]}",
        "name": data.name.strip(),
        "description": data.description.strip() if data.description else None,
        "archived": False,
        "owner_id": current_user,
        "created_at": now,
        "updated_at": now,
    }
    await db["workspaces"].insert_one(workspace)
    return WorkspaceResponse(
        id=workspace["id"],
        name=workspace["name"],
        description=workspace["description"],
        archived=workspace["archived"],
        created_at=workspace["created_at"],
        updated_at=workspace["updated_at"],
        owner_id=workspace["owner_id"],
    )


@router.patch("/{workspace_id}/", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    data: WorkspaceUpdate,
    current_user: str = Depends(get_current_user),
):
    """Update workspace details."""
    workspace = await db["workspaces"].find_one({"id": workspace_id})
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    if workspace.get("owner_id") != current_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this workspace.",
        )

    updates = {"updated_at": now_iso()}
    if data.name is not None:
        updates["name"] = data.name.strip()
    if data.description is not None:
        updates["description"] = data.description.strip() if data.description else None
    if data.archived is not None:
        updates["archived"] = data.archived

    await db["workspaces"].update_one({"id": workspace_id}, {"$set": updates})
    updated = await db["workspaces"].find_one({"id": workspace_id})
    return WorkspaceResponse(
        id=updated["id"],
        name=updated["name"],
        description=updated.get("description"),
        archived=updated.get("archived", False),
        created_at=to_iso(updated.get("created_at")),
        updated_at=to_iso(updated.get("updated_at")),
        owner_id=updated.get("owner_id"),
    )


@router.post("/{workspace_id}/archive/", response_model=WorkspaceResponse)
async def archive_workspace(
    workspace_id: str,
    current_user: str = Depends(get_current_user),
):
    """Archive a workspace."""
    workspace = await db["workspaces"].find_one({"id": workspace_id})
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    if workspace.get("owner_id") != current_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this workspace.",
        )

    updates = {"archived": True, "updated_at": now_iso()}
    await db["workspaces"].update_one({"id": workspace_id}, {"$set": updates})
    updated = await db["workspaces"].find_one({"id": workspace_id})
    return WorkspaceResponse(
        id=updated["id"],
        name=updated["name"],
        description=updated.get("description"),
        archived=True,
        created_at=to_iso(updated.get("created_at")),
        updated_at=to_iso(updated.get("updated_at")),
        owner_id=updated.get("owner_id"),
    )


@router.delete("/{workspace_id}/")
async def delete_workspace(
    workspace_id: str,
    current_user: str = Depends(get_current_user),
):
    """Cascade delete a workspace and all its child items."""
    workspace = await db["workspaces"].find_one({"id": workspace_id})
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    if workspace.get("owner_id") != current_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this workspace.",
        )

    # Delete GridFS files if any
    fs = AsyncIOMotorGridFSBucket(get_db())
    files = await db["files"].find({"workspace_id": workspace_id}).to_list(1000)
    for f in files:
        if "gridfs_id" in f and f["gridfs_id"]:
            try:
                await fs.delete(f["gridfs_id"])
            except Exception:
                pass

    # Delete all child collections
    await db["tasks"].delete_many({"workspace_id": workspace_id})
    await db["notes"].delete_many({"workspace_id": workspace_id})
    await db["resources"].delete_many({"workspace_id": workspace_id})
    await db["files"].delete_many({"workspace_id": workspace_id})
    await db["snippets"].delete_many({"workspace_id": workspace_id})
    await db["activity"].delete_many({"workspace_id": workspace_id})

    # Delete workspace itself
    await db["workspaces"].delete_one({"id": workspace_id})

    return {"success": True}