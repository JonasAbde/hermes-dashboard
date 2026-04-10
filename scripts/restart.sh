#!/bin/bash
# hermes-dashboard/scripts/restart.sh — Restart one or all services
PID_DIR="$HOME/.hermes/dashboard/scripts/.pids"
LOG_DIR="$HOME/.hermes/dashboard/logs"
API_SERVICE="hermes-dashboard-api.service"
PROXY_SERVICE="hermes-dashboard-proxy.service"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${BLUE}[RESTART]${NC} $1"; }

restart_tunnel() {
  ~/.hermes/dashboard/scripts/tunnel.sh restart
}

restart_service() {
  local name="$1"; local port="$2"; local pid_file="$3"
  local service_name="$4"
  log "Restarting $name..."
  # Pre-check: kill lingering processes on port to prevent EADDRINUSE
  if fuser "$port/tcp" >/dev/null 2>&1; then
    log "  Port $port still bound — killing lingering process"
    fuser -k "$port/tcp" 2>/dev/null || true
    sleep 1
  fi
  systemctl --user restart "$service_name"
  sleep 2
  systemctl --user show -p MainPID --value "$service_name" > "$pid_file"
  log "$name restarted (PID $(cat "$pid_file"))"
}

case "${1:-all}" in
  all)
    restart_service "API server"  5174 "$PID_DIR/api.pid" "$API_SERVICE"
    restart_service "CORS proxy"  5176 "$PID_DIR/cors-proxy.pid" "$PROXY_SERVICE"
    restart_tunnel
    ~/.hermes/dashboard/scripts/status.sh
    ;;
  api)
    restart_service "API server" 5174 "$PID_DIR/api.pid" "$API_SERVICE"
    ;;
  proxy)
    restart_service "CORS proxy" 5176 "$PID_DIR/cors-proxy.pid" "$PROXY_SERVICE"
    ;;
  tunnel)
    restart_tunnel
    ;;
  *)
    echo "Usage: $0 {all|api|proxy|tunnel}"
    ;;
esac
