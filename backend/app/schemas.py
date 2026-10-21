from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List, Any


class HealthResponse(BaseModel):
    healthy: bool
    message: Optional[str] = None


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=1, max_length=200)
    password: str = Field(..., min_length=6)

    @field_validator("email")
    @classmethod
    def email_normalize_lowercase(cls, v: str) -> str:
        return v.strip().lower()


class UserLogin(BaseModel):
    identifier: Optional[str] = None
    email: Optional[str] = None
    password: str

    model_config = ConfigDict(extra="ignore")


class UserResponse(BaseModel):
    id: str
    name: str
    email: str

    model_config = ConfigDict(extra="ignore")


class LoginResponse(BaseModel):
    token: str
    user: UserResponse


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)

    model_config = ConfigDict(extra="ignore")


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    archived: Optional[bool] = None

    model_config = ConfigDict(extra="ignore")


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    archived: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    owner_id: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    status: Optional[str] = "To Do"
    priority: Optional[str] = "Medium"
    due_date: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class TaskResponse(BaseModel):
    id: str
    workspace_id: str
    title: str
    description: Optional[str] = None
    status: str = "To Do"
    priority: str = "Medium"
    due_date: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class NoteResponse(BaseModel):
    id: str
    workspace_id: str
    title: str
    body: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class ResourceCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    url: Optional[str] = None
    description: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class ResourceResponse(BaseModel):
    id: str
    workspace_id: str
    title: str
    url: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class FileCreate(BaseModel):
    filename: str = Field(..., min_length=1)
    size: Optional[int] = 0

    model_config = ConfigDict(extra="ignore")


class FileResponse(BaseModel):
    id: str
    workspace_id: str
    filename: str
    size: int = 0
    upload_date: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class SnippetCreate(BaseModel):
    title: Optional[str] = "Untitled program"
    language: Optional[str] = "python"
    code: Optional[str] = ""

    model_config = ConfigDict(extra="ignore")


class SnippetUpdate(BaseModel):
    title: Optional[str] = None
    language: Optional[str] = None
    code: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class SnippetResponse(BaseModel):
    id: str
    workspace_id: str
    title: str = "Untitled program"
    language: Optional[str] = "python"
    code: Optional[str] = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class ActivityResponse(BaseModel):
    id: str
    workspace_id: str
    type: str
    message: str
    timestamp: str

    model_config = ConfigDict(extra="ignore")


class SearchResponse(BaseModel):
    tasks: List[TaskResponse] = []
    notes: List[NoteResponse] = []
    resources: List[ResourceResponse] = []
    files: List[FileResponse] = []

    model_config = ConfigDict(extra="ignore")