#!/bin/bash
# hermes-dashboard/scripts/start.sh — Start dashboard services
# Architecture: API (5174) + Vite dev (5175, /api proxy → 5174) + Tunnel (→ 5175)
set -e

PID_DIR="$HOME/.hermes/dashboard/scripts/.pids"
LOG_DIR="$HOME/.hermes/dashboard/logs"
mkdir -p "$PID_DIR" "$LOG_DIR"

API_SERVICE="hermes-dashboard-api.service"
WEB_SERVICE="hermes-dashboard-web.service"
TUNNEL_SERVICE="hermes-dashboard-tunnel.service"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${GREEN}[START]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

already_up() { fuser "$1/tcp" >/dev/null 2>&1; }
service_pid() { systemctl --user show -p MainPID --value "$1" 2>/dev/null; }

# ── 1. Start API server (port 5174) ─────────────────────────────────────────
if already_up 5174; then
  API_PID=$(service_pid "$API_SERVICE")
  log "API already running on port 5174 (PID $API_PID)"
else
  systemctl --user start "$API_SERVICE"
  API_PID=$(service_pid "$API_SERVICE")
  log "API started on port 5174 (PID $API_PID)"
fi
echo "$API_PID" > "$PID_DIR/api.pid"

# Wait for API to respond
for i in $(seq 1 15); do
  if curl -sf http://localhost:5174/api/health > /dev/null 2>&1; then
    log "API ready"
    break
  fi
  [ "$i" = "15" ] && warn "API not responding after 7.5s"
  sleep 0.5
done

# ── 2. Start Vite dev server (port 5175, proxies /api → 5174) ───────────────
if already_up 5175; then
  WEB_PID=$(service_pid "$WEB_SERVICE")
  log "Vite dev already running on port 5175 (PID $WEB_PID)"
else
  systemctl --user start "$WEB_SERVICE"
  WEB_PID=$(service_pid "$WEB_SERVICE")
  log "Vite dev started on port 5175 (PID $WEB_PID)"
fi
echo "$WEB_PID" > "$PID_DIR/web.pid"

# Wait for Vite to respond
for i in $(seq 1 15); do
  if curl -sf http://localhost:5175/ > /dev/null 2>&1; then
    log "Vite dev ready"
    break
  fi
  [ "$i" = "15" ] && warn "Vite dev not responding after 7.5s"
  sleep 0.5
done

# ── 3. Start tunnel (→ 5175) ────────────────────────────────────────────────
"$HOME/.hermes/dashboard/scripts/tunnel.sh" start

TUNNEL_URL=$(cat "$PID_DIR/tunnel.url" 2>/dev/null || echo "")
echo "$TUNNEL_URL" > "$HOME/.hermes/dashboard/public/tunnel-url.txt"

# ── Summary ─────────────────────────────────────────────────────────────────
log ""
log "=========================================="
log "  Hermes Dashboard running"
log "  Local:   http://localhost:5175"
log "  API:     http://localhost:5174"
log "  Tunnel:  $TUNNEL_URL"
log "=========================================="
