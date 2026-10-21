import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Depends

from app.config import settings


def hash_password(plain_text: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return bcrypt.hashpw(plain_text.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_text: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_text.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_jwt(token_id: str, expire_minutes: int = None) -> str:
    """Create a JWT token."""
    if expire_minutes is None:
        expire_minutes = settings.JWT_EXPIRE_MINUTES
    exp = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    to_encode = {"exp": exp, "sub": str(token_id)}
    encoded = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded


def decode_jwt(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token. Returns payload or raises."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")


def get_current_user(request: Request) -> str:
    """Extract and validate JWT token, return user_id, set it on request.state."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing authentication token",
        )

    token = auth_header.split(" ", 1)[1]
    try:
        payload = decode_jwt(token)
    except ValueError as e:
        raise HTTPException(
            status_code=401,
            detail=str(e),
        )

    user_id = payload.get("sub", "")
    request.state.user_id = user_id
    return user_id