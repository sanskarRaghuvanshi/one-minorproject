import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.db import db
from app.security import get_current_user
from app.schemas import TaskCreate, TaskUpdate, TaskResponse
from app.services.workspace_service import (
    get_workspace_for_user,
    log_activity,
    now_iso,
    to_iso,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/tasks", tags=["tasks"])


@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    workspace_id: str,
    current_user: str = Depends(get_current_user),
):
    """List all tasks in a workspace."""
    await get_workspace_for_user(workspace_id, current_user)
    tasks = await db["tasks"].find({"workspace_id": workspace_id}).to_list(1000)
    return [
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
    ]


@router.post("/", response_model=TaskResponse)
async def create_task(
    workspace_id: str,
    data: TaskCreate,
    current_user: str = Depends(get_current_user),
):
    """Create a new task in a workspace."""
    await get_workspace_for_user(workspace_id, current_user)
    now = now_iso()
    task = {
        "id": f"task-{uuid.uuid4().hex[:12]}",
        "workspace_id": workspace_id,
        "title": data.title.strip(),
        "description": data.description.strip() if data.description else None,
        "status": data.status or "To Do",
        "priority": data.priority or "Medium",
        "due_date": data.due_date,
        "created_at": now,
        "updated_at": now,
    }
    await db["tasks"].insert_one(task)
    await log_activity(workspace_id, "task_created", f'Created task "{task["title"]}"')

    return TaskResponse(
        id=task["id"],
        workspace_id=task["workspace_id"],
        title=task["title"],
        description=task["description"],
        status=task["status"],
        priority=task["priority"],
        due_date=task["due_date"],
        created_at=task["created_at"],
        updated_at=task["updated_at"],
    )


@router.patch("/{task_id}/", response_model=TaskResponse)
async def update_task(
    workspace_id: str,
    task_id: str,
    data: TaskUpdate,
    current_user: str = Depends(get_current_user),
):
    """Update a task."""
    await get_workspace_for_user(workspace_id, current_user)
    existing = await db["tasks"].find_one({"id": task_id, "workspace_id": workspace_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    updates = {"updated_at": now_iso()}
    if data.title is not None:
        updates["title"] = data.title.strip()
    if data.description is not None:
        updates["description"] = data.description.strip() if data.description else None
    if data.status is not None:
        updates["status"] = data.status
    if data.priority is not None:
        updates["priority"] = data.priority
    if data.due_date is not None:
        updates["due_date"] = data.due_date

    await db["tasks"].update_one({"id": task_id, "workspace_id": workspace_id}, {"$set": updates})
    updated = await db["tasks"].find_one({"id": task_id, "workspace_id": workspace_id})

    # Log activity
    if data.status == "Done" and existing.get("status") != "Done":
        await log_activity(workspace_id, "task_completed", f'Completed task "{updated["title"]}"')
    else:
        await log_activity(workspace_id, "task_updated", f'Updated task "{updated["title"]}"')

    return TaskResponse(
        id=updated["id"],
        workspace_id=updated["workspace_id"],
        title=updated["title"],
        description=updated.get("description"),
        status=updated.get("status", "To Do"),
        priority=updated.get("priority", "Medium"),
        due_date=updated.get("due_date"),
        created_at=to_iso(updated.get("created_at")),
        updated_at=to_iso(updated.get("updated_at")),
    )


@router.delete("/{task_id}/")
async def delete_task(
    workspace_id: str,
    task_id: str,
    current_user: str = Depends(get_current_user),
):
    """Delete a task."""
    await get_workspace_for_user(workspace_id, current_user)
    result = await db["tasks"].delete_one({"id": task_id, "workspace_id": workspace_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )
    return {"success": True}