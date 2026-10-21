import os
from dotenv import load_dotenv
from pydantic import Field, validator

# Load environment variables from .env file
load_dotenv()

# MongoDB
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "onespace")

# JWT
JWT_SECRET = os.environ.get("JWT_SECRET", "this-is-a-very-secret-key-at-least-32-characters-long!!")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))

# CORS - parse from env string
_cors_origins_str = os.environ.get("CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080")
CORS_ORIGINS = [s.strip() for s in _cors_origins_str.split(",")]


# Set the settings object for import compatibility
class Settings:
    MONGODB_URI = MONGODB_URI
    MONGODB_DB_NAME = MONGODB_DB_NAME
    JWT_SECRET = JWT_SECRET
    JWT_EXPIRE_MINUTES = JWT_EXPIRE_MINUTES
    CORS_ORIGINS = CORS_ORIGINS
    MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


settings = Settings()