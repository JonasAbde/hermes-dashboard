# Brand & Identity Audit — Hermes Dashboard

**Date:** 2026-04-08
**Status:** Implementation Plan

---

## 1. Current State Summary

### Brand Components

| Component | Type | Usage | Status |
|---|---|---|---|
| `HermesCharacter` | React component | Sidebar, Chat, Memory, Avatars | ✅ Active — primary mascot |
| `AgentAvatar` | React wrapper | AgentFleet | ✅ Active |
| `UserAvatar` | React wrapper | — | ⚠️ Exists but unused |
| `sigilAssets-*.js` (8 files) | Static SVG strings | Exported only | ❌ Dead exports |
| `SigilFull/SigilMark/SigilWordmark` | Referenced in index.js | — | ❌ Don't exist as components |
| `statusDot.js` | Utility | HermesCharacter | ✅ Active |
| `favicon.svg` | Static file | Browser tab | ✅ Active |
| `og-image.svg` | Static file | Social previews | ✅ Active |

### Color Definitions (scattered)

| Location | Colors | Notes |
|---|---|---|
| `HermesCharacter.jsx` COLORS object | `#00b478`, `#00d490`, `#4a80c8`, `#6ba3e0`, `#e09040`, `#e05f40`, etc. | JS constants |
| `index.css` @keyframes | Referenced via glow/drop-shadow | CSS animations |
| `sigilAssets-*.js` | `#00b478`, `#e05f40`, `#4a80c8` | Hard-coded in SVG strings |
| `favicon.svg` | `#e05f40`, `#4a80c8`, `#00b478` | Static file |
| `og-image.svg` | `#e05f40`, `#4a80c8`, `#00b478` | Static file |
| Tailwind config | `green`, `blue`, `amber`, `rust` | Tailwind utilities |

### Issues Found

1. **Dead exports:** `sigilAssets-*.js` files are exported but never imported by any consumer
2. **Duplicate CSS keyframes:** Lines 132-163 duplicated at lines 219-246 in `index.css`
3. **Scattered colors:** Brand colors defined in 5+ places with no single source of truth
4. **UserAvatar.jsx:** Exists but unused — duplicates AgentAvatar logic
5. **SettingsPage.jsx:** 865 lines dead code — route redirects to `/profile`
6. **Missing components:** SliderSVG, NudgeCallout, RouteGuard, LiveToggle, AutocompleteSearch, CostTierBadge, GateViz, MarkdownRenderer, ModelSelector, ModelChip — all referenced in analysis but don't exist

### Navigation (verified)

14 sidebar items in 3 groups:
```
Top:        Overblik | Chat | Sessioner
Ugentligt:  Hukommelse | Planlagt | Skills | Godkendelser | Omkostninger
Avanceret:  Logs | Drift | Terminal | MCP Tools | GitHub
Bottom:     Profil
```

Orphan routes already redirect:
- `/activity` → `/`
- `/fleet` → `/operations?tab=fleet`
- `/health` → `/operations?tab=health`
- `/settings` → `/profile`

---

## 2. Implementation Plan

### Phase 1: Brand Constants (single source of truth)

**Create `src/constants/brandColors.js`**
- Export all brand colors as JS constants
- Map to CSS variable names
- HermesCharacter imports from here instead of local COLORS object

### Phase 2: CSS Cleanup

**Fix `src/index.css`**
- Remove duplicate @keyframes block (lines 219-246)
- Add CSS custom properties for brand colors
- Keep sigil hover/badge styles

### Phase 3: Dead Code Removal

**Delete:**
- `src/pages/SettingsPage.jsx` (865 lines, route redirects to /profile)
- `src/components/avatar/UserAvatar.jsx` (unused, duplicates AgentAvatar)
- `src/components/avatar/sigilAssets.js` (barrel file for dead exports)
- `src/components/avatar/sigilAssets-default.js` (dead export)
- `src/components/avatar/sigilAssets-thinking.js` (dead export)
- `src/components/avatar/sigilAssets-active.js` (dead export)
- `src/components/avatar/sigilAssets-idle.js` (dead export)
- `src/components/avatar/sigilAssets-success.js` (dead export)
- `src/components/avatar/sigilAssets-warning.js` (dead export)
- `src/components/avatar/sigilAssets-offline.js` (dead export)
- `src/components/avatar/sigilAssets-error.js` (dead export)

**Update `src/components/avatar/index.js`:**
- Remove dead sigil exports
- Remove UserAvatar export (or keep as re-export of AgentAvatar for backward compat)

### Phase 4: Import Fixes

**Verify and fix all imports across:**
- `SidebarRail.jsx` → imports from `../avatar/HermesCharacter` (should use barrel)
- `SidebarDrawer.jsx` → imports from `../avatar/HermesCharacter` (should use barrel)
- `NeuralShift.jsx` → imports from `./avatar` (correct)
- `MemoryPage.jsx` → imports from `../components/avatar` (correct)
- `AgentFleet.jsx` → imports from `../avatar` (correct)

### Phase 5: Component Consolidation

**AgentAvatar.jsx:**
- Keep as primary avatar wrapper
- Verify it properly wraps HermesCharacter
- Add any missing props from UserAvatar

**HermesCharacter.jsx:**
- Import colors from `brandColors.js` instead of local COLORS object
- Keep all animation logic
- Remove `default export` (use named exports only, consistent with barrel)

---

## 3. Color Reference (canonical)

```
Primary Green:  #00b478  (--hermes-green / green)
Light Green:    #00d490  (--hermes-green-light)
Blue:           #4a80c8  (--hermes-blue / blue)
Light Blue:     #6ba3e0  (--hermes-blue-light)
Amber:          #e09040  (--hermes-amber / amber)
Rust/Red:       #e05f40  (--hermes-rust / rust)
Dark Surface:   #0d0f17  (--hermes-bg)
Darker:         #0a0b10  (--hermes-bg-deep)
```
