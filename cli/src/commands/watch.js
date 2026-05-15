import { log, json } from '../lib/logger.js';
import { isPortOpen } from '../lib/ports.js';
import { confirm } from '../lib/confirm.js';
import { execSync } from 'child_process';

const WATCHER_MAP = {
  api: 'apiWatch',
  web: 'webWatch',
};

const WATCHER_PORTS = {
  api: 5174,  // API server
  web: 5175,  // Vite dev server
};

export default async function watchCmd(target, opts) {
  // No target or 'status' — show watcher status
  if (!target || target === 'status') {
    const apiWatchUp = isPortOpen(5174);
    const webWatchUp = isPortOpen(5175);

    if (opts.json) {
      json({
        watchers: {
          api: { running: apiWatchUp, pid: null },
          web: { running: webWatchUp, pid: null },
        },
      });
      return;
    }

    log.info('File watchers:');
    log.dim(`  api-watch: ${apiWatchUp ? 'RUNNING' : 'STOPPED'} (Port 5174)`);
    log.dim(`  web-watch: ${webWatchUp ? 'RUNNING' : 'STOPPED'} (Port 5175)`);
    return;
  }

  // Validate target
  if (target !== 'api' && target !== 'web') {
    log.error(`Unknown watch target: ${target}. Use: api, web, status`);
    process.exit(1);
  }

  const port = WATCHER_PORTS[target];

  if (isPortOpen(port)) {
    // Already running — restart it
    if (!opts.json) log.info(`Watcher already running on port ${port}, restarting...`);
    try {
      execSync('npx nodemon --exec "pkill -f nodemon" --watch . --watch api --watch web 2>/dev/null || true', {
        stdio: 'pipe',
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      // nodemon not installed or error - ignore
    }
    if (opts.json) {
      json({ watcher: target, action: 'restarted', pid: null });
      return;
    }
    log.success(`Watcher restarted`);
  } else {
    try {
      if (!opts.json) log.info(`Starting watcher on port ${port}...`);
      execSync(`npx nodemon --exec "node api/index.js" --watch api --watch web --port ${port}`, {
        stdio: 'pipe',
      });
      if (opts.json) {
        json({ watcher: target, action: 'started', pid: null });
        return;
      }
      log.success(`Watcher started`);
    } catch (e) {
      if (!opts.json) log.error(`Failed to start watcher: ${e.message}`);
      process.exit(1);
    }
  }
}
