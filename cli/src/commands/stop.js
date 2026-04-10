import { log, spinner, json } from '../lib/logger.js';
import { stop as stopService, cleanPid } from '../lib/services.js';
import { isPortOpen, killPort } from '../lib/ports.js';
import { stopTunnel } from '../lib/tunnel.js';
import { withSpinner } from '../lib/exec.js';
import { confirm } from '../lib/confirm.js';

export default async function stop(opts) {
  const all = !opts.apiOnly && !opts.webOnly && !opts.tunnelOnly;
  const stopped = [];

  if (all && !opts.force) {
    const ok = await confirm('Stop all dashboard services?');
    if (!ok) { log.dim('Cancelled'); process.exit(0); }
  }

  if (all || opts.tunnelOnly) {
    await withSpinner('Stopping tunnel...', opts, () => { stopTunnel(); });
    stopped.push('tunnel');
    if (opts.tunnelOnly) { if (opts.json) json({ stopped }); return; }
  }

  if (all || opts.webOnly) {
    await withSpinner('Stopping Vite dev (5175)...', opts, () => {
      stopService('web');
      cleanPid('web');
      if (isPortOpen(5175)) {
        killPort(5175);
        log.warn('Had to force-kill port 5175');
      }
    });
    stopped.push('web');
    if (opts.webOnly) { if (opts.json) json({ stopped }); return; }
  }

  if (all || opts.apiOnly) {
    await withSpinner('Stopping API (5174)...', opts, () => {
      stopService('api');
      cleanPid('api');
      if (isPortOpen(5174)) {
        killPort(5174);
        log.warn('Had to force-kill port 5174');
      }
    });
    stopped.push('api');
  }

  if (opts.json) { json({ stopped }); return; }
  log.success('All dashboard services stopped');
}
