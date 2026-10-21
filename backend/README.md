# OneSpace Backend

## Prerequisites

- Python 3.11+
- MongoDB Atlas cluster (free tier acceptable)
- `pip install fastapi uvicorn motor pydantic bcrypt pyjwt python-dotenv httpx python-multipart`

## Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the required values in `backend/.env`:
   - `MONGODB_URI` — your MongoDB Atlas connection string
   - `MONGODB_DB_NAME` — database name (default: `onespace`)
   - `JWT_SECRET` — a strong secret (at least 32 characters)
   - `JWT_EXPIRE_MINUTES` — token expiry in minutes (default: `1440`)
   - `CORS_ORIGINS` — comma-separated list of allowed origins

   Example `.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net
   MONGODB_DB_NAME=onespace
   JWT_SECRET=this-is-a-very-secret-key-at-least-32-chars-long!!
   JWT_EXPIRE_MINUTES=1440
   CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
   ```

3. **Important**: Add `backend/.env` to `.gitignore` — never commit real credentials.

## Atlas Setup Steps

1. Create a free MongoDB Atlas cluster at [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database user with a strong password
3. Add your development machine's IP under **Network Access** (Allow access from anywhere `0.0.0.0/0` for development)
4. Copy the `mongodb+srv://...` connection string and paste it into `backend/.env` as `MONGODB_URI`
5. Set `MONGODB_DB_NAME` and a strong `JWT_SECRET`
6. Install dependencies: `pip install -r requirements.txt` (or install the packages listed above)
7. Start the backend: `uvicorn app.main:app --reload`
8. Test the health endpoint: `curl http://localhost:8000/api/health/`

## Backend Startup

```bash
cd backend
uvicorn app.main:app --reload
```

The server will start on `http://127.0.0.1:8000` and automatically create the required MongoDB indexes on startup.

## Health Endpoint

```
GET /api/health/
```

Returns `{"healthy": true}` when the database is reachable, or `{"healthy": false}` with a `message` field when the database is unreachable. Does not reveal credentials or internal connection details.

## Test Suite

Run the automated tests:

```bash
cd backend
pytest tests/ -v
```

**Important**: Tests use a separate test database. By default, the test database name is `onespace_test`. Configure `MONGODB_URI` or `MONGODB_DB_NAME` in your test environment to use a different test database. Tests will abort if the configured database name matches the production default without explicit test configuration.

## API Summary

- **Base path**: `/api`
- **Auth**: `POST /api/auth/register/`, `POST /api/auth/login/`
- **Workspaces**: `GET/POST /api/workspaces/`, `PATCH/DELETE /api/workspaces/{id}/`, `POST /api/workspaces/{id}/archive/`
- **Tasks**: `GET/POST /api/workspaces/{id}/tasks/`, `PATCH/DELETE /api/workspaces/{id}/tasks/{taskId}/`
- **Notes**: `GET/POST /api/workspaces/{id}/notes/`, `PATCH/DELETE /api/workspaces/{id}/notes/{noteId}/`
- **Resources**: `GET/POST /api/workspaces/{id}/resources/`, `PATCH/DELETE /api/workspaces/{id}/resources/{resourceId}/`
- **Files**: `GET/POST /api/workspaces/{id}/files/` (multipart upload), `GET/DELETE /api/workspaces/{id}/files/{fileId}/`
- **Snippets**: `GET/POST /api/workspaces/{id}/snippets/`, `PATCH/DELETE /api/workspaces/{id}/snippets/{snippetId}/`
- **Activity**: `GET /api/workspaces/{id}/activity/`
- **Search**: `GET /api/workspaces/{id}/search/?q={query}`

All routes except registration and login require `Authorization: Bearer <token>`.

## Error Response Format

Non-2xx responses follow this shape:
```json
{
  "message": "human-readable explanation",
  "errors": {...optional...}
}
```

Missing, invalid, or expired tokens return HTTP 401 with an appropriate `message`.

## Security

- Passwords are hashed using bcrypt, never stored plaintext
- JWT secrets are read from environment variables, never hard-coded
- CORS origins are configured from `.env` — development defaults are not production defaults
- File uploads are limited to 10 MB server-side
- All child operations (tasks, notes, etc.) are constrained by both `workspace_id` and the user's ownership
- Input validation is enforced on the server (enum values, field lengths, URL schemes, file sizes)