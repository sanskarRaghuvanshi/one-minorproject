# OneSpace Frontend

## Overview

OneSpace is a plain HTML/vanilla JavaScript application using Tailwind CSS via CDN (not Bootstrap CSS). It's a workspace-based product management app with tasks, notes, resources, files, and saved compiler programs (snippets).

## Technologies

- **HTML/CSS/JS**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Styling**: Tailwind CSS (CDN) + custom CSS
- **Icons**: Material Symbols Outlined
- **Network**: `fetch` API, JSON payloads
- **Storage (mock)**: Browser `localStorage`
- **Authentication**: Bearer token sent as `Authorization` header

No build tools, no npm, no framework. Files are loaded via plain `<script>` tags.

## Configuration

The switch is in `js/config.js`:

```js
window.OneSpaceConfig = {
  API_BASE_URL: "",      // e.g. "http://localhost:8000"
  USE_MOCK_DATA: true    // change to false to hit the real backend
};
```

- `USE_MOCK_DATA: true` → all reads/writes go to `localStorage`.
- `USE_MOCK_DATA: false` → every call is a real `fetch` to the backend.

## API Base URL

Set `API_BASE_URL` in `js/config.js` to match your backend URL, for example:
- `http://localhost:8080` (frontend dev server)
- `http://127.0.0.1:8000` (backend API)

## Mock Mode vs Real Mode

- **`USE_MOCK_DATA: true`** (default): All data operations use browser `localStorage`. The mock data seed runs automatically on first login. This is the default mode and requires no backend setup.

- **`USE_MOCK_DATA: false`**: All data operations go to the real backend API. Requires:
  1. Backend running (`uvicorn app.main:app --reload`)
  2. `API_BASE_URL` set in `js/config.js`
  3. User registration and login via the real API

## Running the Frontend

 simply open `index.html` in a browser, or serve the `frontend/` directory with any static HTTP server:

```bash
cd frontend
python -m http.server 8080
# Then open http://localhost:8080 in your browser
```

## Authentication

- Register: `POST /api/auth/register/` (real mode) or uses mock data (mock mode)
- Login: `POST /api/auth/login/` (real mode) or uses mock data (mock mode)
- Token stored in `localStorage` under key `onespace_auth` as JSON: `{token, userId, userName, userEmail, createdAt}`
- Protected routes require `Authorization: Bearer <token>` header

## Known Limitations

- Frontend uses mock localStorage mode by default; backend setup required for real mode
- File uploads in real mode are limited to 10 MB
- Pyodide compiler runs in the main thread (may cause UI freeze on complex programs)
- Some advanced features (compiler timeouts, Web Worker Pyodide) are works in progress

## API Response/Error Format

Successful responses return the entity directly or wrapped in a `data` key. Non-2xx responses use `{ "message": "human-readable explanation", "errors": {...} }`. Missing/expired tokens return HTTP 401.