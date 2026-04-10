# Hermes Dashboard — UX Rettelse Specifikation

**Dato:** 10. april 2026  
**Version:** 1.3.0 (UX Patch)  
**Baseret på:** Jonas's UX-analyse af chat-siden og overblik-siden  
**Repo:** `.hermes/dashboard/`

---

## Oversigt

Denne spec retter 22 UX-problemer identificeret i Jonas's analyse:
- **🔴 Kritisk:** 8 problemer der kræver øjeblikkelig handling
- **🟠 Høj:** 9 problemer der forringer brugeroplevelsen signifikant
- **🟡 Medium:** 5 problemer der bør rettes når tid tillader

---

# CHAT-SIDE (/chat)

## 🔴 KRITISKE RETTELSER

### 1. Empty State — Forkert CTA
**Problem:** "No conversations yet" + "Start a chat" — en owner starter ikke samtaler, de inspicerer agenten.

**Løsning:**
```jsx
// Erstat ChatPage.jsx ~linje 89-102 (empty state)
// Ny tekst:
// "Ingen sessioner i dag"
// Undertekst: "Hermes har ikke haft samtaler siden [sidste aktivitet]"
// CTA: "Inspicér agent" (ikke "Start a chat")
```

**Filer:** `src/pages/ChatPage.jsx`

**Prioritet:** P0 — implementér først

---

### 2. Suggestion Cards — Gør Dynamiske
**Problem:** "Runtime health", "Gateway recovery" etc. er statiske. Burde reagere på reel tilstand.

**Løsning:**
- Hvis gateway har fejlet → "Gateway recovery" får amber/rust baggrund + badge: "⚠ Fejlet for 2t siden"
- Hvis budget overskredet → "Runtime health" får advarsels-badge
- Tilføj dynamisk status-check via `/api/health` endpoint før render

**Logic:**
```jsx
const getDynamicSuggestion = (card) => {
  const health = useHealthStatus(); // ny hook
  if (card.id === 'gateway-recovery' && health.gatewayFailing) {
    return { highlight: 'amber', badge: '⚠ Fejlet nylig' };
  }
  if (card.id === 'runtime-health' && health.budgetOverspent) {
    return { badge: '⚠ Over budget' };
  }
  return null;
};
```

**Filer:** `src/pages/ChatPage.jsx` (SuggestionCards component)

---

### 3. Input-Felt Kontekst
**Problem:** Placeholder "Ask about runtime health..." giver ingen kontekst om hvem man taler med.

**Løsning:**
- Tilføj tydelig agent-badge i input-sektion: "💬 Chat med Hermes"
- Forbedr kilo-badge: større, med tooltip "kilo-auto/free model"
- Tilføj sub-header over input: "Hermes Operator — direkte kommunikation"

**Filer:** `src/pages/ChatPage.jsx` (InputSection component)

---

### 4. "3 platforms" og "kilo-auto/free" — Ingen Affordance
**Problem:** Disse ser ud som badges men er de klikbare? Ingen hover-state, ingen tooltip.

**Løsning:**
- Tilføj cursor-pointer + hover-state (lighten 10%)
- Tilføj tooltip med forklarende tekst:
  - "3 platforms" → "Tilsluttede: Telegram, Discord, Slack"
  - "kilo-auto/free" → "Aktiv model: auto-select mellem free tier-modeller"
- Alternativt: Lav dem til rent informativa badges uden interaktion (fjern hover)

**Filer:** `src/components/TopBar.jsx` eller tilsvarende

---

## 🟠 HØJE RETTELSER

### 5. Venstre Panel — Collapsible
**Problem:** Tom venstre panel tager 23% bredde for nul værdi.

**Løsning:**
- Auto-collapse til mini-rail (40px) når tom
- Udvid ved hover/klik på "Chats" header
- Tilføj smooth transition (200ms ease)

**Filer:** `src/pages/ChatPage.jsx` (Sidebar component)

---

### 6. Agent Status i Chat-Kontekst
**Problem:** Chat-siden viser ikke om Hermes lytter, processer eller er idle.

**Løsning:**
- Tilføj status-indikator under agent-badge i chat-header:
  - "Lytter..." (når tom input)
  - "Tænker..." (under processing)
  - "Søger..." (ved web/search)
  - "Svarer..." (genererer)
- Vis med subtle animation (pulsing dot)

**Filer:** `src/pages/ChatPage.jsx` (ChatHeader component)

---

### 7. Keyboard Shortcut-Hints — For Diskret
**Problem:** "Enter send · Shift+Enter newline..." er ~15% opacity og næsten usynlig.

**Løsning:**
- Øg opacity til 40% (0.4)
- Tilføj baggrund: `bg-gray-800/50` 
- Padding: `px-3 py-1`
- Rounded: `rounded-md`

