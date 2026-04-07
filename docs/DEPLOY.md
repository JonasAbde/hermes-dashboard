# Hermes Dashboard — Deployment Guide

---

## Quick Start (Local)

### Frontend
```bash
cd ~/.hermes/dashboard
npm run dev          # http://localhost:5175
```

Vite proxy forwards `/api/*` → port 5174.

### API Server
```bash
cd ~/.hermes/dashboard/api
node server.js       # http://localhost:5174
```

API server runs as systemd service `hermes-dashboard-api`.

---

## Docker (Deprecated)

**Note:** Docker container was removed. Dashboard now runs at host level only.

The following is kept for reference only:

### Previous Architecture

Docker container served the built frontend (nginx or Vite preview).
API server ran separately on the host.

```yaml
# docker-compose.yml (deprecated)
services:
  dashboard:
    build: .
    ports:
      - "5173:80"
    environment:
      - API_URL=http://host.docker.internal:5174
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

---

## API Server (Systemd Service)

### Service File
```ini
# ~/.config/systemd/user/hermes-dashboard-api.service
[Unit]
Description=Hermes Dashboard API
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/USER/.hermes/dashboard/api
ExecStart=/usr/bin/node /home/USER/.hermes/dashboard/api/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=HOME=/home/USER

[Install]
WantedBy=default.target
```

### Commands
```bash
systemctl --user daemon-reload
systemctl --user enable hermes-dashboard-api
systemctl --user start hermes-dashboard-api
systemctl --user status hermes-dashboard-api
systemctl --user restart hermes-dashboard-api
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HERMES_ROOT` | `~/.hermes` | Hermes config directory |
| `DB_PATH` | `~/.hermes/state.db` | SQLite database path |
| `HERMES_BIN` | `~/.local/bin/hermes` | Hermes CLI binary |
| `PYTHON` | `/usr/bin/python3` | Python3 for query.py |
| `VENV_PYTHON` | `~/.hermes/hermes-agent/venv/bin/python3` | Python venv for hermes_chat.py |
| `PORT` | `5174` | API server port |
| `CACHE_TTL` | `30000` | API cache TTL (ms) |

---

## Frontend Build

```bash
cd ~/.hermes/dashboard
npm run build          # outputs to dist/
npm run preview        # serve dist/ locally
```

The built `dist/` can be served by any static file server.

---

## Network Architecture

```
Browser (localhost:5175)
  └─ Vite proxy → localhost:5174 (API server)
                    ├─ Python3 query.py → ~/.hermes/sessions/*.json
                    ├─ hermes CLI → ~/.hermes/gateway
                    └─ hermes_chat.py → AIAgent runtime
```

For external access:
- The API server binds to `0.0.0.0:5174`
- For public access, add nginx reverse proxy with TLS

---

## Troubleshooting

### API returns 500
```bash
# Check Python works
cd ~/.hermes/dashboard/api
python3 query.py stats

# Check Hermes CLI
hermes status

# Check DB
ls -la ~/.hermes/state.db
sqlite3 ~/.hermes/state.db "SELECT COUNT(*) FROM sessions"
```

### Frontend can't reach API
```bash
# Verify API is running
curl http://localhost:5174/api/gateway

# Check port
ss -tlnp | grep 5174

# Check systemd
journalctl --user -u hermes-dashboard-api -f
```

### Chat not working
```bash
# Test hermes_chat.py
cd ~/.hermes/dashboard/api
python3 hermes_chat.py "hello"

# Check venv
~/.hermes/hermes-agent/venv/bin/python3 hermes_chat.py "hello"

# Check auth.json has KILOCODE_API_KEY
cat ~/.hermes/auth.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('kilocode key:', bool(d.get('credential_pool',{}).get('kilocode')))"
```

### Database corruption
query.py uses iterative row-by-row loading to bypass FTS corruption. Sessions still work. The issue is in the FTS virtual table + messages/token columns.

```python
# query.py fallback: reads from ~/.hermes/sessions/session_*.json
# instead of DB for sessions when DB fails
```

### MCP servers not showing
```bash
# Check gateway process
ps aux | grep hermes

# Check MCP config
grep -A 20 mcp_servers ~/.hermes/config.yaml

# Check pstree output
pstree -p $(cat ~/.hermes/gateway.pid)
```

---

## Firewall / Public Access

If exposing dashboard publicly:

```nginx
# /etc/nginx/conf.d/hermes-dashboard.conf
server {
    listen 443 ssl;
    server_name dashboard.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5175;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/ {
        proxy_pass http://localhost:5174;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Alternative: Cloudflare Tunnel (unstable)
```bash
# Quick test tunnel (dies after ~2 hours)
cloudflared tunnel --url http://localhost:5175
```

Better: Firebase Hosting or Cloudflare Pages for permanent URL.

---

## Logs

- API server: stdout (journalctl --user -u hermes-dashboard-api)
- Hermes gateway: ~/.hermes/logs/gateway.log
- Hermes agent: ~/.hermes/logs/agent.log
- Dashboard logs page: /logs (SSE stream from agent.log or gateway.log)