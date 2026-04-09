#!/bin/bash
# hermes-dashboard/scripts/restart.sh — Restart one or all services
PID_DIR="$HOME/.hermes/dashboard/scripts/.pids"
LOG_DIR="$HOME/.hermes/dashboard/logs"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${BLUE}[RESTART]${NC} $1"; }

restart_tunnel() {
  ~/.hermes/dashboard/scripts/tunnel.sh restart
}

restart_service() {
  local name="$1"; local port="$2"; local pid_file="$3"
  log "Restarting $name..."
  if [[ -f "$pid_file" ]]; then
    kill $(cat "$pid_file") 2>/dev/null; sleep 1
  fi
  fuser -k "$port/tcp" 2>/dev/null; sleep 1

  cd ~/.hermes/dashboard/api
  case "$name" in
    "API server")
      nohup node server.js > "$LOG_DIR/api.log" 2>&1 &
      echo $! > "$pid_file"
      sleep 2
      log "$name restarted (PID $(cat $pid_file))"
      ;;
    "CORS proxy")
      nohup node cors-proxy.js > "$LOG_DIR/cors-proxy.log" 2>&1 &
      echo $! > "$pid_file"
      sleep 2
      log "$name restarted (PID $(cat $pid_file))"
      ;;
  esac
}

case "${1:-all}" in
  all)
    restart_service "API server"  5174 "$PID_DIR/api.pid"
    restart_service "CORS proxy"  5176 "$PID_DIR/cors-proxy.pid"
    restart_tunnel
    ~/.hermes/dashboard/scripts/status.sh
    ;;
  api)
    restart_service "API server" 5174 "$PID_DIR/api.pid"
    ;;
  proxy)
    restart_service "CORS proxy" 5176 "$PID_DIR/cors-proxy.pid"
    ;;
  tunnel)
    restart_tunnel
    ;;
  *)
    echo "Usage: $0 {all|api|proxy|tunnel}"
    ;;
esac
