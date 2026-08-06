from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import logging
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict

import jwt
import bcrypt
import requests
from bson import ObjectId
from fastapi import (
    FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form,
    WebSocket, WebSocketDisconnect, Request, Response,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# ----------------------------------------------------------------------------
# Config & DB
# ----------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@halalmart.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "halalmart-signage"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("halalmart")

app = FastAPI(title="HalalMart Digital Signage API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ----------------------------------------------------------------------------
# Object Storage
# ----------------------------------------------------------------------------
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=300,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=300,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=120)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ----------------------------------------------------------------------------
# Auth helpers
# ----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email, "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ----------------------------------------------------------------------------
# WebSocket manager
# ----------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.tv_conns: Dict[str, List[WebSocket]] = {}

    async def connect(self, tv_id: str, ws: WebSocket):
        await ws.accept()
        self.tv_conns.setdefault(tv_id, []).append(ws)

    def disconnect(self, tv_id: str, ws: WebSocket):
        conns = self.tv_conns.get(tv_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns and tv_id in self.tv_conns:
            del self.tv_conns[tv_id]

    def is_online(self, tv_id: str) -> bool:
        return bool(self.tv_conns.get(tv_id))

    async def send(self, tv_id: str, message: dict):
        for ws in list(self.tv_conns.get(tv_id, [])):
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                pass

    async def broadcast(self, message: dict):
        for tv_id in list(self.tv_conns.keys()):
            await self.send(tv_id, message)


manager = ConnectionManager()


async def log_event(action: str, detail: str = "", actor: str = "system"):
    await db.logs.insert_one({
        "id": str(uuid.uuid4()), "action": action, "detail": detail,
        "actor": actor, "created_at": datetime.now(timezone.utc).isoformat(),
    })


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    doc.pop("key", None)
    return doc


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str


class TVInput(BaseModel):
    name: str
    branch: str = ""


class PlaylistItem(BaseModel):
    media_id: str
    duration: int = 8


class PlaylistInput(BaseModel):
    name: str
    items: List[PlaylistItem] = []
    enabled: bool = True


class CampaignInput(BaseModel):
    name: str
    playlist_id: str
    start_date: str
    end_date: str
    target_tv_ids: List[str] = []
    enabled: bool = True


class SettingsInput(BaseModel):
    store_name: Optional[str] = None
    logo_media_id: Optional[str] = None
    theme: Optional[str] = None
    timezone: Optional[str] = None
    branch: Optional[str] = None
    ticker_text: Optional[str] = None


# ----------------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------------
@api_router.post("/auth/login")
async def login(body: LoginInput):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user["_id"]), email)
    await log_event("login", email, actor=email)
    return {
        "token": token,
        "user": {"id": str(user["_id"]), "email": email, "name": user.get("name", "Admin"), "role": user.get("role", "admin")},
    }


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    await log_event("logout", user["email"], actor=user["email"])
    return {"ok": True}


# ----------------------------------------------------------------------------
# Dashboard
# ----------------------------------------------------------------------------
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    tvs = await db.tvs.find({}).to_list(1000)
    total_tvs = len(tvs)
    online = sum(1 for t in tvs if manager.is_online(t["id"]))
    total_campaigns = await db.campaigns.count_documents({})
    total_media = await db.media.count_documents({"is_deleted": False})
    total_playlists = await db.playlists.count_documents({})
    return {
        "total_tvs": total_tvs,
        "online": online,
        "offline": total_tvs - online,
        "total_campaigns": total_campaigns,
        "total_media": total_media,
        "total_playlists": total_playlists,
    }


# ----------------------------------------------------------------------------
# Media
# ----------------------------------------------------------------------------
MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
        "webp": "image/webp", "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime"}


@api_router.get("/media")
async def list_media(user: dict = Depends(get_current_user)):
    items = await db.media.find({"is_deleted": False}).sort("created_at", -1).to_list(1000)
    return [clean(m) for m in items]


