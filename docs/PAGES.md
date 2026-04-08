# Hermes Dashboard — Pages Reference

Alle 13 sider dokumenteret med features, API calls, state, og kendte issues.

---

## Layout

```
Sidebar (12px wide, icon nav)
Topbar (title + gateway status + search button)
main content (overflow-y-auto, p-5)
CommandPalette (Ctrl+K overlay)
```

**Sidebar:** icon buttons — Overview, Sessions, Memory, Cron, Skills, Approvals, Terminal, Settings, Chat, Logs, Operations, Login, Onboarding. Active = rust background.

**Topbar:** Page title, gateway online/offline chip, model chip, search button (⌘K), refresh.

**CommandPalette:** Ctrl+K, fuzzy search, 4 groups: Navigation, Actions, Quick Ask, Recent. Toast notifications.

---

## 1. Overview Page (`/`)

### Features
- **4 MetricCards:** Sessions today, tokens today (k), memory %, cost month
- **Live EKG chart:** Recharts AreaChart, token throughput last 24h, 5s poll
- **Cost bar chart:** Recharts BarChart, daily costs last 30 days
- **Activity heatmap:** 7×24 grid (Mon-Sun × 00:00-23:00), rust color intensity
- **MCP servers panel:** Green dot = running, gray = stopped, command preview
- **Platform connections:** Telegram, etc. — connected/offline + time ago
- **Recent sessions:** Last 8 with title, source, model, cost, timestamp

### API Calls
```
GET /api/stats          → 10s poll
GET /api/gateway         → 8s poll
GET /api/ekg             → 5s poll
GET /api/heatmap         → once
GET /api/mcp             → 30s poll
```

### States
- Loading: skeleton shimmer on metric cards
- Empty: "Ingen sessions endnu"
- Error: falls back to null silently

### Known Issues
- memory_pct may be undefined if not in stats response

---

## 2. Sessions Page (`/sessions`)

### Features
- **Stat cards row:** Sessions today, tokens, memory, cost (same as Overview)
- **Search:** FTS via `/api/search?q=`, debounced input
- **Session table:** id (truncated), title, source badge (online/blue/pending), model, started, cost
- **Pagination:** prev/next, page indicator
- **Trace timeline:** For selected session — colored bars showing tool/assistant/user/reasoning steps with ms duration
- **Session messages:** Collapsible section with messages from `/api/sessions/:id/messages`

### API Calls
```
GET /api/sessions?page=N&q=query
GET /api/sessions/:id/trace
GET /api/sessions/:id/messages
GET /api/search?q=query
```

### Source Badge Variants
```
telegram → online (green)
cli → blue
cron → pending (amber)
api → blue
web → model (neutral)
```

### States
- Loading: 8-row skeleton table
- Empty: "Ingen sessions"
- Search with no results: "Ingen matches for 'query'"

### File Size
~832 lines — largest page

---

## 3. Chat Page (`/chat`)

### Features
- **Message bubbles:** User (rust accent) + Assistant (green), timestamp, error state (red)
- **Typing indicator:** 3 bouncing dots while waiting
- **Auto-resize textarea:** Shift+Enter = newline, Enter = send
- **Gateway status:** Online/offline indicator
- **Clear button:** Dispatch `hermes:clear-chat` event

### API Calls
```
GET  /api/gateway           → once (status check)
POST /api/chat              → { message }
```

### State
```javascript
messages: [{ id, role: 'user'|'assistant', content, timestamp, isLoading?, isError? }]
input: string
isLoading: boolean
error: string|null
gatewayStatus: 'online'|'offline'
```

### Message Flow
1. User types → Enter → message added to state
2. Assistant placeholder added (isLoading: true)
3. POST /api/chat
4. Response → update assistant message content
5. Auto-scroll to bottom

### Backend: hermes_chat.py
```
POST /api/chat → server.js → hermes_chat.py
→ reads KILOCODE_API_KEY from auth.json
→ spawns AIAgent(platform='dashboard', quiet_mode=True)
→ run_conversation(message)
→ response filtered for MCP noise → JSON
→ front-end updates
```

