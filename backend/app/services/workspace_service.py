import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import HTTPException, status
from app.db import db


def now_iso() -> str:
    """Return the current UTC time in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


def to_iso(val: Any) -> Optional[str]:
    """Normalize datetime or string to an ISO string."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)


async def get_workspace_for_user(workspace_id: str, user_id: str) -> Dict[str, Any]:
    """Verify that a workspace exists and belongs to the given user."""
    workspace = await db["workspaces"].find_one({"id": workspace_id})
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )
    # Check ownership
    owner_id = workspace.get("owner_id")
    if owner_id and owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this workspace.",
        )
    return workspace


async def log_activity(workspace_id: str, activity_type: str, message: str) -> Dict[str, Any]:
    """Log an activity event for a workspace."""
    entry = {
        "id": f"act-{uuid.uuid4().hex[:12]}",
        "workspace_id": workspace_id,
        "type": activity_type,
        "message": message,
        "timestamp": now_iso(),
    }
    await db["activity"].insert_one(entry)
    return entry
