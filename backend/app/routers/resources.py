import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.db import db
from app.security import get_current_user
from app.schemas import ResourceCreate, ResourceUpdate, ResourceResponse
from app.services.workspace_service import (
    get_workspace_for_user,
    log_activity,
    now_iso,
    to_iso,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/resources", tags=["resources"])


@router.get("/", response_model=List[ResourceResponse])
async def list_resources(
    workspace_id: str,
    current_user: str = Depends(get_current_user),
):
    """List all resources in a workspace."""
    await get_workspace_for_user(workspace_id, current_user)
    resources = await db["resources"].find({"workspace_id": workspace_id}).to_list(1000)
    return [
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
    ]


@router.post("/", response_model=ResourceResponse)
async def create_resource(
    workspace_id: str,
    data: ResourceCreate,
    current_user: str = Depends(get_current_user),
):
    """Create a new resource in a workspace."""
    await get_workspace_for_user(workspace_id, current_user)
    now = now_iso()
    resource = {
        "id": f"resource-{uuid.uuid4().hex[:12]}",
        "workspace_id": workspace_id,
        "title": data.title.strip(),
        "url": data.url.strip() if data.url else None,
        "description": data.description.strip() if data.description else None,
        "created_at": now,
        "updated_at": now,
    }
    await db["resources"].insert_one(resource)
    await log_activity(workspace_id, "resource_added", f'Added resource "{resource["title"]}"')

    return ResourceResponse(
        id=resource["id"],
        workspace_id=resource["workspace_id"],
        title=resource["title"],
        url=resource["url"],
        description=resource["description"],
        created_at=resource["created_at"],
        updated_at=resource["updated_at"],
    )


@router.patch("/{resource_id}/", response_model=ResourceResponse)
async def update_resource(
    workspace_id: str,
    resource_id: str,
    data: ResourceUpdate,
    current_user: str = Depends(get_current_user),
):
    """Update a resource."""
    await get_workspace_for_user(workspace_id, current_user)
    existing = await db["resources"].find_one({"id": resource_id, "workspace_id": workspace_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found.",
        )

    updates = {"updated_at": now_iso()}
    if data.title is not None:
        updates["title"] = data.title.strip()
    if data.url is not None:
        updates["url"] = data.url.strip() if data.url else None
    if data.description is not None:
        updates["description"] = data.description.strip() if data.description else None

    await db["resources"].update_one({"id": resource_id, "workspace_id": workspace_id}, {"$set": updates})
    updated = await db["resources"].find_one({"id": resource_id, "workspace_id": workspace_id})

    return ResourceResponse(
        id=updated["id"],
        workspace_id=updated["workspace_id"],
        title=updated["title"],
        url=updated.get("url"),
        description=updated.get("description"),
        created_at=to_iso(updated.get("created_at")),
        updated_at=to_iso(updated.get("updated_at")),
    )


@router.delete("/{resource_id}/")
async def delete_resource(
    workspace_id: str,
    resource_id: str,
    current_user: str = Depends(get_current_user),
):
    """Delete a resource."""
    await get_workspace_for_user(workspace_id, current_user)
    result = await db["resources"].delete_one({"id": resource_id, "workspace_id": workspace_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found.",
        )
    return {"success": True}