#!/bin/bash
# hermes-dashboard/scripts/status.sh — Check dashboard service status

API_SERVICE="hermes-dashboard-api.service"
WEB_SERVICE="hermes-dashboard-web.service"
TUNNEL_SERVICE="hermes-dashboard-tunnel.service"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

svc_status() {
  if systemctl --user is-active --quiet "$1" 2>/dev/null; then
    echo -e "${GREEN}RUNNING${NC}"
  else
    echo -e "${RED}STOPPED${NC}"
  fi
}

port_status() {
  if fuser "$1/tcp" >/dev/null 2>&1; then
    echo -e "${GREEN}OPEN${NC}"
  else
    echo -e "${RED}CLOSED${NC}"
  fi
}

echo "=== Hermes Dashboard Status ==="
echo ""
echo "Services:"
echo "  API (5174):      $(svc_status $API_SERVICE)"
echo "  Vite dev (5175): $(svc_status $WEB_SERVICE)"
echo "  Tunnel:          $(svc_status $TUNNEL_SERVICE)"
echo ""
echo "Ports:"
echo "  5174 (API):      $(port_status 5174)"
echo "  5175 (Frontend): $(port_status 5175)"
echo "  8642 (Gateway):  $(port_status 8642)"
echo ""

# API health check
API_HEALTH=$(curl -sf http://localhost:5174/api/health 2>/dev/null)
if [ -n "$API_HEALTH" ]; then
  echo "API health: $(echo "$API_HEALTH" | head -c 80)"
else
  echo -e "API health: ${RED}NOT RESPONDING${NC}"
fi

# Proxy health check
PROXY_TEST=$(curl -sf http://localhost:5175/api/health 2>/dev/null)
if [ -n "$PROXY_TEST" ]; then
  echo -e "Vite proxy:  ${GREEN}WORKING (/api → 5174)${NC}"
else
  echo -e "Vite proxy:  ${RED}NOT WORKING${NC}"
fi

# Tunnel URL
TUNNEL_URL=$(cat "$HOME/.hermes/dashboard/scripts/.pids/tunnel.url" 2>/dev/null || echo "")
if [ -n "$TUNNEL_URL" ]; then
  TUNNEL_OK=$(curl -sf --max-time 5 "$TUNNEL_URL/" 2>/dev/null && echo "ok" || echo "")
  if [ -n "$TUNNEL_OK" ]; then
    echo -e "Tunnel:      ${GREEN}$TUNNEL_URL${NC}"
  else
    echo -e "Tunnel:      ${YELLOW}$TUNNEL_URL (not responding)${NC}"
  fi
else
  echo -e "Tunnel:      ${RED}No URL${NC}"
fi
