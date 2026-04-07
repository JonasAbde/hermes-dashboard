# Hermes Dashboard

Web-baseret control panel til Hermes Agent — bygget med React + Vite og en Node.js/Express API.

## Dokumentation

Se `docs/` for fuld dokumentation:
- [CHANGELOG.md](CHANGELOG.md) — Repo-historik og ændringer
- [docs/README.md](docs/) — Start her for oversigt
- [docs/GITHUB.md](docs/GITHUB.md) — GitHub features og automation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Systemarkitektur, data flow, design system
- [docs/PAGES.md](docs/PAGES.md) — Alle nuværende sider dokumenteret med features og API
- [docs/REPO_GAPS.md](docs/REPO_GAPS.md) — Repo- og GitHub-gap analyse
- [CONTRIBUTING.md](CONTRIBUTING.md) — Commit- og PR-retningslinjer
- [docs/DEPLOY.md](docs/DEPLOY.md) — Docker, systemd, troubleshooting
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — Dev setup, tilføj sider, debugging

## Arkitektur

```
~/.hermes/dashboard/
├── src/                    # React frontend (Vite + Tailwind)
│   ├── pages/              # 13 sider: Overview, Sessions, Memory, Cron, Skills, Approvals, Terminal, Settings, Chat, Logs, Operations, Login, Onboarding
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

# API server kører på http://localhost:5174
# Frontend dev: http://localhost:5173
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
| Operations | `/operations` | Drift- og statusvisning |
| Login | `/login` | Adgangsflow for dashboard |
| Onboarding | `/onboarding` | Førstegangsopsætning og hjælp |

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