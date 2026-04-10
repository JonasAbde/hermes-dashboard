# Hermes Dashboard — Feature Report

**Dato:** 9. april 2026  
**Version:** 1.2.0  
**Repo:** `.hermes/dashboard/` (LIVE)  
**Remote:** JonasAbde/hermes-dashboard  
**Status:** Aktiv udvikling — 89 commits, 29 uncommitted ændringer

---

## Arkitektur

| Lag | Teknologi | Beskrivelse |
|-----|-----------|-------------|
| Frontend | React 19 + Vite 6 + Tailwind CSS 3 | SPA med lazy loading |
| Backend | Express.js | API-server med 27 routes |
| Database | SQLite (state.db) | Session-data, cron, memory |
| Realtime | SSE (Server-Sent Events) | Log-streaming |
| PWA | vite-plugin-pwa | Installerbar som app |
| Auth | Opt-in login | Session-baseret |
| Tunnel | trycloudflare.com | Ekstern adgang |

---

## Sider (17 routes)

### 1. Overblik (/)
**Filer:** `OverviewPage.jsx` (529 linjer)  
**Features:**
- System-status dashboard
- Platform-række (Telegram, Discord, Slack, etc.) med online/offline indikator
- MCP-server række med start/stop
- Quick stats: omkostninger, sessioner, uptime
- Gateway-status med stale-detektion

### 2. Chat (/chat)
**Filer:** `ChatPage.jsx` (834 linjer)  
**Features:**
- Direkte chat med Hermes
- Message bubbles med markdown-rendering
- Tråd-baseret samtale
- Dag-gruppering af beskeder
- Gateway-online check før afsendelse
- Regenerate + edit + copy controls

### 3. Sessioner (/sessions)
**Filer:** `SessionsPage.jsx` (1.291 linjer)  
**Features:**
- Session-tabel med model, tokens, pris, tid
- Stat-kort (total, cost, avg tokens)
- FTS5 full-text search
- Filtrering: i dag, denne uge, denne måned
- Session replay — afspil hele samtaler
- Source-badges (CLI, Telegram, etc.)
- Skeleton loading states

### 4. Hukommelse (/memory)
**Filer:** `MemoryPage.jsx` (1.443 linjer)  
**Features:**
- D3 force-graph visualisering af memory-nodes
- Timeline-visning
- Søgning i memory-entries
- Fil-liste (memory-filer)
- Entries-tab med refresh
- Storage-panel (forbrug)
- Activity-panel (seneste ændringer)

### 5. Planlagt (/scheduled, /cron)
**Filer:** `CronPage.jsx` (1.018 linjer)  
**Features:**
- Cron job oversigt med stats-bar
- Countdown timer til næste kørsel
- Create job modal
- Enable/disable toggle
- Rediger job
- Trigger (kør nu) funktionalitet
- Output-visning per job
- Filtrering og søgning

### 6. Skills (/skills)
**Filer:** `SkillsPage.jsx` (745 linjer)  
**Features:**
- Skill-kort med frontmatter-parsing
- Kategori-filtrering
- Søgning i skills
- Rediger skill direkte (frontmatter + indhold)
- Installér/afinstallér skills
- Skill-path mapping

### 7. Godkendelser (/approvals)
**Filer:** `ApprovalsPage.jsx` (312 linjer)  
**Features:**
- Approval-kø med kort
- Godkend/afvis handlinger
- Toast-notifikationer
- Skeleton loading
- Error-state med retry
- Empty-state

### 8. Logs (/logs)
**Filer:** `LogsPage.jsx` (682 linjer)  
**Features:**
- SSE streaming af logs i realtid
- Log-fil dropdown med persistence
- Søgning (inkl. regex)
- Log-level filtrering (info, warn, error)
- Timestamp-parsing
- Session-click navigation
- URL-query parameter synk

### 9. Drift (/operations)
**Filer:** `OperationsPage.jsx` (249 linjer)  
**Features:**
- Service-kort (gateway, API, etc.)
- Start/stop/restart handlinger
- Uptime visning
- Åbn logs direkte

### 10. Terminal (/terminal)
**Filer:** `TerminalPage.jsx` (305 linjer)  
**Features:**
- xterm.js terminal-emulator
- Session-historik
- ErrorBoundary beskyttelse
- Auto-cleanup

