#!/bin/bash
# hermes-dashboard/scripts/start.sh — Start all services in correct order
set -e

DIR="$HOME/.hermes/dashboard/api"
PID_DIR="$HOME/.hermes/dashboard/scripts/.pids"
mkdir -p "$PID_DIR"
LOG_DIR="$HOME/.hermes/dashboard/logs"
mkdir -p "$LOG_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${GREEN}[START]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# ── Check if services already running (don't restart if alive) ────────────────
already_up() { fuser "$1/tcp" >/dev/null 2>&1; }

# ── Start API server (port 5174) ─────────────────────────────────────────────
if already_up 5174; then
  API_PID=$(pgrep -f "node.*server.js" | head -1)
  echo "$API_PID" > "$PID_DIR/api.pid"
  log "API server already running (PID $API_PID, port 5174) — skipped"
else
  cd "$DIR"
  nohup node server.js > "$LOG_DIR/api.log" 2>&1 &
  API_PID=$!
  echo $API_PID > "$PID_DIR/api.pid"
  log "API server started (PID $API_PID, port 5174)"
fi
log "API server ready (PID $API_PID)"

# Wait for API to be ready
for i in $(seq 1 10); do
  if curl -sf http://localhost:5174/api/stats > /dev/null 2>&1; then
    log "API server ready"
    break
  fi
  sleep 0.5
done

# ── Start CORS proxy (port 5176) ─────────────────────────────────────────────
if already_up 5176; then
  PROXY_PID=$(pgrep -f "node.*cors-proxy" | head -1)
  echo "$PROXY_PID" > "$PID_DIR/cors-proxy.pid"
  log "CORS proxy already running (PID $PROXY_PID, port 5176) — skipped"
else
  nohup node cors-proxy.js > "$LOG_DIR/cors-proxy.log" 2>&1 &
  PROXY_PID=$!
  echo $PROXY_PID > "$PID_DIR/cors-proxy.pid"
  log "CORS proxy started (PID $PROXY_PID, port 5176)"
fi

for i in $(seq 1 10); do
  if curl -sf http://localhost:5176/ > /dev/null 2>&1; then
    log "CORS proxy ready"
    break
  fi
  sleep 0.5
done

# ── Start tunnel (tunnel.sh handles its own already-running check) ───────────
"$DIR/../scripts/tunnel.sh" start > "$LOG_DIR/tunnel.log" 2>&1 &
sleep 3

# Get tunnel URL (tunnel.sh saves it to .pids/tunnel.url)
TUNNEL_URL=$(cat "$PID_DIR/tunnel.url" 2>/dev/null || grep -o 'https://[^ ]*\.lhr\.life' "$LOG_DIR/tunnel.log" 2>/dev/null | tail -1 || echo "")
echo "$TUNNEL_URL" > "$DIR/../public/tunnel-url.txt"

log ""
log "========================================"
log "  Hermes Dashboard running"
log "  Tunnel: $TUNNEL_URL"
log "  Local:  http://localhost:5176"
log "========================================"