@api_router.post("/media")
async def upload_media(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    media_type = "video" if ext in ("mp4", "webm", "mov") else "image"
    content_type = file.content_type or MIME.get(ext, "application/octet-stream")
    data = await file.read()
    media_id = str(uuid.uuid4())
    path = f"{APP_NAME}/media/{media_id}.{ext}"
    result = put_object(path, data, content_type)
    doc = {
        "id": media_id, "name": file.filename, "type": media_type,
        "content_type": content_type, "size": result.get("size", len(data)),
        "storage_path": result["path"], "is_deleted": False, "created_at": now_iso(),
    }
    await db.media.insert_one(doc)
    await log_event("media_upload", file.filename, actor=user["email"])
    return clean(doc)


@api_router.get("/media/{media_id}/file")
async def serve_media(media_id: str):
    record = await db.media.find_one({"id": media_id, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Media not found")
    data, ctype = get_object(record["storage_path"])
    return Response(content=data, media_type=record.get("content_type", ctype))


@api_router.delete("/media/{media_id}")
async def delete_media(media_id: str, user: dict = Depends(get_current_user)):
    await db.media.update_one({"id": media_id}, {"$set": {"is_deleted": True}})
    await log_event("media_delete", media_id, actor=user["email"])
    return {"ok": True}


# ----------------------------------------------------------------------------
# Playlists
# ----------------------------------------------------------------------------
@api_router.get("/playlists")
async def list_playlists(user: dict = Depends(get_current_user)):
    items = await db.playlists.find({}).sort("created_at", -1).to_list(1000)
    return [clean(p) for p in items]


@api_router.post("/playlists")
async def create_playlist(body: PlaylistInput, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()), "name": body.name,
        "items": [i.model_dump() for i in body.items],
        "enabled": body.enabled, "created_at": now_iso(),
    }
    await db.playlists.insert_one(doc)
    await log_event("playlist_create", body.name, actor=user["email"])
    return clean(doc)


@api_router.put("/playlists/{playlist_id}")
async def update_playlist(playlist_id: str, body: PlaylistInput, user: dict = Depends(get_current_user)):
    update = {"name": body.name, "items": [i.model_dump() for i in body.items], "enabled": body.enabled}
    res = await db.playlists.update_one({"id": playlist_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    await notify_affected_playlist(playlist_id)
    await log_event("playlist_update", body.name, actor=user["email"])
    doc = await db.playlists.find_one({"id": playlist_id})
    return clean(doc)


@api_router.delete("/playlists/{playlist_id}")
async def delete_playlist(playlist_id: str, user: dict = Depends(get_current_user)):
    await db.playlists.delete_one({"id": playlist_id})
    await log_event("playlist_delete", playlist_id, actor=user["email"])
    return {"ok": True}


# ----------------------------------------------------------------------------
# Campaigns
# ----------------------------------------------------------------------------
@api_router.get("/campaigns")
async def list_campaigns(user: dict = Depends(get_current_user)):
    items = await db.campaigns.find({}).sort("created_at", -1).to_list(1000)
    return [clean(c) for c in items]


@api_router.post("/campaigns")
async def create_campaign(body: CampaignInput, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), **body.model_dump(), "created_at": now_iso()}
    await db.campaigns.insert_one(doc)
    await notify_tvs(body.target_tv_ids)
    await log_event("campaign_create", body.name, actor=user["email"])
    return clean(doc)


@api_router.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, body: CampaignInput, user: dict = Depends(get_current_user)):
    res = await db.campaigns.update_one({"id": campaign_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await notify_tvs(body.target_tv_ids)
    await log_event("campaign_update", body.name, actor=user["email"])
    doc = await db.campaigns.find_one({"id": campaign_id})
    return clean(doc)


@api_router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    doc = await db.campaigns.find_one({"id": campaign_id})
    await db.campaigns.delete_one({"id": campaign_id})
    if doc:
        await notify_tvs(doc.get("target_tv_ids", []))
    await log_event("campaign_delete", campaign_id, actor=user["email"])
    return {"ok": True}


# ----------------------------------------------------------------------------
# TVs
# ----------------------------------------------------------------------------
@api_router.get("/tvs")
async def list_tvs(user: dict = Depends(get_current_user)):
    items = await db.tvs.find({}).sort("created_at", -1).to_list(1000)
    result = []
    for t in items:
        t = clean(t)
        t["status"] = "online" if manager.is_online(t["id"]) else "offline"
        result.append(t)
    return result


@api_router.post("/tvs")
async def register_tv(body: TVInput, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()), "name": body.name, "branch": body.branch,
        "status": "offline", "last_seen": None, "created_at": now_iso(),
    }
    await db.tvs.insert_one(doc)
    await log_event("tv_register", body.name, actor=user["email"])
    return clean(doc)


@api_router.put("/tvs/{tv_id}")
async def update_tv(tv_id: str, body: TVInput, user: dict = Depends(get_current_user)):
    res = await db.tvs.update_one({"id": tv_id}, {"$set": {"name": body.name, "branch": body.branch}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="TV not found")
    doc = await db.tvs.find_one({"id": tv_id})
    doc = clean(doc)
    doc["status"] = "online" if manager.is_online(tv_id) else "offline"
    return doc


@api_router.delete("/tvs/{tv_id}")
async def delete_tv(tv_id: str, user: dict = Depends(get_current_user)):
    await db.tvs.delete_one({"id": tv_id})
    await log_event("tv_delete", tv_id, actor=user["email"])
    return {"ok": True}


@api_router.post("/tvs/{tv_id}/restart")
async def restart_tv(tv_id: str, user: dict = Depends(get_current_user)):
    await manager.send(tv_id, {"type": "restart"})
    await log_event("tv_restart", tv_id, actor=user["email"])
    return {"ok": True, "online": manager.is_online(tv_id)}


# ----------------------------------------------------------------------------
# Settings
# ----------------------------------------------------------------------------
DEFAULT_SETTINGS = {
    "key": "global", "store_name": "HalalMart", "logo_media_id": None,
    "theme": "dark", "timezone": "Asia/Jakarta", "branch": "Main Branch",
    "ticker_text": "Welcome to HalalMart • Fresh Groceries Every Day • Halal Certified Products",
}


@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "global"})
    if not doc:
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))
        doc = dict(DEFAULT_SETTINGS)
    return clean(doc)


