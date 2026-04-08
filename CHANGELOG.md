# Changelog

All notable repository changes for Hermes Dashboard are recorded here.

## [1.0.0] — 2026-04-08

### Added

- Hermes Dashboard — public v1.0.0 release
- Web-based real-time monitoring of Hermes Agent sessions, gateway, and cron
- Session management with FTS5 full-text search and SQLite persistence
- Operations dashboard with system metrics, memory, uptime, and disk I/O
- Terminal integration with WebSocket streaming and persistent sessions
- Onboarding wizard with system requirements detection and setup guidance
- Command palette (Cmd+K) for quick navigation across all pages
- NeuralShift AI-powered feature with model cost tracking
- Session replay with timeline scrubbing and tool call inspection
- Docker Compose deployment with health checks and logging
- `.env.example` for easy configuration of ports and CORS origins
- Auto-login when `AUTH_SECRET` is unset (development mode)
- MIT License

## [Unreleased]

### Added

- [docs/AUDIT.md](docs/AUDIT.md) — code quality audit rapport med categoriserede risici.

### Changed

- [vite.config.js](vite.config.js) — tilføjet `manualChunks` for chunk splitting. Bundle: 930KB → 7 separate chunks (~253KB gzip). Sat `chunkSizeWarningLimit: 600` for at undgå advarsler.
- [docs/AUDIT.md](docs/AUDIT.md) — opdateret løbende som fixes implementeres.

### Blockers Fixed

- `src/App.jsx` — Blokér 1: OnboardingPage route tilføjet (`/onboarding`).
- `src/App.jsx` — Blokér 2: DEMO_TOKEN erstattet med async backend-check via `/api/auth/verify`. Kun auto-login hvis backend bekræfter at auth er slået fra. Undgår token-kollision hvis bruger bagefter sætter DASHBOARD_TOKEN.
- `api/server.js` — Blokér 3: `/api/ready` tjekker nu også hermes_binary + python + returnerer `missing: [...]` array med præcist mangler.
- `api/server.js` — Fjernet duplicate `/api/onboarding/status` route (linje 122-140, dead code).
- `README.md` — Blokér 4: Quick Start sektion øverst med alle steps.
- `.env.example` — Blokér 5: Tilføjet HERMES_ROOT, HERMES_BIN, PYTHON med kommentarer.

### Fixed

- `src/components/NeuralShift.jsx` — tilføjet `console.warn` til JSON-parse catch.
- `src/pages/OnboardingPage.jsx` — tilføjet `console.warn` + 8s timeout guard.
- `src/pages/OperationsPage.jsx` — tilføjet `console.warn` til JSON-parse catch.
- `src/pages/TerminalPage.jsx` — tilføjet `console.warn` til backend fetch catch.
- 5/5 Kategori B silent catch → nu logget via `console.warn`.
- 6 filer: fjernet 13 ubrugte imports (FastForward, Bell, BellOff, Clock, ArrowRight, Copy, React).
- `api/server.js` — CORS whitelisted via `CORS_ORIGINS` env var.
- `api/server.js` — `/api/env` redacter alle API keys til `[REDACTED]`.

## [2026-04-08]

### Added

- Repository docs index in [docs/README.md](docs/README.md).
- Repository gap analysis in [docs/REPO_GAPS.md](docs/REPO_GAPS.md).
- GitHub PR template in [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
- GitHub issue templates in [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/).
- Minimal CI workflow in [.github/workflows/ci.yml](.github/workflows/ci.yml).
- Release workflow in [.github/workflows/release.yml](.github/workflows/release.yml).
- [.env.example](.env.example) for dashboard proxy configuration.
- CODEOWNERS in [.github/CODEOWNERS](.github/CODEOWNERS).
- Dependabot config in [.github/dependabot.yml](.github/dependabot.yml).
- Commit guidance in [CONTRIBUTING.md](CONTRIBUTING.md).
- PR labeler in [.github/labeler.yml](.github/labeler.yml).
- Stale automation in [.github/stale.yml](.github/stale.yml).
- GitHub feature overview in [docs/GITHUB.md](docs/GITHUB.md).

### Changed

- [README.md](README.md), [docs/README.md](docs/README.md), [docs/PAGES.md](docs/PAGES.md), and [docs/REPO_GAPS.md](docs/REPO_GAPS.md) were updated to match the current dashboard routes, page count, and repository setup.

### Notes

- These updates are repo-only and do not change Hermes runtime, gateway, or agent/server behavior.
