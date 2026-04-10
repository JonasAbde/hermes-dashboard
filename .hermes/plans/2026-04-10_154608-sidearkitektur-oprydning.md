# Hermes Dashboard — Sidearkitektur Oprydningsplan

**Dato:** 10. april 2026 15:46  
**Baseret på:** ChatGPT produkt-analyse + verifikation af kodebase  
**Repo:** `.hermes/dashboard/`

---

## Goal

Stram sidearkitekturen op så hver side har ét krystalklart formål, fjern orphans, og reducer navigation density — uden at fjerne features eller bryde eksisterende funktionalitet.

---

## Current Context

### Side-tælling (verificeret fra kodebasen)
- **16 nav-items** i sidebaren (`sidebarData.js`)
- **21 .jsx filer** i `src/pages/` — heraf 4 er **orphan routes** (ikke i sidebar)
- **~8.600 linjer** frontend-kode fordelt på sider
- **27 API routes**, 60+ endpoints

### Orphan routes (ikke i sidebar, men i App.jsx)
| Route | Fil | Linjer | Problem |
|-------|-----|--------|---------|
| `/activity` | ActivityPage.jsx | 461 | Overlapper med Overview's aktivitets-feed |
| `/fleet` | FleetPage.jsx | 648 | Burde være i Drift |
| `/health` | HealthPage.jsx | 450 | Burde være i Drift |
| `/onboarding` | OnboardingPage.jsx | 407 | Burde være modal/wizard |

### Basic mode
Skjuler 9 sider: `/memory`, `/skills`, `/logs`, `/operations`, `/terminal`, `/settings`, `/cost`, `/mcp`, `/github`. Basic mode viser kun 7 items + Indstillinger.

### Eksisterende UX arbejde
`docs/UX_PATCH_1.3.0.md` indeholder allerede 22 rettelser (8 kritisk, 9 høj, 5 medium) fordelt på ChatPage og OverviewPage. Disse er IKKE implementeret endnu.

---

## Proposed Approach

Tre faser: ryd op → stram → polish. Ingen features fjernes — kun omorganiseres.

### Fase 1: Merge orphan routes (ingen breaking changes)

**1.1 Merge HealthPage → OperationsPage (Drift)**
- HealthPage (450 linjer) bliver en fane/sektion i OperationsPage
- OperationsPage får tabs: "Services" | "Health" | "Fleet"
- Fjern `/health` route fra App.jsx og sidebarData

**1.2 Merge FleetPage → OperationsPage**
- FleetPage (648 linjer) bliver "Fleet" fanen i OperationsPage
- Samme tab-struktur som ovenfor
- Fjern `/fleet` route fra App.jsx og sidebarData

**1.3 Merge ActivityPage → OverviewPage**
- ActivityPage (461 linjer) indhold integreres i OverviewPage som nederste sektion
- OverviewPage har allerede aktivitets-relaterede elementer
- Fjern `/activity` route fra App.jsx og CommandPalette NAV_ITEMS

**1.4 Onboarding → modal/wizard**
- OnboardingPage (407 linjer) konverteres til en modal der trigges ved første login eller via Indstillinger
- Behold koden men fjern som top-level route
- Fjern `/onboarding` fra App.jsx

**Resultat Fase 1:** 21 → 17 sider, 4 orphan routes elimineret, Drift bliver "mission control" med 3 faner.

### Fase 2: Profil vs Indstillinger konsolidering

**2.1 Audit af overlap**
- Gennemgå Profil (720 linjer) og Indstillinger (841 linjer) side om side
- Identificer præcist hvilke sektioner der overlapper
- Expected overlap: præferencer, tema, sprog, notification settings

**2.2 Konsolider til én side med faner**
- `/profile` får tabs: "Profil" | "Præferencer" | "Workspace"
- Profil-tab: avatar, navn, email, roller
- Præferencer-tab: tema, sprog, basic mode toggle, notifications
- Workspace-tab: API keys, personality switch, integrationer
- Fjern `/settings` som selvstændig route — omdiriger til `/profile`
- Opdater sidebarData: behold kun "Profil" item, fjern Indstillinger

**Resultat Fase 2:** 17 → 16 sider, Profil/Indstillinger overlap elimineret.

### Fase 3: UX Patch implementering (fra UX_PATCH_1.3.0.md)

**3.1 P0 — Kritiske rettelser (ChatPage + OverviewPage)**
- Budget alarm i OverviewPage
- HIGH BURST forklaring (tooltip) i NeuralRhythm
- "Næste handlinger" kontrast-fix
- "2/3 live" → vis hvilken service er nede
- Chat empty state: "Ingen sessioner i dag" + "Inspicér agent"
- Suggestion cards dynamiske (baseret på reel status)
- Input-felt kontekst (agent-badge i chat)
- Platform/kilo badges med tooltip/hover

