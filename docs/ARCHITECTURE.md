# Hermes Dashboard — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                  │
│                    http://localhost:5173                        │
│                    React SPA (Vite)                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │ proxy /api/* → :5174
┌─────────────────────▼───────────────────────────────────────────┐
│                   Node.js / Express API (port 5174)              │
│                                                                 │
│  /api/gateway, /api/stats, /api/ekg, /api/heatmap               │
│  /api/sessions, /api/memory, /api/cron, /api/skills             │
│  /api/approvals, /api/chat, /api/logs, /api/mcp                 │
│  /api/terminal, /api/config, /api/models, /api/search           │
└────────┬──────────────────────┬──────────────────────────────────┘
         │                      │
    ┌────▼────────┐      ┌──────▼──────────┐
    │ Python DB   │      │ Hermes CLI       │
    │ query.py   │      │ hermes status    │
    └────┬────────┘      │ hermes model     │
         │               │ hermes cron run  │
    ┌────▼──────────────▼──────────┐
    │  ~/.hermes/state.db (SQLite) │
    └─────────────────────────────┘
         │
    ┌────▼──────────────────────┐
    │  Hermes Agent Runtime      │
    │  • Gateway process         │
    │  • MCP servers (9 active)   │
    │  • Sessions storage         │
    │  • Memory files            │
    │  • Credential pool          │
    └──────────────────────────── ┘
```

---

## Frontend (React + Vite)

**Stack:** React 18, Vite 6, Tailwind CSS 3, Recharts, Lucide React, React Router 6

### Source Structure

```
src/
├── App.jsx              # Router + layout (Sidebar + Topbar + Routes)
├── main.jsx             # React DOM entry
├── index.css            # Tailwind + CSS variables + animations
├── hooks/
│   └── useApi.js        # useApi(path), usePoll(path, intervalMs)
├── pages/
│   ├── OverviewPage.jsx # Dashboard home: metrics, EKG, heatmap, MCP, platforms
│   ├── SessionsPage.jsx # Session list, search, trace timeline (817 lines)
│   ├── ChatPage.jsx     # Direct Hermes chat (409 lines)
│   ├── MemoryPage.jsx   # Memory file list + knowledge graph
│   ├── CronPage.jsx     # Cron jobs, trigger
│   ├── ApprovalsPage.jsx# Pending approvals, approve/deny
│   ├── SettingsPage.jsx # Model switcher, config
│   ├── SkillsPage.jsx   # Skill library
│   ├── TerminalPage.jsx # CLI terminal (hermes commands)
│   └── LogsPage.jsx     # Real-time log stream (SSE, 383 lines)
└── components/
    ├── layout/
    │   ├── Sidebar.jsx  # 12 icon nav (12px wide, dark)
    │   └── Topbar.jsx   # Search + gateway status
    ├── CommandPalette.jsx # Ctrl+K modal, fuzzy search, actions (653 lines)
    └── ui/
        ├── Card.jsx     # MetricCard, SkeletonCard
        └── Chip.jsx    # Status chips (online/offline/amber)
```

### See Also

- [PAGES.md](PAGES.md) — detailed page-by-page API calls and state
- [DEVELOPMENT.md](DEVELOPMENT.md) — adding pages, endpoints, design system
- [DEPLOY.md](DEPLOY.md) — deployment, Docker, systemd service

### API Fetch Pattern

All pages use `useApi(path)` or `usePoll(path, interval)` hook from `hooks/useApi.js`:

```javascript
const { data, loading, error, refetch } = usePoll('/stats', 10000)
```

The hook fetches `/api/{path}` — Vite proxy forwards to port 5174.

### Key Pages

**OverviewPage** — 4-metric grid: sessions, tokens, memory, cost. EKG chart (Recharts AreaChart), daily cost bar chart, 7x24 activity heatmap, MCP server list, platform connections, recent sessions.

**SessionsPage** — Paginated session list, FTS search, trace timeline (colored bars), session messages. 817 lines.

**LogsPage** — SSE connection to `/api/logs`. Pause/resume, auto-scroll, level filter (INFO/WARN/ERROR/DEBUG), text search, copy, clear. Ring buffer 2000 lines.

**CommandPalette** — Ctrl+K fuzzy search over navigation + actions. Groups: Navigation, Actions, Quick Ask, Recent. Toast notifications. Keyboard nav (up/down Enter Escape).

---

## Backend (Node.js + Express)

**File:** `api/server.js` (808 lines)
**Port:** 5174

### Architecture

```
Express app
├── Middleware: cors(), express.json()
├── Static caching layer (in-memory Map, 30s TTL)
├── Route handlers (30+ endpoints)
└── Error handling per route
```

### Caching

`cache = Map()` + `pending = Map()` — deduplicates concurrent requests. 30 second TTL.

### Python Bridge (`query.py`)

Express calls Python wrapper to read Hermes' SQLite:
```
node → exec('python3 query.py <cmd> [args]') → SQLite query → JSON → Express response
```

Python handles WAL mode correctly and does iterative row-by-row loading to bypass corrupted FTS table.

---

## Data Layer

### Hermes SQLite (`~/.hermes/state.db`)

Tables:
- `sessions` — id, title, model, source, started_at, ended_at, cost
- `messages` — session_id, role, tool_name, created_at (CORRUPT)
- `approvals` — id, prompt, status, created_at, resolved_at
- FTS virtual table (CORRUPT)

### Memory Files (`~/.hermes/memory/`, `~/.hermes/workspace/memory/`)

`.md` files: MEMORY.md, USER.md, YYYY-MM-DD.md
Parsed for H3 headings → knowledge graph nodes

### Sessions Files (`~/.hermes/sessions/session_*.json`)

Fallback when DB corrupted. Same data format as DB.

---

## MCP Servers

9 active MCP servers (configured in config.yaml):
- `taskr` — HTTP
- `filesystem` — `uvx`
- `fetch` — `uvx`
- `git` — `uvx`
- `time` — `uvx`
- `sequentialthinking` — `npx`
- `pdf` — `node --stdio`
- `memory` — `node`
- `puppeteer` — `node`

Status checked via: `ps --forest -o pid,comm,args --ppid {gateway_pid}`

---

## Design System: "Terminal Neo / Obsidian Glass"

### CSS Variables

```css
--bg:       #060608   /* Deep black */
--surface:  #0a0b10   /* Card backgrounds */
--surface2: #0d0f17   /* Elevated surfaces */
--border:   #111318   /* Subtle borders */
--t1:       #d8d8e0   /* Primary text */
--t2:       #6b6b80   /* Muted text */
--t3:       #2a2b38   /* Disabled/hint text */
--rust:     #e05f40   /* Primary accent (red-orange) */
--green:    #00b478   /* Success / online */
--amber:    #e09040   /* Warning */
--blue:     #4a80c8   /* Info / secondary accent */
```

### Typography

- **Font:** Inter (UI), JetBrains Mono (code/data)
- **Scrollbar:** 4px, matches border color
- **Skeleton:** Shimmer animation for loading states

### Animations

- `.skeleton` — shimmer 1.5s infinite
- `.pulse` — blink 2s (green dot)
- `.pulse-fast` — blink 1s
- `.card-rust/green/amber/blue` — top gradient accent line

---

### Chat Integration

**`/api/chat`** → `api/hermes_chat.py` → Hermes AIAgent

```
API request → hermes_chat.py → reads KILOCODE_API_KEY from auth.json
→ spawns AIAgent with platform='dashboard'
→ AIAgent.run_conversation(message)
→ response filtered for MCP noise → JSON → API response
```

Python venv: `/home/empir/.hermes/hermes-agent/venv/bin/python3`

### See Also

- [DEVELOPMENT.md](DEVELOPMENT.md) — Python query script, Hermes chat integration
- [DEPLOY.md](DEPLOY.md) — environment variables, troubleshooting
- [STATE_OWNERSHIP.md](STATE_OWNERSHIP.md) — which files the dashboard owns vs Hermes-native

---

## Environment

- `HERMES_ROOT`: `/home/empir/.hermes`
- `DB_PATH`: `~/.hermes/state.db`
- `HERMES_BIN`: `/home/empir/.local/bin/hermes`
- `PYTHON`: `/usr/bin/python3` (for query.py)
- `VENV_PYTHON`: `/home/empir/.hermes/hermes-agent/venv/bin/python3` (for hermes_chat.py)
