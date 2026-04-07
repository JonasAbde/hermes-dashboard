# Hermes Dashboard — Development Guide

---

## Project Structure

```
~/.hermes/dashboard/
├── src/                    # React frontend
│   ├── App.jsx             # Router + layout
│   ├── main.jsx            # Entry point
│   ├── index.css           # Tailwind + CSS variables
│   ├── hooks/
│   │   └── useApi.js       # API fetch hooks
│   ├── pages/              # 10 page components (1-2 files each)
│   ├── components/
│   │   ├── layout/         # Sidebar, Topbar
│   │   ├── CommandPalette.jsx
│   │   └── ui/             # Card, Chip
│   └── assets/
├── api/
│   ├── server.js           # Express API (808 lines)
│   ├── query.py            # Python DB wrapper (340 lines)
│   └── hermes_chat.py      # Hermes chat integration (93 lines)
├── dist/                   # Built frontend
├── docs/                   # This documentation
├── package.json            # Frontend deps
├── vite.config.js          # Vite + proxy config
├── tailwind.config.js      # Design tokens
├── Dockerfile
└── docker-compose.yml
```

---

## Dev Setup

### Prerequisites
- Node.js 18+
- Python 3.8+
- Hermes installed at `~/.local/bin/hermes`
- Hermes venv at `~/.hermes/hermes-agent/venv/bin/python3`

### Run Locally
```bash
# Terminal 1: API server
cd ~/.hermes/dashboard/api
node server.js

# Terminal 2: Frontend dev
cd ~/.hermes/dashboard
npm run dev

# Open http://localhost:5173
```

Vite proxy handles `/api/*` → `localhost:5174`.

### Vite Proxy Config (`vite.config.js`)
```javascript
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:5174',
      changeOrigin: true,
    }
  }
}
```

---

## Adding a New Page

### 1. Create page component
```jsx
// src/pages/MyPage.jsx
import { usePoll } from '../hooks/useApi'

export function MyPage() {
  const { data, loading } = usePoll('/my-endpoint', 15000)

  return (
    <div className="max-w-4xl">
      {/* content */}
    </div>
  )
}
```

### 2. Register route in App.jsx
```jsx
import { MyPage } from './pages/MyPage'

<Route path="/my-page" element={<MyPage />} />
```

### 3. Add sidebar nav item
```jsx
// Sidebar.jsx
{ to: '/my-page', icon: MyIcon, label: 'My Page' }
```

### 4. Add CommandPalette item
```jsx
// CommandPalette.jsx - add to NAV_ITEMS
{ id: 'nav-my', group: 'Navigation', icon: MyIcon, label: 'Go to My Page', to: '/my-page' }
```

### 5. Add topbar title
```jsx
// Topbar.jsx - add to pageTitles
'/my-page': 'My Page',
```

---

## Adding an API Endpoint

### 1. Add route in server.js
```javascript
app.get('/api/my-endpoint', (req, res) => {
  try {
    // your logic
    res.json({ data: ... })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
```

### 2. Test
```bash
curl http://localhost:5174/api/my-endpoint
```

---

## Design System

### CSS Variables
```css
/* src/index.css :root */
--bg       #060608   /* Page background */
--surface  #0a0b10   /* Card background */
--surface2 #0d0f17   /* Elevated elements */
--border   #111318   /* Borders */
--t1       #d8d8e0   /* Primary text */
--t2       #6b6b80   /* Muted text */
--t3       #2a2b38   /* Disabled */
--rust     #e05f40   /* Primary accent */
--green    #00b478   /* Success/online */
--amber    #e09040   /* Warning */
--blue     #4a80c8   /* Info */
```

### Tailwind Usage
```jsx
<div className="bg-bg text-t1 border-border" />
<div className="text-rust text-green text-amber text-blue" />
<div className="bg-surface bg-surface2" />
<div className="text-[11px] font-mono" />
```

