#!/usr/bin/env bash
#
# HALALMART DIGITAL SIGNAGE — one-command deploy (HTTP / IP-based, no domain needed)
#
# Usage on your VPS:
#     git clone https://github.com/halalmartacehtamiang-commits/Aplikasi-Tv-Android-.git
#     cd Aplikasi-Tv-Android-
#     chmod +x deploy.sh
#     ./deploy.sh                # auto-detects the server public IP
#     ./deploy.sh 187.77.115.222 # or pass the IP/host explicitly
#
set -euo pipefail

echo "=============================================="
echo " HALALMART DIGITAL SIGNAGE — Deploy"
echo "=============================================="

# ---------------------------------------------------------------------------
# 1. Resolve the public host (IP) used for the frontend -> backend URL
# ---------------------------------------------------------------------------
HOST="${1:-}"
if [ -z "$HOST" ]; then
  echo "-> Detecting public IP..."
  HOST="$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me || true)"
fi
if [ -z "$HOST" ]; then
  echo "!! Could not auto-detect public IP. Re-run:  ./deploy.sh <YOUR_SERVER_IP>"
  exit 1
fi
BACKEND_URL="http://${HOST}"
echo "-> Using backend URL: ${BACKEND_URL}"

# ---------------------------------------------------------------------------
# 2. Install Docker + Compose plugin if missing
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "-> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "-> Installing docker compose plugin..."
  apt-get update -y && apt-get install -y docker-compose-plugin || true
fi

# ---------------------------------------------------------------------------
# 3. Create backend/.env if it does not exist (it is gitignored, so not in repo)
# ---------------------------------------------------------------------------
if [ ! -f backend/.env ]; then
  echo "-> Creating backend/.env (generating a random JWT secret)..."
  JWT_SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n')"
  cat > backend/.env <<EOF
MONGO_URL="mongodb://mongo:27017"
DB_NAME="halalmart_signage"
CORS_ORIGINS="*"
JWT_SECRET="${JWT_SECRET}"
ADMIN_EMAIL="admin@halalmart.com"
ADMIN_PASSWORD="Halal@2026"
EMERGENT_LLM_KEY="sk-emergent-4A2E6D4A64342EaD6A"
EOF
  echo "   Admin login -> admin@halalmart.com / Halal@2026  (change ADMIN_PASSWORD in backend/.env then re-run)"
else
  echo "-> backend/.env already exists, keeping it."
fi

# ---------------------------------------------------------------------------
# 4. Frontend build URL (baked into the static build)
# ---------------------------------------------------------------------------
echo "REACT_APP_BACKEND_URL=${BACKEND_URL}" > frontend/.env
export REACT_APP_BACKEND_URL="${BACKEND_URL}"

# ---------------------------------------------------------------------------
# 5. Build & launch the stack
# ---------------------------------------------------------------------------
echo "-> Building and starting containers (this can take a few minutes)..."
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build

echo ""
echo "=============================================="
echo " Deploy complete!"
echo "----------------------------------------------"
echo " Admin dashboard : ${BACKEND_URL}/login"
echo " TV display      : ${BACKEND_URL}/display/<TV_ID>"
echo " API docs        : ${BACKEND_URL}/api/docs"
echo " Login           : admin@halalmart.com / Halal@2026"
echo "----------------------------------------------"
echo " Check status : docker compose ps"
echo " View logs    : docker compose logs -f backend"
echo "=============================================="
