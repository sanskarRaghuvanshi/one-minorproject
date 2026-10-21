from typing import List
from fastapi import APIRouter, Depends, Query

from app.db import db
from app.security import get_current_user
from app.schemas import ActivityResponse
from app.services.workspace_service import (
    get_workspace_for_user,
    to_iso,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/activity", tags=["activity"])


@router.get("/", response_model=List[ActivityResponse])
async def get_activity(
    workspace_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    current_user: str = Depends(get_current_user),
):
    """Retrieve activity log entries for a workspace, newest first."""
    await get_workspace_for_user(workspace_id, current_user)
    activities = (
        await db["activity"]
        .find({"workspace_id": workspace_id})
        .sort("timestamp", -1)
        .to_list(limit)
    )
    return [
        ActivityResponse(
            id=a["id"],
            workspace_id=a["workspace_id"],
            type=a.get("type", "general"),
            message=a.get("message", ""),
            timestamp=to_iso(a.get("timestamp")) or "",
        )
        for a in activities
    ]