### Known Issues
- Chat response via /api/chat not fully tested
- Requires PTY for full Hermes CLI

---

## 4. Memory Page (`/memory`)

### Features
- **5 tabs:** Graph / Entries / Timeline / Files / Activity
- **Knowledge Graph (D3):** D3 force-directed graph, zoom/pan, minimap, search filtering
  - Nodes: entities (green), projects (blue), skills (rust)
  - Full d3.forceSimulation with collisions + centering
  - Max 50 nodes, search highlights matching nodes
- **Entries tab:** CRUD operations, search, sort by date/category, expand preview
- **Timeline tab:** Chronological entry list with filtering
- **Files tab:** Category filtering (all/memory/user/workspace/skills), sort by size/date, preview expansion
- **Activity tab:** Activity log visualization

### API Calls
```
GET /api/memory           → once
GET /api/memory/graph     → once
GET /api/memory/entries   → once
GET /api/memory/activity  → once
GET /api/memory/timeline  → once
GET /api/memory/search    → on search
POST /api/memory/entries  → add entry
```

### Memory Sources
```
~/.hermes/memories/
~/.hermes/memory/
~/.hermes/workspace/
~/.hermes/workspace/memory/
```

---

## 5. Cron Page (`/cron`)

### Features
- **Job cards:** Name, schedule (cron syntax), status chip (online/offline)
- **Trigger button:** POST /api/cron/:name/trigger
- **Last run / next run:** Timestamps
- **Toggle:** (planned, not fully implemented)

### API Calls
```
GET  /api/cron                  → list jobs
POST /api/cron/:name/trigger    → run job
```

### Job Card States
- Active: rust accent line, green "Kører" chip
- Inactive: dimmed, gray "Stoppet" chip

### Trigger Result
Inline feedback: success message or error below button.

---

## 6. Approvals Page (`/approvals`)

### Features
- **Toast notifications:** Slide-up from bottom-right, auto-dismiss
- **Approval cards:** Command preview, timestamp, approve/deny buttons
- **Approve:** green check, card animates out
- **Deny:** red X, card animates out

### API Calls
```
GET  /api/approvals
POST /api/approvals/:id/approve
POST /api/approvals/:id/deny
```

### Toast System
```javascript
toasts: [{ id, ok: bool, message: string }]
// Auto-removes after animation
```

### Backend
```sql
UPDATE approvals SET status = 'approved', resolved_at = unixepoch() WHERE id = ?
UPDATE approvals SET status = 'denied', resolved_at = unixepoch() WHERE id = ?
```
Also calls `hermes approve/deny` CLI command.

---

## 7. Settings Page (`/settings`)

### Features
- **5 tabs:** Config / Personality / MCP / Memory / System
- **Config tab:** Model switcher grid (online/offline states), key-value config table (model, provider, max_tokens, temperature, yolo), raw config.yaml view, paths
- **Personality tab:** PUT /api/control/personality for personality settings
- **MCP tab:** MCP server control via /api/mcp/:name/:action
- **Memory tab:** Compact + stats via /api/memory/compact + /api/memory/stats
- **System tab:** System info (hostname, platform, CPU, RAM, uptime)

### API Calls
```
GET  /api/config           → config object + raw_yaml
GET  /api/models           → available models + current
POST /api/control/model    → { model, provider? }
PUT  /api/control/personality → personality settings
GET  /api/mcp              → MCP servers
POST /api/mcp/:name/:action
GET  /api/memory/compact
GET  /api/memory/stats
GET  /api/system/info
```

### Model List
```javascript
kilo-auto/balanced  (kilocode) — Auto-select balanced
kilo-auto/fast      (kilocode) — Auto-select fastest
kilo-auto/reasoning (kilocode) — Auto-select reasoning
claude-sonnet-4-6.20181120 (anthropic)
```

