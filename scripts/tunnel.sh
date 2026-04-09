#!/bin/bash
# hermes-dashboard/scripts/tunnel.sh — Tunnel manager with auto-reconnect
PID_DIR="$HOME/.hermes/dashboard/scripts/.pids"
LOG_DIR="$HOME/.hermes/dashboard/logs"
TUNNEL_LOG="$LOG_DIR/tunnel.log"
mkdir -p "$PID_DIR" "$LOG_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()  { echo -e "${BLUE}[TUNNEL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

get_url() {
  # Try saved URL first, then scan log for any recent tunnel URL
  grep -o 'https://[^ ]*\.lhr\.life' "$TUNNEL_LOG" 2>/dev/null | grep -v 'localhost.run/docs' | tail -1
}

is_alive() {
  local url=$(get_url)
  [[ -n "$url" ]] && curl -sf --max-time 5 "$url/" > /dev/null 2>&1
}

start_tunnel() {
  log "Starting localhost.run tunnel → localhost:5176..."
  # Clear old log but keep it, redirect SSH output
  : > "$TUNNEL_LOG"
  ssh -o StrictHostKeyChecking=no \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes \
      -R 80:localhost:5176 \
      nokey@localhost.run >> "$TUNNEL_LOG" 2>&1 &
  echo $! > "$PID_DIR/tunnel-ssh.pid"
  log "SSH tunnel PID: $(cat "$PID_DIR/tunnel-ssh.pid")"

  # Wait for URL to appear in log (up to 15s)
  for i in $(seq 1 15); do
    sleep 1
    local url=$(get_url)
    if [[ -n "$url" ]]; then
      log "Tunnel online: $url"
      echo "$url" > "$PID_DIR/tunnel.url"
      return 0
    fi
  done
  warn "Tunnel URL not detected in log yet — may still be pending"
  return 1
}

case "${1:-start}" in
  start)
    if is_alive; then
      log "Already running: $(get_url)"
    else
      [[ -f "$PID_DIR/tunnel-ssh.pid" ]] && kill $(cat "$PID_DIR/tunnel-ssh.pid") 2>/dev/null
      start_tunnel
    fi
    ;;

  stop)
    if [[ -f "$PID_DIR/tunnel-ssh.pid" ]]; then
      kill $(cat "$PID_DIR/tunnel-ssh.pid") 2>/dev/null
      rm -f "$PID_DIR/tunnel-ssh.pid"
      log "Tunnel stopped"
    fi
    ;;

  restart)
    "$0" stop; sleep 1; "$0" start
    ;;

  status)
    if is_alive; then
      log "ALIVE — $(get_url)"
    else
      warn "DOWN"
    fi
    ;;

  url)
    get_url
    ;;

  log)
    cat "$TUNNEL_LOG"
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|url|log}"
    ;;
esac
