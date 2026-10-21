import asyncio
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

_client: Optional[AsyncIOMotorClient] = None


def get_client() -> AsyncIOMotorClient:
    """Return an AsyncIOMotorClient bound to the current running event loop."""
    global _client
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGODB_URI)
    elif getattr(_client, "io_loop", None) is not None:
        if _client.io_loop.is_closed() or (current_loop is not None and _client.io_loop != current_loop):
            _client.close()
            _client = AsyncIOMotorClient(settings.MONGODB_URI)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    """Return the database for current loop."""
    return get_client()[settings.MONGODB_DB_NAME]


class DatabaseProxy:
    """Dynamic proxy delegating collection access to the active event loop's database."""

    def __getitem__(self, item: str):
        return get_db()[item]

    def __getattr__(self, item: str):
        return getattr(get_db(), item)


class ClientProxy:
    """Dynamic proxy delegating client calls to the active event loop's client."""

    def __getitem__(self, item: str):
        return get_client()[item]

    def __getattr__(self, item: str):
        return getattr(get_client(), item)


db = DatabaseProxy()
client = ClientProxy()


async def close_db():
    """Close the MongoDB connection."""
    global _client
    if _client:
        _client.close()
        _client = None