@api_router.put("/settings")
async def update_settings(body: SettingsInput, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.settings.update_one({"key": "global"}, {"$set": update}, upsert=True)
    await manager.broadcast({"type": "reload"})
    await log_event("settings_update", "", actor=user["email"])
    doc = await db.settings.find_one({"key": "global"})
    return clean(doc)


# ----------------------------------------------------------------------------
# Logs
# ----------------------------------------------------------------------------
@api_router.get("/logs")
async def list_logs(user: dict = Depends(get_current_user)):
    items = await db.logs.find({}).sort("created_at", -1).to_list(200)
    return [clean(l) for l in items]


# ----------------------------------------------------------------------------
# Display (public) - resolves active content for a TV
# ----------------------------------------------------------------------------
async def resolve_playlist_for_tv(tv_id: str):
    now = now_iso()
    campaigns = await db.campaigns.find({"enabled": True}).sort("created_at", -1).to_list(1000)
    chosen = None
    for c in campaigns:
        if c.get("start_date", "") <= now <= (c.get("end_date", "") + "T23:59:59"):
            targets = c.get("target_tv_ids", [])
            if not targets or tv_id in targets:
                chosen = c
                break
    playlist = None
    if chosen:
        playlist = await db.playlists.find_one({"id": chosen["playlist_id"], "enabled": True})
    if not playlist:
        playlist = await db.playlists.find_one({"enabled": True}, sort=[("created_at", -1)])
    items = []
    if playlist:
        for it in playlist.get("items", []):
            media = await db.media.find_one({"id": it["media_id"], "is_deleted": False})
            if media:
                items.append({"id": media["id"], "type": media["type"], "duration": it.get("duration", 8), "name": media["name"]})
    return chosen, playlist, items


@api_router.get("/display/{tv_id}")
async def display_content(tv_id: str):
    tv = await db.tvs.find_one({"id": tv_id})
    if not tv:
        raise HTTPException(status_code=404, detail="TV not registered")
    settings = await db.settings.find_one({"key": "global"}) or dict(DEFAULT_SETTINGS)
    chosen, playlist, items = await resolve_playlist_for_tv(tv_id)
    return {
        "tv": {"id": tv["id"], "name": tv["name"], "branch": tv.get("branch", "")},
        "settings": clean(dict(settings)),
        "campaign": chosen["name"] if chosen else None,
        "playlist": playlist["name"] if playlist else None,
        "items": items,
    }


async def notify_tvs(tv_ids: List[str]):
    if not tv_ids:
        await manager.broadcast({"type": "reload"})
    else:
        for tid in tv_ids:
            await manager.send(tid, {"type": "reload"})


async def notify_affected_playlist(playlist_id: str):
    campaigns = await db.campaigns.find({"playlist_id": playlist_id}).to_list(1000)
    tv_ids = []
    for c in campaigns:
        tv_ids.extend(c.get("target_tv_ids", []))
    if tv_ids:
        for tid in set(tv_ids):
            await manager.send(tid, {"type": "reload"})
    else:
        await manager.broadcast({"type": "reload"})


# ----------------------------------------------------------------------------
# WebSocket
# ----------------------------------------------------------------------------
@app.websocket("/api/ws/{tv_id}")
async def ws_endpoint(websocket: WebSocket, tv_id: str):
    await manager.connect(tv_id, websocket)
    await db.tvs.update_one({"id": tv_id}, {"$set": {"status": "online", "last_seen": now_iso()}})
    try:
        while True:
            await websocket.receive_text()
            await db.tvs.update_one({"id": tv_id}, {"$set": {"last_seen": now_iso()}})
    except WebSocketDisconnect:
        manager.disconnect(tv_id, websocket)
        if not manager.is_online(tv_id):
            await db.tvs.update_one({"id": tv_id}, {"$set": {"status": "offline", "last_seen": now_iso()}})
    except Exception:
        manager.disconnect(tv_id, websocket)


@api_router.get("/")
async def root():
    return {"message": "HalalMart Digital Signage API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
    except Exception as e:
        logger.warning(f"index: {e}")
    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if existing is None:
        await db.users.insert_one({
            "email": ADMIN_EMAIL.lower(), "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Admin", "role": "admin", "created_at": now_iso(),
        })
        logger.info("Admin seeded")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one({"email": ADMIN_EMAIL.lower()}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})
    if not await db.settings.find_one({"key": "global"}):
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
