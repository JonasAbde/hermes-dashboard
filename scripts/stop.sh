#!/bin/bash
# hermes-dashboard/scripts/stop.sh — Stop dashboard services
set -e

PID_DIR="$HOME/.hermes/dashboard/scripts/.pids"

API_SERVICE="hermes-dashboard-api.service"
WEB_SERVICE="hermes-dashboard-web.service"
TUNNEL_SERVICE="hermes-dashboard-tunnel.service"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${GREEN}[STOP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Stop in reverse order: tunnel → web → API
log "Stopping tunnel..."
systemctl --user stop "$TUNNEL_SERVICE" 2>/dev/null || true
rm -f "$PID_DIR/tunnel-ssh.pid" "$PID_DIR/tunnel.url"

log "Stopping Vite dev (5175)..."
systemctl --user stop "$WEB_SERVICE" 2>/dev/null || true
rm -f "$PID_DIR/web.pid"

log "Stopping API (5174)..."
systemctl --user stop "$API_SERVICE" 2>/dev/null || true
rm -f "$PID_DIR/api.pid"

# Kill any stragglers on our ports
for port in 5174 5175; do
  if fuser "$port/tcp" >/dev/null 2>&1; then
    warn "Port $port still occupied, killing..."
    fuser -k "$port/tcp" 2>/dev/null || true
  fi
done

log "All dashboard services stopped"
