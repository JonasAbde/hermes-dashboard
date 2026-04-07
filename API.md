# Hermes Dashboard API

Node.js/Express API server på port **5174**. Frontend på 5173 proxyer til denne.

---

## Base URL

```
http://localhost:5174/api/
```

---

## Stats & Telemetri

### `GET /api/gateway`
Gateway status + platform-forbindelser.

**Response:**
```json
{
  "gateway_online": true,
  "gateway_state": "running",
  "model": "kilo-auto/balanced",
  "model_label": "kilo-auto/balanced",
  "platforms": [
    { "name": "telegram", "status": "connected", "error": null, "last_seen": "..." }
  ],
  "pid": 12345,
  "updated_at": "2026-04-07T..."
}
```

---

### `GET /api/stats`
Session-stats, tokens, omkostninger.

**Response:**
```json
{
  "sessions_today": 12,
  "sessions_week": 58,
  "tokens_today": 45000,
  "cache_pct": 38,
  "cost_month": 12.34,
  "budget": "25.00",
  "avg_latency_s": 3.2,
  "recent_sessions": [...],
  "daily_costs": [{ "day": "04-07", "cost": 0.45 }]
}
```

---

### `GET /api/ekg`
Token-forbrug per time, sidste 24 timer.

**Response:**
```json
{ "points": [{ "t": "14:00", "tokens": 1200 }] }
```

---

### `GET /api/heatmap`
Sessions fordelt på dag + time (7x24 grid).

**Response:**
```json
{ "grid": [[0, 0, 3, ...], ...] }
  // grid[row][col] — row 0 = mandag, col 0 = 00:00
```

---

## Sessions

### `GET /api/sessions?page=1&q=search`
Sessions-liste med pagination og søgning.

**Query params:** `page` (default 1), `q` (søgning)

**Response:**
```json
{
  "sessions": [{ "id": "...", "title": "...", "source": "telegram", "started_at": 1234567890, "cost": 0.12 }],
  "total": 142,
  "page": 1,
  "limit": 25
}
```

---

### `GET /api/sessions/:id/trace`
Trace timeline for en session.

**Response:**
```json
{
  "steps": [
    { "label": "tool", "offset_pct": 5, "width_pct": 30, "ms": 1200, "color": "#4a80c8" }
  ]
}
```

---

### `GET /api/sessions/:id/messages`
Beskeder fra en session.

**Response:**
```json
{
  "messages": [
    { "role": "user", "content": "...", "tool_name": null, "timestamp": 1234567890 }
  ]
}
```

---

### `GET /api/search?q=query`
Fuldttekst-søgning på tværs af sessions.

**Query params:** `q` (min 2 tegn)

---

## Memory

### `GET /api/memory`
Memory-filer med preview.

**Response:**
```json
{ "files": [{ "name": "MEMORY.md", "size_kb": 12.3, "preview": "..." }], "total_kb": 45.6, "max_kb": 500 }
```

---

### `GET /api/memory/graph`
Knowledge graph nodes + links fra memory-filer.

**Response:**
```json
{ "nodes": [{ "id": "hermes-dashboard", "label": "Hermes Dashboard", "type": "project" }], "links": [{ "source": "hermes-dashboard", "target": "telegram" }] }
```

---

## Cron

### `GET /api/cron`
Liste af cron jobs fra config.yaml.

**Response:**
```json
{ "jobs": [{ "name": "daily-report", "schedule": "0 9 * * *", "enabled": true, "last_run": null, "next_run": "..." }] }
```

---

### `POST /api/cron/:name/trigger`
Trigger et cron job manuelt.

---

## Skills

### `GET /api/skills`
Installerede skills.

**Response:**
```json
{ "skills": [{ "name": "github-pr-workflow", "description": "...", "enabled": true, "slash_command": "github-pr" }] }
```

---

## Approvals

### `GET /api/approvals`
Pending approvals.

**Response:**
```json
{ "pending": [{ "id": "...", "created_at": 1234567890, "prompt": "..." }] }
```

---

### `POST /api/approvals/:id/approve`
Godkend en approval.

---

### `POST /api/approvals/:id/deny`
Afvis en approval.

---

## MCP Servers

### `GET /api/mcp`
Status på alle MCP servere.

**Response:**
```json
{ "servers": [{ "name": "git", "status": "running", "command": "uvx mcp-server-git ..." }] }
```

---

## Terminal

### `GET /api/terminal`
Tilgængelige backends.

**Response:**
```json
{ "backends": ["cli", "websocket"], "available": ["hermes", "bash"] }
```

---

### `POST /api/terminal`
Kør en Hermes CLI kommando.

**Body:**
```json
{ "command": "hermes status" }
```

**Response:**
```json
{ "ok": true, "stdout": "...", "stderr": "", "exit_code": 0 }
```

---

## Chat

### `POST /api/chat`
Send en besked til Hermes.

**Body:**
```json
{ "message": "hvad er status?" }
```

**Response:**
```json
{ "ok": true, "response": "Hermes svarer her..." }
```

---

## Config & Control

### `GET /api/config`
Aktuel konfiguration.

**Response:**
```json
{
  "config": { "model": "kilo-auto/balanced", "provider": "kilocode", "max_tokens": 4096 },
  "raw_config": "...",
  "config_path": "~/.hermes/config.yaml",
  "db_path": "~/.hermes/state.db"
}
```

---

### `GET /api/models`
Tilgængelige modeller.

**Response:**
```json
{
  "models": [{ "name": "kilo-auto/balanced", "provider": "kilocode", "description": "Auto-select balanced" }],
  "current": "kilo-auto/balanced"
}
```

---

### `POST /api/control/model`
Skift model.

**Body:**
```json
{ "model": "claude-sonnet-4-6.20181120", "provider": "anthropic" }
```

---

### `POST /api/control/gateway/restart`
Genstart gateway via systemd.

---

## Logs

### `GET /api/logs?file=agent`
Real-time log stream via SSE.

**Query params:** `file` — `agent` (default), `gateway`, `errors`

**Response:** Server-Sent Events
```
data: {"type": "log", "level": "info", "msg": "Gateway started"}

data: {"type": "log", "level": "error", "msg": "Connection failed"}
```

---

## Database

API'en læser fra Hermes' `~/.hermes/state.db` via Python wrapper (`query.py`).

**Kendte issues:**
- `messages` og `token`-kolonner i state.db er korrupte
- Sessions virker fint via iterativ loading
- FTS fallback til LIKE-søgning

**Python queries:**
- `python3 query.py stats` — stats
- `python3 query.py ekg` — EKG data
- `python3 query.py heatmap` — heatmap grid
- `python3 query.py sessions <page> <q>` — sessions
- `python3 query.py trace <session_id>` — trace
- `python3 query.py approvals` — pending approvals
- `python3 query.py fts <query>` — search