### 11. Omkostninger (/cost)
**Filer:** `CostPage.jsx` (559 linjer)  
**Features:**
- Budget-alert med progress-bar
- Cost grafer (Recharts)
- Månedligt forbrug
- Token-forbrug over tid
- Per-model opdeling

### 12. MCP Tools (/mcp)
**Filer:** `McpPage.jsx` (964 linjer)  
**Features:**
- MCP-server status og start/stop
- Schema-viewer for tool-inputs
- Tool-kald direkte fra UI
- Parameter-formular med default values
- Kørehistorik med timestamps

### 13. GitHub (/github)
**Filer:** `GitHubPage.jsx` (1.481 linjer) — største side  
**Features:**
- Actions (CI/CD) oversigt
- Issues med status badges
- Pull Requests med severity
- Commits historik
- Releases
- Projects
- Insights
- Webhooks konfiguration
- Repo-config

### 14. Profil (/profile)
**Filer:** `ProfilePage.jsx` (400 linjer)  
**Features:**
- Profile completeness score
- Quick toggles (proaktiv, telegram, auto-handle) med persistence
- Tone card (personality + model)
- Known facts preview
- Avatar upload med custom override
- Memory stats

### 15. Indstillinger (/settings)
**Filer:** `SettingsPage.jsx` (832 linjer)  
**Features:**
- Tab-navigation (Model, Arbejdsstil, MCP, Viden)
- Model-switch med live preview
- Personality-switch
- MCP-server konfiguration
- Config YAML editor
- Konto/Subscription tab (SaaS)
- Secrets masking

### 16. Onboarding (/onboarding)
**Filer:** `OnboardingPage.jsx` (404 linjer)  
**Features:**
- Setup-wizard for nye brugere
- Gateway-status banner
- Trin-for-trin konfiguration

### 17. Login (/login)
**Filer:** `LoginPage.jsx` (252 linjer)  
**Features:**
- Opt-in autentificering
- Session-baseret login

---

## Komponenter

### Avatar-system
| Fil | Linjer | Beskrivelse |
|-----|--------|-------------|
| HermesAvatar.jsx | 286 | Animeret avatar med 8 tilstande |
| UserAvatar.jsx | 112 | Bruger-avatar med custom override |
| sigil-active.js | — | Aktiv sigil SVG |
| sigil-default.js | — | Standard sigil SVG |
| sigil-error.js | — | Fejl sigil SVG |
| sigil-idle.js | — | Idle sigil SVG |
| sigil-offline.js | — | Offline sigil SVG |
| sigil-success.js | — | Succes sigil SVG |
| sigil-thinking.js | — | Tænkende sigil SVG |
| sigil-warning.js | — | Advarsel sigil SVG |
| svgAssets.js | — | SVG asset eksporter |

### Intelligence
| Fil | Beskrivelse |
|-----|-------------|
| ShadowMonitor.jsx | Skygge-overvågning af agent-adfærd |
| TokenGuard.jsx | Token-forbrugs overvågning |
| NeuralShift.jsx | AI-visualisering / animation |

### Layout
| Fil | Beskrivelse |
|-----|-------------|
| Sidebar.jsx | Sidebar navigation med collapsible |
| SidebarDrawer.jsx | Mobile sidebar drawer |
| SidebarNavItem.jsx | Navigation item komponent |
| SidebarRail.jsx | Minimal rail navigation |
| Topbar.jsx | Top bar med search + controls |
| sidebarData.js | Navigation data (14 items + settings) |
| CommandPalette.jsx | Cmd+K hurtig-navigation |

### Charts
| Fil | Beskrivelse |
|-----|-------------|
| CostChart.jsx | Omkostnings-graf |
| EkgChart.jsx | EKG-style latency visualisering |
| Heatmap.jsx | Heatmap visualisering |

### UI Primitiver
| Fil | Beskrivelse |
|-----|-------------|
| ActionGuardDialog.jsx | Bekræftelses-dialog til farlige handlinger |
| Card.jsx | Generisk kort-komponent |
| Chip.jsx | Tag/chip komponent |
| ErrorBoundary.jsx | Fejlhåndtering per komponent |
| Form.jsx | Formular-hjælpekomponent |
| Loaders.jsx | Loading spinners og skeletons |
| PagePrimer.jsx | Side-initialisering wrapper |
| Section.jsx | Sektion med titel og handlinger |
| Toast.jsx | Toast-notifikationer |

