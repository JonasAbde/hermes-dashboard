# GitHub Features

This repo uses the GitHub features that are most relevant for a small product repo.

## What is enabled

- PR templates in [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md).
- Issue templates in [.github/ISSUE_TEMPLATE/](../.github/ISSUE_TEMPLATE/).
- CODEOWNERS in [.github/CODEOWNERS](../.github/CODEOWNERS).
- Dependabot in [.github/dependabot.yml](../.github/dependabot.yml).
- PR auto-labeling in [.github/labeler.yml](../.github/labeler.yml).
- Stale automation in [.github/stale.yml](../.github/stale.yml).
- CI in [.github/workflows/ci.yml](../.github/workflows/ci.yml).
- Release workflow in [.github/workflows/release.yml](../.github/workflows/release.yml).

## Commit and release flow

- Use Conventional Commits in [CONTRIBUTING.md](../CONTRIBUTING.md).
- Tag releases as `dashboard-v*` to trigger the release workflow.
- Keep changelog entries in [CHANGELOG.md](../CHANGELOG.md).

## What we intentionally keep out

- No workflows that mutate Hermes runtime or shared state.
- No GitHub automation that starts or stops services.
