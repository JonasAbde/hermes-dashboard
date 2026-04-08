# Hermes Dashboard Repo Gaps

This note compares the dashboard repo with a more fully-equipped GitHub repo.

## Scope

This report is limited to repo and GitHub-related artifacts. It does not change Hermes runtime, gateway, agent processes, or server configuration.

## What the dashboard already has

- A git repo root at [dashboard](../).
- A minimal CI workflow at [.github/workflows/ci.yml](../.github/workflows/ci.yml).
- A docs structure at [docs/](.).
- A [.env.example](../.env.example) for frontend proxy configuration.
- A PR template at [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md).
- Issue templates at [.github/ISSUE_TEMPLATE/](../.github/ISSUE_TEMPLATE/).
- CODEOWNERS at [.github/CODEOWNERS](../.github/CODEOWNERS).
- Dependabot at [.github/dependabot.yml](../.github/dependabot.yml).
- PR labeler at [.github/labeler.yml](../.github/labeler.yml).
- Stale automation at [.github/stale.yml](../.github/stale.yml).

## What is still missing

- A full lint/test dependency stack if we want proper ESLint-driven validation of JSX/React files.
- More up-to-date page documentation if new routes are added later.
- Potential branch protection and required checks at the GitHub level if the repo needs to be strictly enforced.

## What we should intentionally avoid

- No changes to Hermes runtime, gateway, or agent processes just to make the dashboard more repo-complete.
- No automation that starts or stops services as a side effect of CI or repo documentation.
- No scripts that write to shared state under `~/.hermes/` without clear ownership.

## Prioritized next steps

1. Keep docs in sync with pages and routes.
2. Use release workflow and commit conventions consistently.
3. Add ESLint/Prettier if the dashboard gets more frontend-active development.