**3.2 P1 — Høje rettelser**
- Chat venstre panel: auto-collapse når tomt
- Agent status-indikator i chat-header (Lytter/Tænker/Søger/Svarer)
- Keyboard shortcut hints: øg synlighed
- Chat-historik søgning (Ctrl+F)
- MCP detalje i Overview (vis hvilken der er nede)
- Metric cards med trend-data (vs. i går)
- Agent "IDLE" → vis "Sidst aktiv: [tid]"
- Hero-sektion omorganisering (fjern spildt plads)
- Neural Rhythm grid: tydelig hover/cursor feedback

**3.3 P2 — Medium rettelser**
- Fjern suggestion pills redundans
- Clear-knap med confirmation dialog
- Topbar deduplication (kilo-auto/free vises kun ét sted)
- Præcise timestamps i stedet for "Ingen nylige sessioner"
- Quick actions vægtning (destruktiv vs. passiv)

**Resultat Fase 3:** 22 UX-rettelser implementeret, ingen arkitektur-ændringer.

---

## Files Likely to Change

| Fil | Ændring | Fase |
|-----|---------|------|
| `src/App.jsx` | Fjern /health, /fleet, /activity, /onboarding routes; tilføj redirect /settings → /profile | 1, 2 |
| `src/components/layout/sidebarData.js` | Fjern orphan items; konsolider Profil/Indstillinger | 1, 2 |
| `src/pages/OperationsPage.jsx` | Tilføj tabs: Services | Health | Fleet | 1 |
| `src/pages/OverviewPage.jsx` | Merge ActivityPage indhold + UX patches | 1, 3 |
| `src/pages/ProfilePage.jsx` | Udvid med Indstillinger indhold (tabs) | 2 |
| `src/pages/SettingsPage.jsx` | Indhold flyttes til ProfilePage | 2 |
| `src/pages/ChatPage.jsx` | UX patches (empty state, agent status, search, collapse) | 3 |
| `src/components/CommandPalette.jsx` | Fjern orphan NAV_ITEMS | 1 |
| `src/pages/HealthPage.jsx` | Arkiveres/slettes efter merge | 1 |
| `src/pages/FleetPage.jsx` | Arkiveres/slettes efter merge | 1 |
| `src/pages/ActivityPage.jsx` | Arkiveres/slettes efter merge | 1 |
| `src/pages/OnboardingPage.jsx` | Konverteres til modal | 1 |

---

## Tests / Validation

1. **Build:** `npm run build` — skal være grønt efter hver fase
2. **Route verification:**
   - `curl http://localhost:5175/` → skal vise Overblik
   - `curl http://localhost:5175/health` → skal redirecte til /operations (efter fase 1)
   - `curl http://localhost:5175/settings` → skal redirecte til /profile (efter fase 2)
3. **Basic mode:** Verificer at basic mode stadig virker efter route-ændringer
4. **Command Palette:** `Cmd+K` skal ikke vise fjernede ruter
5. **Visual verifikation:** Autentificerede screenshots af hver berørt side
6. **API routes:** Ingen API-routes ændres — kun frontend routing

---

## Risks & Tradeoffs

| Risiko | Sandsynlighed | Impact | Mitigation |
|--------|--------------|--------|------------|
| OperationsPage bliver for tung med 3 tabs | Medium | Medium | Brug lazy-loading af tab-indhold |
| Profil/Indstillinger merge bryder eksisterende config | Medium | Høj | Gem begge filer som backup; test config CRUD endpoints |
| ActivityPage indhold passer ikke i Overview | Lav | Medium | Vurder konkret indhold før merge — kan kræve redesign |
| UX patches introducerer regressions | Medium | Medium | Commit før hver batch; test build + screenshots |
| Basic mode navigation brydes | Lav | Høj | Verificer getVisibleNavItems() efter hver ændring |

---

## Besluttede Open Questions (af Hermes, 10. apr 15:50)

1. **Onboarding:** Auto-trigger ved første login (detect via `localStorage` flag), vis ÉN gang. Derefter kun tilgængelig manuelt via Indstillinger → "Vis introduktion". Du vil ikke babysittes — onboarding er for nye brugere, ikke for dig.

2. **OperationsPage tabs:** URL-baserede (`/operations?tab=health`). Kan bookmarkes, back/forward virker mellem tabs, og det er standard web-mønster. State-only er lazy men bryder UX ved refresh.

3. **Profil + Indstillinger:** Tabs i én side (`/profile`). Mindre navigation, samme funktionalitet. Profil-tab (hvem er jeg), Præferencer-tab (tema/sprog/basic mode), Workspace-tab (config/API keys/personality). `/settings` redirecter til `/profile`.

4. **Neural Rhythm:** Behold på Overblik som status-indikator (du skal kunne se autonomi-niveau uden at klikke), men tilføj "Redigér" link der fører til Drift for kontrol. ChatGPT har ret i at kontrol bør i Drift — men status hører på Overblik.

---

## Implementation Order

```
Fase 1 (orphan cleanup) → commit → build → screenshot
Fase 2 (profil/settings) → commit → build → screenshot  
Fase 3 (UX patches P0) → commit → build → screenshot
Fase 3 (UX patches P1) → commit → build → screenshot
Fase 3 (UX patches P2) → commit → build → screenshot
```

Hver fase er uafhængig og kan rulles tilbage individuelt.
