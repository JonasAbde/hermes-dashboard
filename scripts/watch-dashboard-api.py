#!/usr/bin/env python3
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path("/home/empir/.hermes/dashboard/api")
WATCH_EXTENSIONS = {".js", ".mjs", ".cjs", ".json", ".py", ".yaml", ".yml"}
IGNORE_PARTS = {"node_modules", "__pycache__", "dist", ".git"}
POLL_INTERVAL_S = 1.0
RESTART_DEBOUNCE_S = 0.75


def iter_files():
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in IGNORE_PARTS for part in path.parts):
            continue
        if path.suffix not in WATCH_EXTENSIONS:
            continue
        yield path


def snapshot():
    state = {}
    for path in iter_files():
        try:
            stat = path.stat()
        except FileNotFoundError:
            continue
        state[str(path)] = stat.st_mtime_ns
    return state


def restart_service():
    subprocess.run(
        ["systemctl", "--user", "restart", "hermes-dashboard-api.service"],
        check=False,
    )


def main():
    previous = snapshot()
    last_restart_at = 0.0
    print(f"[watch-dashboard-api] watching {ROOT}", flush=True)

    while True:
        time.sleep(POLL_INTERVAL_S)
        current = snapshot()
        if current == previous:
            continue

        now = time.monotonic()
        if now - last_restart_at < RESTART_DEBOUNCE_S:
            previous = current
            continue

        changed = sorted(set(previous) ^ set(current) | {
            path for path, mtime in current.items() if previous.get(path) != mtime
        })
        label = changed[0] if changed else "unknown change"
        print(f"[watch-dashboard-api] change detected: {label}", flush=True)
        restart_service()
        last_restart_at = now
        previous = current


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