### Chip Variants
```jsx
<Chip variant="online" pulse>Connected</Chip>
<Chip variant="offline">Disconnected</Chip>
<Chip variant="pending">Pending</Chip>
<Chip variant="rust">Custom</Chip>
```

### Card Accent
```jsx
<Card accent="rust">  {/* top gradient line: rust */}
<Card accent="green"> {/* top gradient line: green */}
```

### Skeleton Loading
```jsx
<div className="skeleton h-3 w-16" />
```

---

## Data Flow Patterns

### Polling (live data)
```jsx
const { data, loading } = usePoll('/stats', 10000)
```

### One-shot (static data)
```jsx
const { data, loading } = useApi('/skills')
```

### Manual fetch
```jsx
const fetchData = async () => {
  const res = await fetch('/api/endpoint')
  const data = await res.json()
  // handle data
}
```

### Refetch after mutation
```jsx
const { data, refetch } = useApi('/approvals')
const handleApprove = async (id) => {
  await fetch(`/api/approvals/${id}/approve`, { method: 'POST' })
  refetch() // refresh list
}
```

---

## Python Query Script

`query.py` is a CLI tool called from Node:

```bash
python3 query.py <command> [args]

Commands:
  stats           → stats summary
  ekg             → token hours last 24h
  heatmap         → 7x24 activity grid
  sessions N Q    → session list (page N, query Q)
  trace ID        → trace timeline
  approvals       → pending approvals
  fts QUERY       → full-text search
```

Key pattern: iterative row-by-row loading bypasses corrupted FTS table.

---

## Hermes Chat Integration

`hermes_chat.py` sends messages to Hermes AIAgent:

```python
# Reads KILOCODE_API_KEY from ~/.hermes/auth.json
# Sets env vars and spawns AIAgent
# Returns: { 'ok': True, 'response': '...' }
```

Called from `/api/chat` endpoint with 90s timeout.

---

## Debugging

### Check API response
```bash
curl -v http://localhost:5174/api/stats | python3 -m json.tool
```

### Check DB directly
```bash
cd ~/.hermes/dashboard/api
python3 query.py stats
python3 query.py sessions 1 ""
```

### Check Hermes
```bash
hermes status
hermes model
hermes skills list
hermes cron list
```

### Check gateway
```bash
systemctl --user status hermes-gateway
journalctl --user -u hermes-gateway -n 20
```

### Frontend React DevTools
Install React DevTools browser extension to inspect component tree and state.

---

## Build for Production

```bash
cd ~/.hermes/dashboard
npm run build   # outputs to dist/
```

Then serve `dist/` via nginx, Docker, or Vite preview.

---

## Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `api/server.js` | 808 | Express API, 30+ endpoints |
| `api/query.py` | 340 | Python DB wrapper |
| `api/hermes_chat.py` | 93 | Hermes chat via AIAgent |
| `src/pages/SessionsPage.jsx` | 832 | Largest page |
| `src/pages/OverviewPage.jsx` | 272 | Dashboard home |
| `src/pages/ChatPage.jsx` | 409 | Direct Hermes chat |
| `src/components/CommandPalette.jsx` | 653 | Ctrl+K command palette |
| `src/pages/LogsPage.jsx` | 383 | Real-time log viewer |
| `src/pages/SettingsPage.jsx` | 378 | Config + model switcher |
| `src/pages/MemoryPage.jsx` | 358 | Knowledge graph + files |
| `src/hooks/useApi.js` | 34 | Fetch hooks |
| `src/index.css` | 61 | CSS variables + animations |
| `tailwind.config.js` | ~50 | Design token aliases |

---

## Known Issues

| Issue | Workaround |
|-------|-----------|
| state.db FTS korrupt | Iterative loading via query.py |
| messages/token cols korrupt | Fallback to JSONL session files |
| Chat response untested | Test with /chat page |
| SkillsPage empty data | Investigate /api/skills response |
| Telegram token rejection | Gateway works anyway, cosmetic error |
| Cloudflare tunnel unstable | Use localhost.run or Firebase Hosting |