# HALALMART DIGITAL SIGNAGE

Production-ready digital signage system for Android TV. Manage media, playlists, campaigns and TV screens from a modern admin dashboard, and push content to every display in real time over WebSockets.

![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React%20%2B%20MongoDB-FF5F1F)

---

## Features

**Admin Dashboard** (React + TailwindCSS, mobile-first, PWA)
- JWT authentication (login / logout)
- Dashboard: TV online / offline / total TVs / total campaigns
- Media Manager: upload images & videos (cloud object storage), preview, delete
- Playlists: create, set per-item duration, reorder, enable/disable
- Campaigns: assign playlist, start/end date scheduling, target specific TVs
- TV Management: register, name, branch, live status, last seen, restart command
- Settings: store name, logo, theme, timezone, branch, running-text ticker

**TV Display** (`/display/:tvId`)
- Fullscreen, landscape, no cursor, no scroll
- Image slideshow (Ken-Burns) + video support (auto-play)
- Live clock, logo, running-text ticker
- WebSocket realtime: content updates instantly when admin changes a playlist/campaign
- Offline cache (localStorage + service worker) and media preloading
- Auto-reconnect and remote restart command

---

## Tech Stack

| Layer     | Tech                                             |
|-----------|--------------------------------------------------|
| Backend   | FastAPI, Python 3.12, Motor (MongoDB), JWT, WebSocket |
| Frontend  | React, TailwindCSS, Shadcn UI, Framer Motion, PWA |
| Storage   | Cloud object storage (images/videos)             |
| Deploy    | Docker, Docker Compose, Nginx, Let's Encrypt (HTTPS) |

---

## Local Development

Services run under supervisor.

```bash
# Backend  -> http://localhost:8001  (routes prefixed with /api)
# Frontend -> http://localhost:3000
sudo supervisorctl status
```

Environment variables:

`backend/.env`
```
MONGO_URL=...
DB_NAME=...
JWT_SECRET=...
ADMIN_EMAIL=admin@halalmart.com
ADMIN_PASSWORD=Halal@2026
EMERGENT_LLM_KEY=...        # used for object storage
```

`frontend/.env`
```
REACT_APP_BACKEND_URL=https://your-host
```

### Default admin
```
Email:    admin@halalmart.com
Password: Halal@2026
```
The admin account is seeded automatically on startup.

---

## Usage

1. Log in at `/login`.
2. **Media** → upload images/videos.
3. **Playlists** → create a playlist, pick media, set durations, reorder.
4. **TV Screens** → register a TV, then open its **display link** on the Android TV browser (fullscreen). Copy the link with the copy button.
5. **Campaigns** → assign a playlist to TVs with a date range.
6. Any change is pushed to the TVs instantly via WebSocket.

---

## Production Deployment (Ubuntu VPS + Docker)

1. Point your domain's A record to the VPS.
2. Edit `nginx/nginx.conf` — replace `your-domain.com`.
3. Set `REACT_APP_BACKEND_URL=https://your-domain.com` in the environment.
4. Obtain certificates (first run), then start the stack:

```bash
# Issue Let's Encrypt certificate
docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d your-domain.com

# Start everything
docker compose up -d --build
```

The stack:
- `mongo` — database (persistent volume)
- `backend` — FastAPI on :8001
- `frontend` — static React build served by Nginx
- `nginx` — reverse proxy, HTTPS, WebSocket upgrade
- `certbot` — automatic certificate renewal

Nginx proxies `/api/*` (including `/api/ws/*` WebSockets) to the backend and everything else to the frontend.

---

## Project Structure

```
/app
├── backend/
│   ├── server.py            # FastAPI app: auth, media, playlists, campaigns, TVs, settings, WS
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── context/AuthContext.js
│   │   ├── lib/api.js
│   │   ├── pages/Login.js
│   │   ├── pages/Display.js          # Android TV display
│   │   └── pages/admin/              # Dashboard, Media, Playlists, Campaigns, TVs, Settings
│   ├── public/ (manifest.json, sw.js, icon.svg)
│   ├── Dockerfile
│   └── nginx.frontend.conf
├── nginx/nginx.conf         # reverse proxy + HTTPS
├── docker-compose.yml
├── docs/API.md              # full REST API reference
└── README.md
```

See [`docs/API.md`](docs/API.md) for the complete REST API reference. Interactive docs are available at `/docs` (FastAPI Swagger UI).
