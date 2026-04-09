# Dashboard Auto Reload

The local dashboard now supports automatic reload in both layers:

- Web UI: `hermes-dashboard-web.service` runs Vite dev server on port `5175`, so React/UI edits hot-reload automatically.
- Web config: `hermes-dashboard-web-watch.service` watches config files like `vite.config.js`, `package.json`, `tailwind.config.js`, and `index.html`, then restarts the web service when those change.
- API: `hermes-dashboard-api.service` runs the normal Express server, and `hermes-dashboard-api-watch.service` watches the whole `api/` tree and triggers a clean systemd restart when files change.

Recommended `systemd --user` API unit:

```ini
[Unit]
Description=Hermes Dashboard API
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/empir/.hermes/dashboard/api
ExecStartPre=-/bin/bash -c 'fuser -k 5174/tcp 2>/dev/null; for i in $(seq 1 10); do ss -tlnp | grep -q ":5174" || break; sleep 1; done'
ExecStart=/home/empir/.nvm/versions/node/v22.22.2/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=HOME=/home/empir
Environment=PATH=/home/empir/.local/bin:/home/empir/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
```

Recommended watcher unit:

```ini
[Unit]
Description=Hermes Dashboard API file watcher
After=hermes-dashboard-api.service

[Service]
Type=simple
WorkingDirectory=/home/empir/.hermes/dashboard
ExecStart=/usr/bin/python3 /home/empir/.hermes/dashboard/scripts/watch-dashboard-api.py
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
```

Useful commands:

```bash
systemctl --user daemon-reload
systemctl --user restart hermes-dashboard-api
systemctl --user restart hermes-dashboard-api-watch
systemctl --user restart hermes-dashboard-web
journalctl --user -u hermes-dashboard-api -f
journalctl --user -u hermes-dashboard-api-watch -f
journalctl --user -u hermes-dashboard-web -f
journalctl --user -u hermes-dashboard-web-watch -f
```
