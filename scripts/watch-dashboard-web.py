#!/usr/bin/env python3
import subprocess
import sys
import time
from pathlib import Path

WATCH_FILES = [
    Path("/home/empir/.hermes/dashboard/package.json"),
    Path("/home/empir/.hermes/dashboard/package-lock.json"),
    Path("/home/empir/.hermes/dashboard/vite.config.js"),
    Path("/home/empir/.hermes/dashboard/vitest.config.js"),
    Path("/home/empir/.hermes/dashboard/vitest.config.ts"),
    Path("/home/empir/.hermes/dashboard/postcss.config.js"),
    Path("/home/empir/.hermes/dashboard/tailwind.config.js"),
    Path("/home/empir/.hermes/dashboard/eslint.config.js"),
    Path("/home/empir/.hermes/dashboard/index.html"),
]
POLL_INTERVAL_S = 1.0
RESTART_DEBOUNCE_S = 0.75


def snapshot():
    state = {}
    for path in WATCH_FILES:
        try:
            state[str(path)] = path.stat().st_mtime_ns
        except FileNotFoundError:
            state[str(path)] = None
    return state


def restart_service():
    subprocess.run(
        ["systemctl", "--user", "restart", "hermes-dashboard-web.service"],
        check=False,
    )


def main():
    previous = snapshot()
    last_restart_at = 0.0
    print("[watch-dashboard-web] watching config files", flush=True)

    while True:
        time.sleep(POLL_INTERVAL_S)
        current = snapshot()
        if current == previous:
            continue

        now = time.monotonic()
        if now - last_restart_at < RESTART_DEBOUNCE_S:
            previous = current
            continue

        changed = [path for path, mtime in current.items() if previous.get(path) != mtime]
        label = changed[0] if changed else "unknown change"
        print(f"[watch-dashboard-web] change detected: {label}", flush=True)
        restart_service()
        last_restart_at = now
        previous = current


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
