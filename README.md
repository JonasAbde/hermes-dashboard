# Hermes Dashboard

Web-baseret control panel til Hermes Agent — bygget med React + Vite og en Node.js/Express API.

## Dokumentation

Se `docs/` for fuld dokumentation:
- [docs/README.md](docs/) — Start her for oversigt
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Systemarkitektur, data flow, design system
- [docs/PAGES.md](docs/PAGES.md) — Alle 10 sider dokumenteret med features og API
- [docs/DEPLOY.md](docs/DEPLOY.md) — Docker, systemd, troubleshooting
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — Dev setup, tilføj sider, debugging

## Arkitektur

```
~/.hermes/dashboard/
├── src/                    # React frontend (Vite + Tailwind)
│   ├── pages/              # 12 sider: Overview, Sessions, Chat, Memory, Cron, Approvals, Settings, Skills, Terminal, Logs
│   ├── components/         # Layout (Sidebar, Topbar), UI (Card, Chip)
│   └── hooks/useApi.js     # API fetch hook
├── api/
│   ├── server.js           # Express API server (port 5174)
│   └── query.py            # Python wrapper til Hermes SQLite DB
├── dist/                   # Built frontend (Docker)
├── Dockerfile
└── docker-compose.yml
```

**Frontend:** React 18 + Vite + Tailwind CSS + Recharts + Lucide icons  
**API:** Node.js + Express + CORS + better-sqlite3  
**Database:** Hermes' `~/.hermes/state.db` (SQLite) — tilgås via Python wrapper

---

## API Server

Startes typisk som systemd service `hermes-dashboard-api` eller via Docker.

```bash
# Local development
cd ~/.hermes/dashboard/api && node server.js

# API kører på http://localhost:5174
# Frontend proxy: localhost:5173 → localhost:5174
```

---

## Sider

| Side | Endpoint | Beskrivelse |
|------|----------|-------------|
| Overview | `/` | Stats, EKG-graf, heatmap, session-oversigt |
| Sessions | `/sessions` | Sessions-liste, trace timeline, FTS søgning |
| Chat | `/chat` | Chat direkte med Hermes via `/api/chat` |
| Memory | `/memory` | Memory-graf + fil-liste |
| Cron | `/cron` | Cron jobs, trigger-knap |
| Approvals | `/approvals` | Pending approvals — approve/deny |
| Settings | `/settings` | Model switcher, config |
| Skills | `/skills` | Installerede skills |
| Terminal | `/terminal` | CLI terminal (hermes commands) |
| Logs | `/logs` | Real-time log stream (SSE) |

---

## Konfiguration

Tailwind-farver i `src/index.css`:
- `bg: #060608`, `surface: #0d0f17`, `border: #111318`
- `accent green: #00b478`, `rust: #e05f40`, `blue: #4a80c8`, `amber: #e09040`

Design: "Terminal Neo / Obsidian Glass"

---

## Kendte issues

- `state.db` korrupt i `messages/ token-kolonner` — sessions virker fint, messages ikke
- Telegram token rejection i `gateway_state` — gateway kører stadig og svarer
- Chat via CLI kræver PTY — brug `api/hermes_chat.py` scriptet
- Chat response via `/api/chat` endnu ikke fuldt testet
- SkillsPage: rigtig data fra API mangler

---

## MCP Servers

Dashboard kan vise MCP server-status. Konfigureres i Hermes config.

---

## Links

- Hermes config: `~/.hermes/config.yaml`
- State DB: `~/.hermes/state.db`
- Sessions: `~/.hermes/sessions/`
- Memory: `~/.hermes/memory/`