### Andre
| Fil | Beskrivelse |
|-----|-------------|
| AgentFleet.jsx | Oversigt over aktive agenter |
| PwaInstallPrompt.jsx | PWA installér-prompt |
| RecommendationsPanel.jsx | AI-anbefalinger |
| SessionReplay.jsx | Session-afspiller |

---

## API Backend (27 routes, 60+ endpoints)

| Route | Linjer | Endpoints | Beskrivelse |
|-------|--------|-----------|-------------|
| _lib.js | 529 | — | Delt logik (auth, DB, helpers) |
| activity.js | 39 | 1 | Aktivitets-feed |
| agent.js | 56 | 2 | Agent-status og kontrol |
| approvals.js | 37 | 2 | Godkendelseskø |
| auth.js | 17 | 1 | Autentificering |
| chat.js | 60 | 1 | Chat proxy til Hermes |
| config.js | 255 | 7 | Config CRUD + personality switch |
| control.js | 277 | 9 | Gateway kontrol (start/stop/restart) |
| cron.js | 84 | 5 | Cron job CRUD + trigger |
| gateway.js | 210 | 5 | Gateway status og logs |
| index.js | 76 | — | Route registration |
| logs.js | 174 | 2 | Log streaming (SSE) + fil-læsning |
| mcp.js | 157 | 5 | MCP server status + tool kald |
| memory.js | 68 | 2 | Memory entries + graph |
| metrics.js | 55 | 1 | Performance metrics |
| profile.js | 99 | 2 | Profil data + toggles |
| recommendations.js | 360 | 6 | AI-anbefalinger |
| search.js | 22 | 1 | Global søgning |
| sessions.js | 61 | 3 | Session liste + detaljer |
| skills.js | 292 | 5 | Skills CRUD |
| stats.js | 91 | 5 | Dashboard statistik |
| system.js | 52 | 1 | System-info |
| terminal.js | 35 | 3 | Terminal sessioner |
| webhooks.js | 82 | 2 | Webhook registrering (HMAC) |

---

## Kernel & Services

| Fil | Linjer | Beskrivelse |
|-----|--------|-------------|
| core/HermesProvider.jsx | 59 | Global state provider (gateway status, basic mode) |
| core/RootProvider.jsx | 6 | Root wrapper |
| hooks/useApi.js | 130 | API hook med caching, retry, dedup |
| hooks/useToast.js | 48 | Toast notification hook |
| services/leanStats.js | 16 | Letvægts statistik |
| services/sessionSigner.js | 8 | Session signering |
| services/shadowAnalyzer.js | 6 | Skygge-analyse |
| utils/actionGuardrails.js | 45 | Sikkerhed ved farlige handlinger |
| utils/preferences.js | 25 | Brugerpræferencer |

---

## Infrastruktur

| Komponent | Beskrivelse |
|-----------|-------------|
| `scripts/start.sh` | Start dashboard + API |
| `scripts/stop.sh` | Stop alle processer |
| `scripts/restart.sh` | Genstart |
| `scripts/status.sh` | Tjek status |
| `scripts/tunnel.sh` | Cloudflare tunnel |
| `api/server.js` | Express API server |
| `api/cors-proxy.js` | CORS proxy |
| PWA (sw.js, manifest) | Installerbar som app |

---

## LIVE vs WORK Forskelle

### Kun i LIVE (ikke i WORK)
- Avatar-system (8 sigiler + komponenter)
- PWA-installation
- AgentFleet komponent
- Webhooks API (HMAC-verified)
- Agent API
- Landing page / SaaS features
- Konto/Subscription tab

### Kun i WORK (ikke i LIVE)
- Hermes OS Core (TokenGuard, ShadowEngine, savings monitor)
- Auto-Steering (budget regulering)
- Visual Cron Editor (GUI cron builder)
- ThreadedSessionView (chat tråde)
- ChatMessageBubble med streaming controls (stop-knap)
- Profile Hub med personalization score
- framer-motion, dompurify, highlight.js, lodash, cron-parser

### Delte filer med forskellige implementationer
24 src-filer + 16 API-routes er modificeret i begge repos med markante forskelle.

---

## Statistik

| Metric | Værdi |
|--------|-------|
| Total src-linjer (frontend) | ~15.000+ |
| Total API-linjer (backend) | ~4.000+ |
| Sider | 17 |
| Komponenter | 30+ |
| API endpoints | 60+ |
| Commits (LIVE) | 89 |
| Uncommitted ændringer | 29 filer |

---

*Rapport genereret af Hermes — 9. april 2026*
