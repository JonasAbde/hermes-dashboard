# Contributing

## Scope

This repository is for the Hermes Dashboard only. Do not change Hermes runtime, gateway, or agent/server behavior unless the work explicitly requires it.

## Commits

- Use Conventional Commits where possible: `feat(scope):`, `fix(scope):`, `chore(scope):`, `docs(scope):`.
- Keep commits small and focused.
- Prefer one repo concern per commit: docs, GitHub metadata, workflow, or dashboard code.

## Pull Requests

- Use the PR template in [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
- Include a short summary, testing notes, and any documentation updates.
- Keep PRs free of unrelated runtime or server changes.

## GitHub Workflow

- Open issues with the issue templates in [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/).
- Use [docs/REPO_GAPS.md](docs/REPO_GAPS.md) as the current repo-hygiene checklist.
- Use the release workflow by tagging releases as `dashboard-v*`.

## Verification

- Run `npm run check:pages` to confirm the docs match the current page count.
- Run `npm run build` before opening a PR that touches frontend code.
