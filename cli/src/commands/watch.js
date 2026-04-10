import { log, json } from '../lib/logger.js';
import { start as startService, stop as stopService, restart as restartService, isActive, getPid } from '../lib/services.js';
import { confirm } from '../lib/confirm.js';

const WATCHER_MAP = {
  api: 'apiWatch',
  web: 'webWatch',
};

export default async function watchCmd(target, opts) {
  // No target or 'status' — show watcher status
  if (!target || target === 'status') {
    const apiWatchUp = isActive('apiWatch');
    const webWatchUp = isActive('webWatch');

    if (opts.json) {
      json({
        watchers: {
          api: { running: apiWatchUp, pid: getPid('apiWatch') },
          web: { running: webWatchUp, pid: getPid('webWatch') },
        },
      });
      return;
    }

    log.info('File watchers:');
    log.dim(`  api-watch: ${apiWatchUp ? 'RUNNING' : 'STOPPED'} (PID ${getPid('apiWatch') || '—'})`);
    log.dim(`  web-watch: ${webWatchUp ? 'RUNNING' : 'STOPPED'} (PID ${getPid('webWatch') || '—'})`);
    return;
  }

  // Validate target
  if (target !== 'api' && target !== 'web') {
    log.error(`Unknown watch target: ${target}. Use: api, web, status`);
    process.exit(1);
  }

  const svcKey = WATCHER_MAP[target];
  const svcLabel = `${target}-watch`;

  if (isActive(svcKey)) {
    // Already running — restart it
    if (!opts.json) log.info(`${svcLabel} already running, restarting...`);
    restartService(svcKey);
    if (opts.json) { json({ watcher: target, action: 'restarted', pid: getPid(svcKey) }); return; }
    log.success(`${svcLabel} restarted`);
  } else {
    startService(svcKey);
    if (opts.json) { json({ watcher: target, action: 'started', pid: getPid(svcKey) }); return; }
    log.success(`${svcLabel} started`);
  }
}
