# Real-Time Communication App — Backend API

Node.js (Express 5), MongoDB (Mongoose), Socket.io. JSON REST under `/api` plus authenticated WebSocket signaling and room features.

## Environment

Copy `.env.example` to `.env` and set at least:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | Mongo connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `CLIENT_URL` | No (default) | Primary browser origin for CORS and Socket.io |
| `CORS_ORIGINS_EXTRA` | No | Comma-separated extra allowed origins |
| `ENCRYPTION_KEY` | Prod recommended | 64 hex chars or 32+ char string for `encryptData` / `decryptData` (dev may derive from `JWT_SECRET` if unset) |
| `MAX_FILE_SIZE_BYTES` | No | Upload cap (default 25 MiB) |
| `UPLOAD_DIR` | No | Local upload directory (default `uploads`) |
| `PORT` | No | HTTP port (default 5000) |
| `NODE_ENV` | No | `development` or `production` |

## REST API

All `/api` routes (except where noted) are affected by a global rate limiter. Auth routes add a stricter limiter. File uploads add a per-route upload limiter.

### Authentication

Base URL: `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/register` | No | Register user (`name`, `email`, `password`) |
| `POST` | `/login` | No | Login (`email`, `password`) |
| `GET` | `/me` | Bearer JWT | Current user |

**Headers:** `Authorization: Bearer <token>`

**Success shape:** `{ status: 'success', data: { user, token? } }`  
**Errors:** `{ status: 'fail'|'error', message, errors? }` with appropriate HTTP status (400, 401, 404, 409, 413, 429, 500).

### Rooms

Base URL: `/api/rooms` — **JWT required** on all routes.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/create` | Create room; returns `roomId`, `createdBy`, `participants`, `createdAt` |
| `GET` | `/:roomId` | Room details (8-char `roomId`, case-insensitive in URL) |
| `POST` | `/:roomId/files` | `multipart/form-data` field **`file`**. Participant-only. Creates metadata and broadcasts `file-shared` on Socket.io |
| `GET` | `/:roomId/files` | List file metadata for the room (newest first, max 100) |

### Settings & profile

Base URL: `/api/settings` — **JWT required** on all routes.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/me` | Current user settings (profile, theme, notifications, privacy) |
| `PUT` | `/profile` | Update `name` and/or `bio` (at least one field) |
| `PUT` | `/theme` | Update `themePreference`: `dark`, `light`, or `system` |
| `PUT` | `/notifications` | Partial update of notification booleans (at least one field) |
| `PUT` | `/privacy` | Partial update of privacy booleans (at least one field) |
| `POST` | `/profile-image` | `multipart/form-data` field **`image`** (PNG/JPEG/WebP, max 5 MiB) |
| `DELETE` | `/profile-image` | Remove profile image and delete stored file |
| `GET` | `/profile-image/:storageKey` | Stream profile image (authenticated) |

**Example — update profile**

```json
PUT /api/settings/profile
{ "name": "Alex Rivera", "bio": "Product engineer" }
```

**Example — update theme**

```json
PUT /api/settings/theme
{ "themePreference": "dark" }
```

**Example — update notifications**

```json
PUT /api/settings/notifications
{
  "emailNotifications": true,
  "meetingAlerts": false,
  "soundEnabled": true
}
```

**Example — update privacy**

```json
PUT /api/settings/privacy
{
  "showOnlineStatus": true,
  "allowRoomInvites": false
}
```

**Success shape (settings):**

```json
{
  "status": "success",
  "data": {
    "settings": {
      "id": "...",
      "name": "Alex Rivera",
      "email": "alex@example.com",
      "profileImage": "/api/settings/profile-image/1730000000000-abc123.webp",
      "bio": "Product engineer",
      "themePreference": "system",
      "notificationSettings": {
        "emailNotifications": true,
        "meetingAlerts": true,
        "soundEnabled": true
      },
      "privacySettings": {
        "showOnlineStatus": true,
        "allowRoomInvites": true
      },
      "lastSeen": "2026-05-15T12:00:00.000Z",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

**Profile upload response:**

```json
{
  "status": "success",
  "data": {
    "profileImage": "/api/settings/profile-image/1730000000000-abc123.webp",
    "settings": { }
  }
}
```

Files are stored under `uploads/profile-images/` with randomized names. Only the public URL path is saved on the user document. Replacing an image deletes the previous file on disk.

Unknown JSON fields are rejected with validation errors.

### Files (download)

Base URL: `/api/files` — **JWT required**.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/:fileId/download` | Stream file if the user is a participant of the file’s `roomId` |