**Filer:** `src/pages/ChatPage.jsx` (InputFooter component)

---

### 8. Chat-Historik Søgning
**Problem:** Ingen in-chat søgning — kan ikke finde hvad Hermes sagde for 3 dage siden.

**Løsning:**
- Tilføj søgeikon i chat-header (lup)
- Åbner modal med full-text search i session messages
- Viser resultater med kontekst + klikbar link til specifik besked
- Keyboard shortcut: `Ctrl+F` i chat-view

**Filer:** `src/pages/ChatPage.jsx`, `src/services/searchService.js` (ny)

---

## 🟡 MEDIUM RETTELSER

### 9. Suggestion Pills vs Cards — Redundant
**Problem:** "Memory inspection · CLI debugging..." overlapper med cards ovenfor.

**Løsning:**
- Fjern pills-sektionen helt, eller
- Gør dem til hurtig-actions (ikke suggestions) — kortere, uden ikoner
- Alternativt: Lav cards til deep-links til relevante sider

**Filer:** `src/pages/ChatPage.jsx`

---

### 10. Clear-Knap — Ingen Confirmation
**Problem:** "Clear" kan slette alle samtaler uden dialog.

**Løsning:**
- Tilføj confirm-dialog: "Slet alle samtaler? Dette kan ikke fortrydes."
- Alternativt: Tilføj undo-buffer (5 min) — soft delete

**Filer:** `src/components/Sidebar.jsx` eller tilsvarende

---

---

# OVERBLIK-SIDE (/)

## 🔴 KRITISKE RETTELSER

### 1. Budget Alarm — Manglende
**Problem:** $33.06 med budget $25.00 (32% over) — ingen rød alert.

**Løsning:**
```jsx
// I OverviewPage.jsx — CostCard component
const isOverBudget = currentCost > budgetLimit;
const overPercentage = ((currentCost - budgetLimit) / budgetLimit * 100).toFixed(0);

// Vis:
{isOverBudget && (
  <div className="bg-red-500/20 border border-red-500 text-red-400 px-3 py-1 rounded-full text-sm">
    ⚠ {overPercentage}% over budget
  </div>
)}
```

**Filer:** `src/pages/OverviewPage.jsx` (CostCard, MetricCards)

---

### 2. HIGH BURST — Ingen Forklaring
**Problem:** Neural rhythm "HIGH BURST" er aktiv men owner ved ikke hvad det betyder.

**Løsning:**
- Tilføj hover-tooltip på NeuralRhythm tiles:
  - "HIGH BURST: Agenten handler proaktivt med høj autonomi. Øger token-forbrug."
- Tilføj badge under aktiv tilstand: "🟡 Øget aktivitet · +~40% tokens/t"
- Tilføj link til dokumentation

**Filer:** `src/pages/OverviewPage.jsx` (NeuralRhythm component)

---

### 3. "Næste Handlinger" — Ulæselig
**Problem:** Teksten under ⚠ Næste handlinger er næsten usynlig (lav kontrast).

**Løsning:**
- Øg kontrast: `text-gray-400` → `text-gray-300`
- Tilføj baggrund: `bg-gray-900/50`
- Padding: `p-4`
- Skriftstørrelse: `text-sm` → `text-base`
- Tilføj border: `border-l-2 border-orange-500` (accent)

**Filer:** `src/pages/OverviewPage.jsx` (ActionSuggestions component)

---

### 4. "2/3 live" — Hvilken Service er Nede?
**Problem:** Ved at én service er nede, men ingen indikation af hvilken eller konsekvens.

**Løsning:**
- Udvid badge til: "2/3 live · ⚠ [service-name] nede"
- Tilføj dropdown/expand med liste over services og deres status
- Vis konsekvens: "Gateway nede — chat utilgængelig" etc.

**Filer:** `src/pages/OverviewPage.jsx` (StatusBar component)

---

## 🟠 HØJE RETTELSER

### 5. MCP 5/6 — Hvilken er Nede?
**Problem:** Ved at 5/6 MCP kører men ikke hvilken der mangler.

**Løsning:**
- Udvid til: "5/6 kører · ⚠ [navn] stopper"
- Tooltip med alle MCPs og status
- Hurtig-repair link ved siden af

**Filer:** `src/pages/OverviewPage.jsx` (MCPCard)

---

### 6. Metric Cards — Trend-Data Manglende
**Problem:** "233 sessioner i dag" — men er det +12% eller -8% fra i går?

**Løsning:**
```jsx
// Tilføj trend-badge ved hver metric
<div className="flex items-center gap-2">
  <span className="text-2xl font-bold text-coral-500">233</span>
  <span className="text-green-400 text-sm">↑ +12%</span>
  <span className="text-gray-500 text-xs">vs. i går</span>
</div>
```

