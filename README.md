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

## Deployment

### Option A — Quick deploy without a domain (HTTP, IP-based) ⭐ one command

On your Ubuntu VPS:

```bash
git clone https://github.com/halalmartacehtamiang-commits/Aplikasi-Tv-Android-.git
cd Aplikasi-Tv-Android-
chmod +x deploy.sh
./deploy.sh                 # auto-detects the server public IP
# or: ./deploy.sh 187.77.115.222
```

`deploy.sh` will: install Docker (if missing) → generate `backend/.env` (random JWT secret + admin login) → set the frontend backend URL to `http://<your-ip>` → build and start everything.

After it finishes:
- Admin dashboard: `http://<your-ip>/login`
- TV display:      `http://<your-ip>/display/<TV_ID>`
- API docs:        `http://<your-ip>/api/docs`
- Login:           `admin@halalmart.com` / `Halal@2026` (change `ADMIN_PASSWORD` in `backend/.env` then re-run `./deploy.sh`)

Useful commands: `docker compose ps`, `docker compose logs -f backend`, `docker compose down`.

> Note: HTTP/IP mode is perfect for a quick start on a LAN or a single kiosk. Because it is not HTTPS, use it on a trusted network. When you get a domain, switch to Option B for HTTPS.

### Option B — Production with a domain + HTTPS (Let's Encrypt)

1. Point your domain's A record to the VPS IP.
2. Edit `nginx/nginx.conf` — replace `your-domain.com`.
3. Issue the certificate, then launch the HTTPS stack:

```bash
export REACT_APP_BACKEND_URL=https://your-domain.com
docker compose -f docker-compose.https.yml run --rm certbot certonly \
    --webroot -w /var/www/certbot -d your-domain.com
docker compose -f docker-compose.https.yml up -d --build
```

The HTTPS stack adds `certbot` (auto-renewal) and serves on 80/443. Nginx proxies `/api/*` (including `/api/ws/*` WebSockets) to the backend and everything else to the frontend.

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