**Allowed upload types:** controlled by MIME + extension whitelist (see `src/utils/fileConstraints.js`).

### Utilities (server-side)

- **`src/utils/encryption.js`** — `encryptData(plainText)`, `decryptData(payload)` using AES-256-GCM (for app secrets or tokens at rest; not used for file bodies by default).
- **`src/utils/validationFormat.js`** — shared express-validator error mapping.

## Socket.io

Connect with the same JWT as REST:

```text
io(SERVER_URL, { auth: { token: '<jwt>' } })
```

**CORS:** Same allowed origins as HTTP (`CLIENT_URL` + `CORS_ORIGINS_EXTRA`).

### Room presence

| Client → server | Server → clients |
|-----------------|-------------------|
| `join-room` `{ roomId }` | `user-joined`, `user-left` |
| `leave-room` `{ roomId }` | (above) |

Optional **ack** on `join-room`: `{ ok, roomId?, activeUsers?, message? }`.

After join, server may emit **`screen-share-status`** so clients sync active sharer.

### WebRTC signaling (1:1 relay)

Payloads include `roomId` and `targetSocketId`; both sockets must be in the room.

| Event | Role |
|-------|------|
| `offer` / `answer` / `ice-candidate` | Client → server → single peer; errors: `signaling-error` |

### Screen sharing (orchestration)

| Event | Description |
|-------|-------------|
| `start-screen-share` / `stop-screen-share` | `{ roomId }`; one sharer per room |
| `screen-share-status` | Broadcast `{ active, sharerSocketId, sharerUserId, sharerName }` |
| `screen-share-error` | Validation / conflict errors |

### Whiteboard

| Event | Description |
|-------|-------------|
| `whiteboard-draw` | `{ roomId, stroke }` → others receive `whiteboard-draw` |
| `whiteboard-clear` | `{ roomId }` → all in room receive `whiteboard-clear` |
| `whiteboard-error` | Validation errors |

### File sharing (real-time)

| Event | Description |
|-------|-------------|
| `file-shared` | **Server-only emit** to room after successful `POST /api/rooms/:roomId/files`. Payload: `{ file: { id, roomId, fileName, fileUrl, fileType, fileSize, uploadedBy, createdAt } }` |

### Profile updates (real-time)

| Event | Description |
|-------|-------------|
| `user-profile-updated` | Emitted to rooms where the user is currently present after profile name or image changes. Payload: `{ userId, name, profileImage }` |

### Misc socket errors

- `signaling-error`, `screen-share-error`, `whiteboard-error` — `{ message, field?, event? }`
- Socket `error` handler logs in development only.

## Security notes

- Helmet with `crossOriginResourcePolicy: cross-origin` for API + SPA setups.
- CORS: explicit allow-list; credentials enabled only for listed origins.
- Uploads: extension + MIME allow-list, size cap, random disk names, path traversal checks on download.
- `storageFileName` is never returned in JSON (`select: false` + `toJSON`).
- Production: set `ENCRYPTION_KEY`, use strong `JWT_SECRET`, restrict `CORS_ORIGINS_EXTRA`, run behind HTTPS.

## Scripts

```bash
npm install
npm run dev    # nodemon
npm start      # node
```

## Data models (high level)

- **User:** `name`, `email`, `password` (hashed), `profileImage`, `bio`, `themePreference`, `notificationSettings`, `privacySettings`, `lastSeen`, `createdAt`
- **Room:** `roomId`, `createdBy`, `participants[]`, `createdAt`
- **File:** `roomId`, `uploadedBy`, `fileName`, `fileUrl`, `fileType`, `fileSize`, `createdAt` (+ internal `storageFileName`)

No cloud storage integration: files are stored on local disk under `UPLOAD_DIR`.
