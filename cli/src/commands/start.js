import { log, spinner, header } from '../lib/logger.js';
import { start as startService, isActive, getPid } from '../lib/services.js';
import { isPortOpen, waitForPort } from '../lib/ports.js';
import { startTunnel, getTunnelUrl } from '../lib/tunnel.js';
import { getVersion } from '../lib/config.js';

export default async function start(opts) {
  const version = getVersion();
  header(`Hermes Dashboard v${version || '?'}`);

  if (opts.apiOnly && opts.webOnly) {
    log.error('Cannot use --api-only and --web-only together');
    process.exit(1);
  }

  // API
  if (!opts.webOnly) {
    if (isPortOpen(5174)) {
      log.info(`API already running (PID ${getPid('api') || '?'})`);
    } else {
      const s = spinner('Starting API server...');
      s.start();
      startService('api');
      if (waitForPort(5174)) {
        s.succeed('API started on port 5174');
      } else {
        s.fail('API failed to start');
        process.exit(1);
      }
    }
  }

  // Web
  if (!opts.apiOnly) {
    if (isPortOpen(5175)) {
      log.info(`Vite dev already running (PID ${getPid('web') || '?'})`);
    } else {
      const s = spinner('Starting Vite dev server...');
      s.start();
      startService('web');
      if (waitForPort(5175)) {
        s.succeed('Vite dev started on port 5175');
      } else {
        s.warn('Vite dev not responding after 7.5s');
      }
    }
  }

  // Tunnel
  if (opts.tunnel && !opts.apiOnly) {
    const s = spinner('Starting tunnel...');
    s.start();
    const result = startTunnel();
    if (result.ok) {
      s.succeed(`Tunnel: ${result.url}`);
    } else {
      s.warn('Tunnel URL not received (may still be connecting)');
    }
  }

  log.dim('');
  log.success('Dashboard running');
  log.dim(`  Local:  http://localhost:${opts.apiOnly ? '5174' : '5175'}`);
  if (opts.tunnel && !opts.apiOnly) {
    const url = getTunnelUrl();
    if (url) log.dim(`  Tunnel: ${url}`);
  }
}
