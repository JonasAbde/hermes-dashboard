# Dashboard Auto Reload

The local dashboard now supports automatic reload in both layers:

- Web UI: `hermes-dashboard-web.service` runs Vite dev server on port `5175`, so React/UI edits hot-reload automatically.
- API: `hermes-dashboard-api.service` should run Node in watch mode against the whole `api/` directory, so changes to `server.js`, route files, and `query.py` trigger automatic restart.

Recommended `systemd --user` API unit:

```ini
[Unit]
Description=Hermes Dashboard API
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/empir/.hermes/dashboard/api
ExecStartPre=-/bin/bash -c 'fuser -k 5174/tcp 2>/dev/null; for i in $(seq 1 10); do ss -tlnp | grep -q ":5174" || break; sleep 1; done'
ExecStart=/home/empir/.nvm/versions/node/v22.22.2/bin/node --watch-path=/home/empir/.hermes/dashboard/api --watch-preserve-output server.js
Restart=on-failure
RestartSec=5
Environment=HOME=/home/empir
Environment=PATH=/home/empir/.local/bin:/home/empir/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
```

Useful commands:

```bash
systemctl --user daemon-reload
systemctl --user restart hermes-dashboard-api
systemctl --user restart hermes-dashboard-web
journalctl --user -u hermes-dashboard-api -f
journalctl --user -u hermes-dashboard-web -f
```