---

## 8. Skills Page (`/skills`)

### Features
- **Skill cards:** Icon, name, version, description (2-line clamp), slash command
- **Status chip:** Aktiv/Inaktiv with pulse dot

### API Calls
```
GET /api/skills
```

### Skills Directory
`~/.hermes/skills/{skill_name}/` — reads `skill.json` for meta, falls back to first line of README.md.

### Known Issues
- SkillsPage data from API may be empty or missing — needs investigation

---

## 9. Terminal Page (`/terminal`)

### Features
- **Quick commands:** Predefined buttons (hermes status, model, gateway, cron, skills)
- **Terminal output:** Color-coded lines — green (cmd), white (out), red (err)
- **Input bar:** Command history (↑↓), Enter to run, Run button
- **Copy/Clear buttons**

### API Calls
```
GET  /api/terminal         → backends list
POST /api/terminal         → { command }
```

### Command Execution
```javascript
POST body → /api/terminal → hermes <command> 2>&1
→ stdout/stderr parsed, ANSI stripped
→ output lines added to outputLines[]
```

### History
Arrow up/down cycles through previous commands.

---

## 10. Logs Page (`/logs`)

### Features
- **SSE connection:** EventSource to `/api/logs?file=X`
- **Log file switcher:** gateway (default), errors, agent
- **Filter buttons:** All / INFO / WARN / ERROR / DEBUG with counts
- **Search:** Text filter, regex highlighting
- **Pause/Resume:** Buffers incoming lines, flushes on resume
- **Auto-scroll toggle:** On by default
- **Copy / Clear**
- **Status bar:** Connected/Reconnecting dot, file name, line count

### API Calls
```
GET /api/logs?file=agent   → SSE stream
```

### Log Format
```javascript
{ type: 'log', level: 'info'|'warn'|'error'|'debug', msg: '...' }
{ type: 'info', msg: '...' }
```

### Parsing
- Timestamp extraction: `[2026-04-07 19:54:00]` prefix stripped
- Level detection: ERROR/WARN/DEBUG keywords in text

### Ring Buffer
2000 max lines — oldest dropped when full.

### Known Issues
- SSE reconnect on error is automatic but may show briefly as "Reconnecting"

---

## 11. Operations Page (`/operations`)

### Features
- **Runtime overview:** service and process status
- **Health indicators:** repo-owned operational states summarized in one place
- **Action entry points:** shortcuts into maintenance and recovery flows

### API Calls
```
GET /api/operations
```

### Known Issues
- Page details are still being stabilized

---

## 12. Login Page (`/login`)

### Features
- **Token entry:** dashboard access token input
- **Auth feedback:** success/failure state shown inline
- **Simple flow:** keeps auth outside Hermes runtime code

### API Calls
```
POST /api/auth/verify
```

---

## 13. Onboarding Page (`/onboarding`)

### Features
- **4-step wizard:** Welcome → Model → Telegram → Review
- **Step 1 (Welcome):** Introduces the dashboard and its features
- **Step 2 (Model):** Connection test via GET /api/models, selects preferred model
- **Step 3 (Telegram):** Telegram integration setup with status indicator
- **Step 4 (Review):** Final setup via POST /api/config, shows completion summary
- Danish language throughout

### API Calls
```
GET /api/gateway
GET /api/models
GET /api/config
POST /api/config
```

---

## Shared Components

### `useApi(path, deps?)`
Fetches `/api/{path}`, returns `{ data, loading, error, refetch }`

### `usePoll(path, intervalMs)`
Wraps useApi + setInterval refetch. Used for live data.

### `Chip`
States: online (green pulse), offline (red), pending (amber pulse), model (neutral), rust, warn, cost

### `Card`
Accent variants: rust/green/amber/blue — top gradient line

### `MetricCard`
Label + big value + sub text + accent color

### `SkeletonCard`
Shimmer loading placeholder for cards

### `clsx`
Used for conditional className merging throughout