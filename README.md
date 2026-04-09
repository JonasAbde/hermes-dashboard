# Hermes Dashboard

> Web-based control panel for Hermes Agent — built with React + Vite and a Node.js/Express API.

![CI](https://github.com/JonasAbde/hermes-dashboard/actions/workflows/ci.yml/badge.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![Version](https://img.shields.io/badge/version-v1.1.0-brightgreen)

A monitoring, control, and interaction dashboard for [Hermes Agent](https://github.com/JonasAbde/hermes-agent). Enables real-time session inspection, memory management, cron scheduling, and direct chat with the agent.

## Features

- **13 Pages**: Overview, Sessions, Memory, Cron, Skills, Approvals, Terminal, Settings, Chat, Logs, Operations, Login, Onboarding
- **Real-time**: SSE log streaming, EKG latency graphs, session heatmaps
- **API-first**: 79 documented REST endpoints
- **MCP Support**: Model Context Protocol server management
- **Docker-ready**: Single docker-compose up

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- Hermes Agent installed

### 1. Clone & Install
```bash
git clone https://github.com/JonasAbde/hermes-dashboard.git ~/.hermes/dashboard
cd ~/.hermes/dashboard
npm install
cd api && npm install && cd ..
```

### 2. Configure
```bash
cp .env.example .env
# Edit .env — AUTH_SECRET must be set in production
```

### 3. Start
```bash
# Terminal 1: API server
node api/server.js

# Terminal 2: Frontend dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Docker
```bash
docker compose up --build
```

## Documentation

See [docs/](docs/) for full documentation:
- [Setup](docs/DEVELOPMENT.md) — Dev environment
- [Architecture](docs/ARCHITECTURE.md) — System design
- [API Reference](API.md) — 79 endpoints
- [Deployment](docs/DEPLOY.md) — Docker, systemd
- [Pages](docs/PAGES.md) — All pages documented
- [Contributing](CONTRIBUTING.md) — Guidelines

## Architecture

### Port Map
| Port | Service | Brug |
|------|---------|------|
| 5173 | `npm run dev` | Vite dev (proxy → 5174, ingen CORS-problemer) |
| 5174 | `node api/server.js` | Express API server |
| 5175 | `npm run preview` | Vite preview (statiske filer KUN) |
| 5176 | `node api/cors-proxy.js` | **Static + API proxy + OPTIONS fix** ← tunnel her |

```
Browser → localhost.run → :5176 (cors-proxy) → :5174 (API) eller static
                              ↓
                        OPTIONS → håndteres her (ikke Express)
```

### Manager Scripts
```bash
~/.hermes/dashboard/scripts/start.sh   # Start alt
~/.hermes/dashboard/scripts/stop.sh     # Stop alt
~/.hermes/dashboard/scripts/status.sh   # Tjek status
~/.hermes/dashboard/scripts/restart.sh  # Genstart
~/.hermes/dashboard/scripts/tunnel.sh   # Tunnel: start|stop|restart|status|url|log
```

### KRITISK
**localhost.run tunnel SKAL pejle til port 5176 (cors-proxy), IKKE 5175 (vite preview)**

### Key files
- `api/server.js` — Express backend (port 5174)
- `api/cors-proxy.js` — CORS-proxy + OPTIONS fix + /api/dashboard/status
- `api/routes/` — Modulære routes (auth, chat, cron, gateway, memory, skills, stats...)
- `src/` — React 18 + Vite + Tailwind CSS

## Configuration

Tailwind color palette (src/index.css):
- Background: `#060608` | Surface: `#0d0f17` | Border: `#111318`
- Accent green: `#00b478` | Rust: `#e05f40` | Blue: `#4a80c8` | Amber: `#e09040`

Design: "Terminal Neo / Obsidian Glass"

## Known Issues

See [docs/AUDIT.md](docs/AUDIT.md) for the full audit log and accepted technical debt.

## Version

Current: **v1.1.0** — see [CHANGELOG.md](CHANGELOG.md) for history.

## License

MIT — see [LICENSE](LICENSE)
