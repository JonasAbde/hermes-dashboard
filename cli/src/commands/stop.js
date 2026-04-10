import { log, spinner } from '../lib/logger.js';
import { stop as stopService } from '../lib/services.js';
import { isPortOpen, killPort } from '../lib/ports.js';
import { stopTunnel } from '../lib/tunnel.js';

export default async function stop(opts) {
  const all = !opts.apiOnly && !opts.webOnly && !opts.tunnelOnly;

  if (all || opts.tunnelOnly) {
    const s = spinner('Stopping tunnel...');
    s.start();
    stopTunnel();
    s.succeed('Tunnel stopped');
    if (opts.tunnelOnly) return;
  }

  if (all || opts.webOnly) {
    const s = spinner('Stopping Vite dev (5175)...');
    s.start();
    stopService('web');
    if (isPortOpen(5175)) {
      killPort(5175);
      log.warn('Had to force-kill port 5175');
    }
    s.succeed('Vite dev stopped');
    if (opts.webOnly) return;
  }

  if (all || opts.apiOnly) {
    const s = spinner('Stopping API (5174)...');
    s.start();
    stopService('api');
    if (isPortOpen(5174)) {
      killPort(5174);
      log.warn('Had to force-kill port 5174');
    }
    s.succeed('API stopped');
  }

  log.success('All dashboard services stopped');
}
