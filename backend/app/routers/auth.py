import uuid
import bcrypt
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request, status, HTTPException
from app.db import db
from app.security import create_jwt, verify_password, hash_password
from app.schemas import UserCreate, UserLogin, UserResponse, LoginResponse

router = APIRouter(tags=["auth"])


@router.post("/register/", response_model=dict)
async def register(user_data: UserCreate):
    """Register a new user. Email is normalized to lowercase."""
    normalized_email = user_data.email.strip().lower()

    # Check if user already exists
    existing = await db["users"].find_one({"email": normalized_email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    # Hash password
    pw_hash = hash_password(user_data.password)

    # Create user
    user_id = f"user-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    user = {
        "id": user_id,
        "name": user_data.name.strip(),
        "email": normalized_email,
        "password_hash": pw_hash,
        "created_at": now,
        "updated_at": now,
    }

    await db["users"].insert_one(user)

    user_info = {"id": user_id, "name": user["name"], "email": user["email"]}
    return {
        "success": True,
        "user": user_info,
        "id": user_id,
        "name": user["name"],
        "email": user["email"],
    }


@router.post("/login/", response_model=LoginResponse)
async def login(login_data: UserLogin):
    """Login with email or username (case-insensitive)."""
    raw_identifier = login_data.identifier or login_data.email or ""
    identifier = raw_identifier.strip()
    if not identifier or not login_data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter your email or username and password.",
        )

    # Search by email (case-insensitive) or name (case-insensitive)
    user = await db["users"].find_one({
        "$or": [
            {"email": identifier.lower()},
            {"name": {"$regex": f"^{identifier}$", "$options": "i"}}
        ]
    })

    if not user or not verify_password(login_data.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/username or password.",
        )

    # Generate token
    token = create_jwt(user["id"])

    return LoginResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
        ),
    )