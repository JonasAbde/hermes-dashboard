#!/bin/bash
# hermes-dashboard/scripts/stop.sh — Stop all services
PID_DIR="$HOME/.hermes/dashboard/scripts/.pids"
SILENT=false
[[ "$1" == "--silent" ]] && SILENT=true
API_SERVICE="hermes-dashboard-api.service"
PROXY_SERVICE="hermes-dashboard-proxy.service"
TUNNEL_SERVICE="hermes-dashboard-tunnel.service"

RED='\033[0;31m'; NC='\033[0m'
stop_pid() {
  local label="$1"; local pid_file="$2"
  if [[ -f "$pid_file" ]]; then
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      [[ "$SILENT" != "true" ]] && echo -e "${RED}[STOP]${NC} $label (PID $pid)"
    fi
    rm -f "$pid_file"
  fi
}

stop_pid "API server"      "$PID_DIR/api.pid"
stop_pid "CORS proxy"      "$PID_DIR/cors-proxy.pid"
stop_pid "Tunnel"          "$PID_DIR/tunnel-ssh.pid"

systemctl --user stop "$TUNNEL_SERVICE" 2>/dev/null
systemctl --user stop "$PROXY_SERVICE" 2>/dev/null
systemctl --user stop "$API_SERVICE" 2>/dev/null
rm -f "$PID_DIR/tunnel-ssh.pid" "$PID_DIR/tunnel.url"

# Force kill by port as fallback
for port in 5174 5176; do
  pid=$(fuser "$port/tcp" 2>/dev/null | tr -d ' \n')
  [[ -n "$pid" ]] && kill "$pid" 2>/dev/null && [[ "$SILENT" != "true" ]] && echo -e "${RED}[STOP]${NC} port $port (PID $pid)"
done

# Kill orphan processes
pkill -f "node.*server.js"   2>/dev/null
pkill -f "node.*cors-proxy"  2>/dev/null
pkill -f "cloudflared.*5176"  2>/dev/null
pkill -f "local.run.*5176"   2>/dev/null

[[ "$SILENT" != "true" ]] && echo -e "${RED}[STOP]${NC} All services stopped"
