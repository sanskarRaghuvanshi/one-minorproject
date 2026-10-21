from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.config import settings
from app.db import close_db, client, db
from app.schemas import HealthResponse
from app.routers import (
    auth,
    workspaces,
    tasks,
    notes,
    resources,
    files,
    snippets,
    search,
    activity,
)


async def ensure_indexes():
    """Create MongoDB indexes idempotently on startup."""
    try:
        # Users
        await db["users"].create_index("email", unique=True, sparse=True)
        await db["users"].create_index("id", unique=True)

        # Workspaces
        await db["workspaces"].create_index("id", unique=True)
        await db["workspaces"].create_index("owner_id")

        # Child collections
        for coll_name in ["tasks", "notes", "resources", "files", "snippets", "activity"]:
            await db[coll_name].create_index("workspace_id")
            await db[coll_name].create_index("id")

        # Activity timestamp
        await db["activity"].create_index("timestamp")
    except Exception as e:
        print(f"Warning: Index creation encountered an issue: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await ensure_indexes()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title="OneSpace Backend",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.detail, "errors": exc.headers},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Flatten validation errors to a clean message
    errors = exc.errors()
    msg = "Validation error"
    if errors:
        first = errors[0]
        field = " -> ".join(str(loc) for loc in first.get("loc", []))
        msg = f"{field}: {first.get('msg', 'invalid')}"
    return JSONResponse(
        status_code=422,
        content={"message": msg, "errors": errors},
    )


# Health check endpoints
@app.get("/health", response_model=HealthResponse, tags=["health"])
@app.get("/api/health", response_model=HealthResponse, tags=["health"])
@app.get("/api/health/", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Health check endpoint: verifies MongoDB connectivity."""
    try:
        await client.admin.command("ping")
        return HealthResponse(healthy=True)
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"healthy": False, "message": "Database is unreachable"},
        )


# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(workspaces.router, prefix="/api", tags=["workspaces"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(notes.router, prefix="/api", tags=["notes"])
app.include_router(resources.router, prefix="/api", tags=["resources"])
app.include_router(files.router, prefix="/api", tags=["files"])
app.include_router(snippets.router, prefix="/api", tags=["snippets"])
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(activity.router, prefix="/api", tags=["activity"])