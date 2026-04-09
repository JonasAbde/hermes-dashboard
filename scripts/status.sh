#!/bin/bash
# hermes-dashboard/scripts/status.sh — Show status of all services
PID_DIR="$HOME/.hermes/dashboard/scripts/.pids"
LOG_DIR="$HOME/.hermes/dashboard/logs"
TUNNEL_URL=$(grep -o 'https://[^ ]*lhr.life' "$LOG_DIR/tunnel.log" 2>/dev/null | tail -1)

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

alive()  { echo -e "  ${GREEN}● ACTIVE${NC}  PID $1"; }
dead()   { echo -e "  ${RED}○ DOWN${NC}"; }
check()  { local port=$1; local label=$2
           local pid=$(fuser "$port/tcp" 2>/dev/null | tr -d ' \n')
           if [[ -n "$pid" ]]; then alive "$pid"; else dead; fi
           echo "    $label"; }

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║     Hermes Dashboard — Service Status     ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# ── Services ────────────────────────────────────────────────────────────────
check 5174 "API server  (localhost:5174)"
check 5176 "CORS proxy  (localhost:5176)"
check 5175 "Vite preview(localhost:5175) [optional]"

echo ""

# ── Tunnel ──────────────────────────────────────────────────────────────────
# Check aliveness via curl (PID may be gone even if tunnel still works — localhost.run
# keeps the tunnel alive after SSH disconnects)
SAVED_URL=$(cat "$PID_DIR/tunnel.url" 2>/dev/null)
if [[ -n "$SAVED_URL" ]] && curl -sf --max-time 5 "$SAVED_URL/" > /dev/null 2>&1; then
  echo -e "  ${GREEN}● ONLINE${NC}  Tunnel: $SAVED_URL"
else
  echo -e "  ${RED}○ DOWN${NC}  Tunnel"
  [[ -n "$SAVED_URL" ]] && echo "    Last known: $SAVED_URL"
fi

echo ""
echo "  Logs:  $LOG_DIR/{api,cors-proxy,tunnel}.log"
echo ""
