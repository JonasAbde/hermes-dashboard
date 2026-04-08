# Hermes Dashboard — State Ownership Boundary

This dashboard reads both Hermes-native runtime state and dashboard-owned UX state.

## Hermes-native

These are managed by Hermes itself and should be treated as runtime/system data:

- `~/.hermes/config.yaml`
- `~/.hermes/state.db`
- `~/.hermes/gateway_state.json`
- `~/.hermes/gateway.pid`
- `~/.hermes/channel_directory.json`
- `~/.hermes/sessions/`
- `~/.hermes/memories/`

The dashboard may read these files, but it must not rename, reinterpret, or present dashboard UX state as if Hermes core understands it.

## Dashboard-owned

Dashboard-only UX and shell state lives under:

- `~/.hermes/dashboard_state/profile.json`
- `~/.hermes/dashboard_state/recommendations.json`
- `~/.hermes/dashboard_state/agent-status.json`
- `~/.hermes/dashboard_state/webhook-config.json`

These files are safe dashboard extensions. They are not Hermes-native memory, agent cognition, or core runtime state.

## Legacy fallback

For compatibility with older local dashboard builds, the API may still read legacy root-level files if present:

- `~/.hermes/user_profile.json`
- `~/.hermes/recommendation_state.json`
- `~/.hermes/agent_status.json`
- `~/.hermes/webhook_config.json`

New writes must go to `~/.hermes/dashboard_state/`.

## Why this boundary matters

If dashboard-owned files live at the root and use generic names, users can easily assume Hermes CLI or Hermes core memory reads them. That is misleading.

The dashboard can personalize the operator experience, but it must label that state clearly as dashboard-owned unless Hermes upstream explicitly adopts the schema and file contract.

### See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — system overview, data layer
- [DEPLOY.md](DEPLOY.md) — file paths, environment variables
- [REPO_GAPS.md](REPO_GAPS.md) — repo setup and missing features
