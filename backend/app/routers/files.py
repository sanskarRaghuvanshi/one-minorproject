import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from app.config import settings
from app.db import db, get_db
from app.security import get_current_user
from app.schemas import FileResponse
from app.services.workspace_service import (
    get_workspace_for_user,
    log_activity,
    now_iso,
    to_iso,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/files", tags=["files"])


@router.get("/", response_model=List[FileResponse])
async def list_files(
    workspace_id: str,
    current_user: str = Depends(get_current_user),
):
    """List all files in a workspace."""
    await get_workspace_for_user(workspace_id, current_user)
    files = await db["files"].find({"workspace_id": workspace_id}).to_list(1000)
    return [
        FileResponse(
            id=f["id"],
            workspace_id=f["workspace_id"],
            filename=f["filename"],
            size=f.get("size", 0),
            upload_date=to_iso(f.get("upload_date") or f.get("created_at")),
        )
        for f in files
    ]


@router.post("/", response_model=FileResponse)
async def upload_file(
    workspace_id: str,
    request: Request,
    current_user: str = Depends(get_current_user),
):
    """Upload a file or create a file record. Supports both multipart and JSON payloads."""
    await get_workspace_for_user(workspace_id, current_user)
    content_type = request.headers.get("content-type", "")
    now = now_iso()
    file_id = f"file-{uuid.uuid4().hex[:12]}"

    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = form.get("file")
        if not uploaded_file:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided in form data.",
            )

        filename = getattr(uploaded_file, "filename", "unnamed_file")
        file_bytes = await uploaded_file.read()

        if len(file_bytes) > settings.MAX_UPLOAD_SIZE:
            max_mb = settings.MAX_UPLOAD_SIZE // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size is {max_mb} MB.",
            )

        # Store in GridFS
        fs = AsyncIOMotorGridFSBucket(get_db())
        grid_in = fs.open_upload_stream(
            filename=filename,
            metadata={"workspace_id": workspace_id, "uploaded_by": current_user},
        )
        await grid_in.write(file_bytes)
        await grid_in.close()

        record = {
            "id": file_id,
            "workspace_id": workspace_id,
            "filename": filename,
            "size": len(file_bytes),
            "gridfs_id": grid_in._id,
            "upload_date": now,
        }
        await db["files"].insert_one(record)
        await log_activity(workspace_id, "file_uploaded", f"Uploaded {filename}")

        return FileResponse(
            id=record["id"],
            workspace_id=record["workspace_id"],
            filename=record["filename"],
            size=record["size"],
            upload_date=record["upload_date"],
        )

    else:
        # JSON payload
        try:
            body = await request.json()
        except Exception:
            body = {}

        filename = body.get("filename") or "unnamed_file"
        size = int(body.get("size") or 0)

        record = {
            "id": file_id,
            "workspace_id": workspace_id,
            "filename": filename,
            "size": size,
            "upload_date": now,
        }
        await db["files"].insert_one(record)
        await log_activity(workspace_id, "file_uploaded", f"Uploaded {filename}")

        return FileResponse(
            id=record["id"],
            workspace_id=record["workspace_id"],
            filename=record["filename"],
            size=record["size"],
            upload_date=record["upload_date"],
        )


@router.get("/{file_id}/download/")
async def download_file(
    workspace_id: str,
    file_id: str,
    current_user: str = Depends(get_current_user),
):
    """Download a file from GridFS."""
    await get_workspace_for_user(workspace_id, current_user)
    file_doc = await db["files"].find_one({"id": file_id, "workspace_id": workspace_id})
    if not file_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )

    gridfs_id = file_doc.get("gridfs_id")
    if not gridfs_id:
        # Simulated or empty file
        return Response(
            content=b"",
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{file_doc["filename"]}"',
                "X-Original-Filename": file_doc["filename"],
            },
        )

    fs = AsyncIOMotorGridFSBucket(get_db())
    try:
        grid_out = await fs.open_download_stream(gridfs_id)
        content = await grid_out.read()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored file content not found.",
        )

    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{file_doc["filename"]}"',
            "X-Original-Filename": file_doc["filename"],
        },
    )


@router.delete("/{file_id}/")
async def delete_file(
    workspace_id: str,
    file_id: str,
    current_user: str = Depends(get_current_user),
):
    """Delete a file."""
    await get_workspace_for_user(workspace_id, current_user)
    file_doc = await db["files"].find_one({"id": file_id, "workspace_id": workspace_id})
    if not file_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found.",
        )

    gridfs_id = file_doc.get("gridfs_id")
    if gridfs_id:
        fs = AsyncIOMotorGridFSBucket(get_db())
        try:
            await fs.delete(gridfs_id)
        except Exception:
            pass

    await db["files"].delete_one({"id": file_id, "workspace_id": workspace_id})
    return {"success": True}