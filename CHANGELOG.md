# Changelog

All notable repository changes for Hermes Dashboard are recorded here.

## [1.2.0] — 2026-04-09

### Added (Hermes OS Core)
- **HermesProvider**: Unified state engine for AI context management.
- **TokenGuard UI**: Real-time USD savings monitor and budget mode switcher.
- **Shadow Intelligence**: Autonomous code health analyzer and background refactor engine.
- **Auto-Steering**: Automatic budget regulation (Economy/Balanced/Overclock) based on task complexity.
- **LeanCTX Backend Bridge**: Real-time integration with the Lean-CTX compression engine.

### Fixed
- Synced package.json, VERSION, and CHANGELOG to official v1.2.0.
- Resolved depth/Z-index issues for floating UI monitors.


## [1.1.0] — 2026-04-09

### Security
- Added SECURITY.md with vulnerability reporting policy
- Expanded .gitignore (certs, DB, snapshots, Python, logs, env files)
- Branch protection on master: force_push=false, deletions=false, enforce_admins=true

### Infrastructure
- Added VERSION file as single source of truth (v1.1.0)
- Dockerfile: added OCI image labels (version + source URL)
- docker-compose.yml: version tag "3.9", image: jonasabde/hermes-dashboard-api:1.1.0
- Added VERSION build arg to Docker build

### Documentation
- Complete API documentation (79 endpoints, 1,647 lines) replacing old Danish doc
- README: mixed Danish → English, badges, project metadata
- CONTRIBUTING.md: refreshed with better guidelines
- CI/CD: enhanced with lint, audit, Docker validation
- Pull request template: structured with breaking changes section
- CODEOWNERS: sectioned by area
- Dependabot: added Python ecosystem monitoring for /api

### Dependencies
- Added lint script covering src/ + api/
- Added "lint" and "docker:validate" to CI pipeline
- Dependabot monitors npm (root) + pip (/api)

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

- [docs/AUDIT.md](docs/AUDIT.md) — code quality audit report with categorized risks.

### Changed

- [vite.config.js](vite.config.js) — added `manualChunks` for chunk splitting. Bundle: 930KB → 7 separate chunks (~253KB gzip). Set `chunkSizeWarningLimit: 600` to avoid warnings.
- [docs/AUDIT.md](docs/AUDIT.md) — updated as fixes are implemented.

### Blockers Fixed

- `src/App.jsx` — Blocker 1: OnboardingPage route added (`/onboarding`).
- `src/App.jsx` — Blocker 2: DEMO_TOKEN replaced with async backend-check via `/api/auth/verify`. Only auto-login if backend confirms auth is disabled. Avoids token collision if user later sets DASHBOARD_TOKEN.
- `api/server.js` — Blocker 3: `/api/ready` now also checks hermes_binary + python and returns `missing: [...]` array with exact missing requirements.
- `api/server.js` — Removed duplicate `/api/onboarding/status` route (lines 122-140, dead code).
- `README.md` — Blocker 4: Quick Start section at top with all steps.
- `.env.example` — Blocker 5: Added HERMES_ROOT, HERMES_BIN, PYTHON with comments.

### Fixed

- `src/components/NeuralShift.jsx` — added `console.warn` to JSON-parse catch.
- `src/pages/OnboardingPage.jsx` — added `console.warn` + 8s timeout guard.
- `src/pages/OperationsPage.jsx` — added `console.warn` to JSON-parse catch.
- `src/pages/TerminalPage.jsx` — added `console.warn` to backend fetch catch.
- 5/5 Category B silent catch → now logged via `console.warn`.
- 6 files: removed 13 unused imports (FastForward, Bell, BellOff, Clock, ArrowRight, Copy, React).
- `api/server.js` — CORS whitelisted via `CORS_ORIGINS` env var.
- `api/server.js` — `/api/env` redacts all API keys to `[REDACTED]`.

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
