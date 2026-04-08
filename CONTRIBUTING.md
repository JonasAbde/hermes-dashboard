# Contributing to Hermes Dashboard

## Scope

This repository is for the Hermes Dashboard only. Do not change Hermes runtime, gateway, or agent/server behavior unless the work explicitly requires it.

---

## Development Environment

### Initial Setup

```bash
git clone https://github.com/JonasAbde/hermes-dashboard.git ~/.hermes/dashboard
cd ~/.hermes/dashboard
npm install
cd api && npm install && cd ..
```

### Running Locally

```bash
# Terminal 1: API server
node api/server.js

# Terminal 2: Frontend dev server
npm run dev
```

### Pre-commit Hook (Recommended)

Create `.git/hooks/pre-commit` to run formatting and linting before each commit:

```bash
#!/bin/bash
npm run format
npm run lint
```

Or use a tool like `husky` or `lint-staged` to automate this.

---

## Code Style

We use **Prettier** for code formatting and **ESLint** for linting.

### Running Format

```bash
# Format all files (in-place)
npm run format

# Check formatting without modifying
npm run format:check
```

### Running Lint

```bash
npm run lint
```

**Before opening a PR, always run `npm run format` and `npm run lint`.**

Prettier configuration is in `.prettierrc`; ESLint config is in `eslint.config.js`.

Key Prettier settings:
- Semi-colons: yes
- Single quotes: no
- Tab width: 2
- Print width: 100
- Trailing commas: es5

The API server (`api/server.js`, `api/routes/`, `api/_lib.js`) is excluded from Prettier to preserve its own style conventions.

---

## Commit Message Format

We use **Conventional Commits**:

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code restructure, no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build scripts, dependencies, config |
| `ci` | CI/CD pipeline changes |

### Examples

```bash
git commit -m "feat(dashboard): add session heatmap page"
git commit -m "fix(api): correct cron job date parsing"
git commit -m "docs(readme): update quick start instructions"
git commit -m "chore(deps): bump recharts to ^2.13.3"
```

### Rules
- Keep commits small and focused.
- Prefer one repo concern per commit: docs, GitHub metadata, workflow, or dashboard code.
- Use the imperative mood in the description ("add feature" not "added feature").

---

## Testing Changes

### Build Check

Always run before opening a PR that touches frontend code:

```bash
npm run build
```

### Page Count Verification

```bash
npm run check:pages
```

Confirms the docs match the current page count.

### Full Check

```bash
npm run check
```

Runs both `check:pages` and `build`.

### Tests

```bash
npm run test        # Run once
npm run test:watch  # Watch mode
```

---

## Updating Documentation

- API reference: [API.md](API.md) — update when adding/removing endpoints
- Page documentation: [docs/PAGES.md](docs/PAGES.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Development guide: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

After adding a new page, update:
1. `src/App.jsx` — add route
2. `src/pages/` — create the page component
3. `docs/PAGES.md` — document the new page
4. `scripts/check-pages.mjs` — if page count changes

---

## Security-Sensitive Changes

For changes involving authentication, environment variables, or API key handling:

1. **Do not** commit secrets or credentials.
2. Use `.env.example` as the template for required environment variables.
3. Mark security-related issues as private in the issue tracker.
4. For significant security architecture changes, open a draft PR and request review before merging.
5. The `AUTH_SECRET` environment variable must be set in production; do not default it in code.

---

## Pull Requests

- Use the PR template in [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
- Include a short summary, testing notes, and any documentation updates.
- Keep PRs free of unrelated runtime or server changes.
- Ensure all checks pass: format, lint, build, tests.

---

## GitHub Workflow

- Open issues with the issue templates in [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/).
- Use [docs/REPO_GAPS.md](docs/REPO_GAPS.md) as the current repo-hygiene checklist.
- Use the release workflow by tagging releases as `dashboard-v*`.

---

## Verification Checklist

Before opening a PR:

- [ ] `npm run format` passes
- [ ] `npm run lint` passes
- [ ] `npm run check:pages` passes
- [ ] `npm run build` succeeds
- [ ] Commit messages follow Conventional Commits
- [ ] Documentation updated if needed
- [ ] No unrelated changes included
