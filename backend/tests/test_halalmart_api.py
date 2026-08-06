"""HalalMart Digital Signage - backend API tests."""
import os
import io
import time
import asyncio
import json
import pytest
import requests
import websockets

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback: read frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@halalmart.com"
ADMIN_PASSWORD = "Halal@2026"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


# ----- Auth -----
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, headers):
        r = requests.get(f"{API}/auth/me", headers=headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_logout(self, headers):
        r = requests.post(f"{API}/auth/logout", headers=headers)
        assert r.status_code == 200


# ----- Dashboard -----
class TestDashboard:
    def test_stats(self, headers):
        r = requests.get(f"{API}/dashboard/stats", headers=headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_tvs", "online", "offline", "total_campaigns", "total_media", "total_playlists"):
            assert k in d


# ----- Media -----
class TestMedia:
    def test_upload_list_serve_delete(self, headers):
        # 1x1 PNG
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082"
        )
        files = {"file": ("TEST_pixel.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{API}/media", headers=headers, files=files)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["type"] == "image" and m["name"] == "TEST_pixel.png" and "id" in m
        mid = m["id"]

        r2 = requests.get(f"{API}/media", headers=headers)
        assert r2.status_code == 200
        assert any(x["id"] == mid for x in r2.json())

        # Public file serve
        r3 = requests.get(f"{API}/media/{mid}/file")
        assert r3.status_code == 200
        assert r3.headers.get("Content-Type", "").startswith("image/")
        assert len(r3.content) > 0

        # Delete
        r4 = requests.delete(f"{API}/media/{mid}", headers=headers)
        assert r4.status_code == 200
        r5 = requests.get(f"{API}/media/{mid}/file")
        assert r5.status_code == 404

    def test_media_requires_auth(self):
        r = requests.get(f"{API}/media")
        assert r.status_code == 401


# ----- TVs / Playlists / Campaigns / Settings -----
class TestFullFlow:
    def test_tv_playlist_campaign_display(self, headers):
        # Register TV
        r = requests.post(f"{API}/tvs", headers=headers, json={"name": "TEST_TV", "branch": "TEST_Branch"})
        assert r.status_code == 200
        tv = r.json()
        tv_id = tv["id"]
        assert tv["status"] == "offline"

        # Update TV
        r = requests.put(f"{API}/tvs/{tv_id}", headers=headers, json={"name": "TEST_TV2", "branch": "B"})
        assert r.status_code == 200 and r.json()["name"] == "TEST_TV2"

        # List
        r = requests.get(f"{API}/tvs", headers=headers)
        assert r.status_code == 200
        assert any(t["id"] == tv_id for t in r.json())

        # Restart
        r = requests.post(f"{API}/tvs/{tv_id}/restart", headers=headers)
        assert r.status_code == 200

        # Upload media for playlist
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082"
        )
        files = {"file": ("TEST_flow.png", io.BytesIO(png), "image/png")}
        media_id = requests.post(f"{API}/media", headers=headers, files=files).json()["id"]

        # Create playlist
        r = requests.post(f"{API}/playlists", headers=headers, json={
            "name": "TEST_PL", "enabled": True,
            "items": [{"media_id": media_id, "duration": 5}]
        })
        assert r.status_code == 200
        pl = r.json()
        pl_id = pl["id"]
        assert pl["items"][0]["media_id"] == media_id

        # Update playlist (reorder/durations)
        r = requests.put(f"{API}/playlists/{pl_id}", headers=headers, json={
            "name": "TEST_PL2", "enabled": True,
            "items": [{"media_id": media_id, "duration": 10}]
        })
        assert r.status_code == 200 and r.json()["items"][0]["duration"] == 10

        # Create campaign
        r = requests.post(f"{API}/campaigns", headers=headers, json={
            "name": "TEST_CAMP", "playlist_id": pl_id,
            "start_date": "2025-01-01", "end_date": "2099-12-31",
            "target_tv_ids": [tv_id], "enabled": True
        })
        assert r.status_code == 200
        camp = r.json()
        camp_id = camp["id"]

        # Update campaign
        r = requests.put(f"{API}/campaigns/{camp_id}", headers=headers, json={
            "name": "TEST_CAMP2", "playlist_id": pl_id,
            "start_date": "2025-01-01", "end_date": "2099-12-31",
            "target_tv_ids": [tv_id], "enabled": True
        })
        assert r.status_code == 200

        # Public display
        r = requests.get(f"{API}/display/{tv_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["tv"]["id"] == tv_id
        assert d["playlist"] == "TEST_PL2"
        assert len(d["items"]) == 1 and d["items"][0]["id"] == media_id

        # Unregistered TV
        r = requests.get(f"{API}/display/nonexistent-tv-id")
        assert r.status_code == 404

        # Cleanup
        requests.delete(f"{API}/campaigns/{camp_id}", headers=headers)
        requests.delete(f"{API}/playlists/{pl_id}", headers=headers)
        requests.delete(f"{API}/media/{media_id}", headers=headers)
        r = requests.delete(f"{API}/tvs/{tv_id}", headers=headers)
        assert r.status_code == 200


# ----- Settings -----
class TestSettings:
    def test_get_update(self, headers):
        r = requests.get(f"{API}/settings", headers=headers)
        assert r.status_code == 200
        original = r.json()

        r = requests.put(f"{API}/settings", headers=headers, json={
            "store_name": "TEST_HalalMart",
            "ticker_text": "TEST ticker",
            "timezone": "UTC",
            "theme": "dark",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["store_name"] == "TEST_HalalMart"
        assert d["ticker_text"] == "TEST ticker"

        # restore
        requests.put(f"{API}/settings", headers=headers, json={
            "store_name": original.get("store_name", "HalalMart"),
            "ticker_text": original.get("ticker_text", ""),
            "timezone": original.get("timezone", "Asia/Jakarta"),
            "theme": original.get("theme", "dark"),
        })


# ----- WebSocket / Realtime online -----
class TestRealtime:
    def test_ws_marks_online(self, headers):
        # Register a TV
        tv = requests.post(f"{API}/tvs", headers=headers, json={"name": "TEST_WSTV", "branch": ""}).json()
        tv_id = tv["id"]
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + f"/api/ws/{tv_id}"

        async def run():
            async with websockets.connect(ws_url) as ws:
                # give server a moment
                await asyncio.sleep(1.0)
                r = requests.get(f"{API}/tvs", headers=headers)
                assert r.status_code == 200
                match = [t for t in r.json() if t["id"] == tv_id]
                assert match and match[0]["status"] == "online", f"TV not online: {match}"

        try:
            asyncio.run(run())
        finally:
            requests.delete(f"{API}/tvs/{tv_id}", headers=headers)