**Filer:** `src/pages/OverviewPage.jsx` (MetricCards)

---

### 7. Agent "IDLE" — Hvornår Sidst Aktiv?
**Problem:** "IDLE" siger inaktiv men ikke hvornår de sidst var aktive.

**Løsning:**
```jsx
// AgentCard component
<span className="text-gray-400 text-sm">
  IDLE · Sidst aktiv: 23:44
</span>
```

**Filer:** `src/pages/OverviewPage.jsx` (AgentFleet component)

---

### 8. Hero-Sektion — Spildt Plads
**Problem:** "Åbn logs" og "Indstillinger" i stort tomt areal.

**Løsning:**
- Flyt vigtigste metrics op i hero (der hvor knapperne er nu)
- Fjern tom plads — følg "most important first" princippet
- Flyt sekundære actions til bunden eller en dropdown

**Filer:** `src/pages/OverviewPage.jsx` (HeroSection)

---

### 9. Neural Rhythm Grid — Touch Feedback
**Problem:** Tiles ser klikbare ud men er det kontroller eller status?

**Løsning:**
- Tilføj cursor-pointer på klikbare tiles
- Tilføj hover-state (scale 1.02, border highlight)
- Tilføj tooltip: "Klik for at skifte tilstand" eller "Status-indikator"
- Hvis ikke klikbare → føj `cursor-default` + remove hover

**Filer:** `src/pages/OverviewPage.jsx` (NeuralRhythmGrid)

---

## 🟡 MEDIUM RETTELSER

### 10. Topbar Duplikerer Information
**Problem:** kilo-auto/free vises i topbar + sidebar footer + implicit i metrics.

**Løsning:**
- Fjern fra sidebar footer
- Behold kun i topbar + én gang i metrics som model-badge
- Reducer gentagelse → øg signal-to-noise

**Filer:** `src/App.jsx`, `src/components/TopBar.jsx`

---

### 11. "Seneste session: Ingen nylige sessioner"
**Problem:** Tom info burde give præcis tidspunkt.

**Løsning:**
- Ændr til: "Sidst aktiv: 2026-04-09 23:44" (præcis timestamp)
- Eller: "Aldrig haft sessioner" hvis aldrig aktiv

**Filer:** `src/pages/OverviewPage.jsx` (SessionStatus)

---

### 12. Hurtige Handlinger — Visuel Vægt
**Problem:** "Genstart gateway" (destruktiv) og "Se logs" (passiv) har samme vægt.

**Løsning:**
```jsx
// Genstart gateway: orange border, advarsels-ikon
<button className="border border-orange-500 text-orange-400 hover:bg-orange-500/10...">

// Se logs: grå, neutral
<button className="bg-gray-800 text-gray-400 hover:bg-gray-700...">
```

**Filer:** `src/pages/OverviewPage.jsx` (QuickActions)

---

## IMPLEMENTATIONSPLAN

### Fase 1: Kritisk (P0)
1. Budget alarm — OverviewPage.jsx
2. HIGH BURST forklaring — OverviewPage.jsx
3. Næste handlinger læselighed — OverviewPage.jsx
4. 2/3 live detalje — OverviewPage.jsx
5. Empty state CTA — ChatPage.jsx
6. Suggestion cards dynamisk — ChatPage.jsx
7. Input kontekst — ChatPage.jsx
8. Platform/kilo affordance — TopBar.jsx

### Fase 2: Høj (P1)
1. Venstre panel collapsible — ChatPage.jsx
2. Agent status i chat — ChatPage.jsx
3. Keyboard hints — ChatPage.jsx
4. Chat-historik søgning — ChatPage.jsx
5. MCP detalje — OverviewPage.jsx
6. Metric trends — OverviewPage.jsx
7. Agent last active — OverviewPage.jsx
8. Hero omorganisering — OverviewPage.jsx
9. Neural rhythm feedback — OverviewPage.jsx

### Fase 3: Medium (P2)
1. Suggestion pills fjernelse — ChatPage.jsx
2. Clear confirmation — Sidebar.jsx
3. Topbar deduplication — App.jsx
4. Præcise timestamps — OverviewPage.jsx
5. Quick actions vægtning — OverviewPage.jsx

---

## FILOVERSIGT

| Fil | Ændringer |
|-----|-----------|
| `src/pages/ChatPage.jsx` | 8 rettelser |
| `src/pages/OverviewPage.jsx` | 10 rettelser |
| `src/components/TopBar.jsx` | 1 rettelse |
| `src/components/Sidebar.jsx` | 1 rettelse |

**Total: 20 rettelser fordelt på 4 filer**

---

*Spec genereret fra Jonas's UX-analyse. Prioritér kritisk før høj før medium.*