# HalalMart Digital Signage — REST API

Base URL: `{REACT_APP_BACKEND_URL}/api`
Interactive Swagger UI: `{BACKEND_URL}/docs`

All authenticated endpoints require the header:
```
Authorization: Bearer <token>
```

---

## Authentication

### POST `/auth/login`
```json
{ "email": "admin@halalmart.com", "password": "Halal@2026" }
```
**200** → `{ "token": "<jwt>", "user": { "id", "email", "name", "role" } }`

### GET `/auth/me`  _(auth)_
Returns the current user.

### POST `/auth/logout`  _(auth)_
Invalidates the client session.

---

## Dashboard

### GET `/dashboard/stats`  _(auth)_
```json
{ "total_tvs": 3, "online": 2, "offline": 1, "total_campaigns": 4, "total_media": 12, "total_playlists": 5 }
```

---

## Media

### GET `/media`  _(auth)_
List all (non-deleted) media.

### POST `/media`  _(auth, multipart/form-data)_
Field `file`: image or video. Returns the stored media record.

### GET `/media/{id}/file`  _(public)_
Streams the raw media bytes (used by displays and previews).

### DELETE `/media/{id}`  _(auth)_
Soft-deletes the media.

---

## Playlists

### GET `/playlists`  _(auth)_

### POST `/playlists`  _(auth)_
```json
{
  "name": "Ramadan Promo",
  "items": [{ "media_id": "<id>", "duration": 8 }],
  "enabled": true
}
```

### PUT `/playlists/{id}`  _(auth)_
Same body as create. Pushes a reload to affected TVs.

### DELETE `/playlists/{id}`  _(auth)_

Reordering is done by sending the `items` array in the desired order.

---

## Campaigns

### GET `/campaigns`  _(auth)_

### POST `/campaigns`  _(auth)_
```json
{
  "name": "Weekend Sale",
  "playlist_id": "<id>",
  "start_date": "2026-06-01",
  "end_date": "2026-06-07",
  "target_tv_ids": ["<tv_id>"],
  "enabled": true
}
```
`target_tv_ids: []` targets all TVs. Pushes a reload to targeted TVs.

### PUT `/campaigns/{id}`  _(auth)_
### DELETE `/campaigns/{id}`  _(auth)_

---

## TV Management

### GET `/tvs`  _(auth)_
Each TV includes a live `status` (`online`/`offline`) derived from active WebSocket connections.

### POST `/tvs`  _(auth)_
```json
{ "name": "Entrance Screen", "branch": "Downtown" }
```

### PUT `/tvs/{id}`  _(auth)_  — update name/branch
### DELETE `/tvs/{id}`  _(auth)_

### POST `/tvs/{id}/restart`  _(auth)_
Sends a `restart` command over WebSocket to the TV → the display reloads.

---

## Settings

### GET `/settings`  _(auth)_
### PUT `/settings`  _(auth)_
```json
{
  "store_name": "HalalMart",
  "logo_media_id": "<media_id>",
  "theme": "dark",
  "timezone": "Asia/Jakarta",
  "branch": "Main Branch",
  "ticker_text": "Welcome to HalalMart • Fresh Groceries Every Day"
}
```
Broadcasts a reload to all TVs.

---

## Logs

### GET `/logs`  _(auth)_
Returns the 200 most recent activity log entries.

---

## Display (public)

### GET `/display/{tv_id}`
Resolves the active content for a TV — the currently scheduled campaign's playlist (or the latest enabled playlist as fallback):
```json
{
  "tv": { "id", "name", "branch" },
  "settings": { "store_name", "logo_media_id", "ticker_text", "theme", "timezone" },
  "campaign": "Weekend Sale",
  "playlist": "Ramadan Promo",
  "items": [{ "id", "type": "image|video", "duration": 8, "name" }]
}
```

---

## WebSocket

### `WS /api/ws/{tv_id}`
The TV display connects here. On connect the TV is marked **online**; on disconnect, **offline**.

Server → client messages:
```json
{ "type": "reload" }    // re-fetch and restart the playlist
{ "type": "restart" }   // full page reload
```
The client sends periodic `ping` text frames as a heartbeat (updates `last_seen`).

---

## Collections (MongoDB)

`users`, `tvs`, `playlists`, `media`, `campaigns`, `settings`, `logs`
