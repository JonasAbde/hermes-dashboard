import { log, spinner, header } from '../lib/logger.js';
import { restart as restartService, isActive, getPid } from '../lib/services.js';
import { isPortOpen, killPort, waitForPort } from '../lib/ports.js';
import { restartTunnel, getTunnelUrl } from '../lib/tunnel.js';
import { getVersion } from '../lib/config.js';

export default async function restart(opts) {
  const version = getVersion();
  header(`Hermes Dashboard v${version || '?'} — Restarting`);

  // Pre-kill lingering processes to prevent EADDRINUSE
  for (const port of [5174, 5175]) {
    if (isPortOpen(port)) {
      log.dim(`  Pre-kill port ${port}...`);
      killPort(port);
    }
  }

  // API
  const s1 = spinner('Restarting API...');
  s1.start();
  restartService('api');
  if (waitForPort(5174)) {
    s1.succeed(`API restarted (PID ${getPid('api') || '?'})`);
  } else {
    s1.fail('API failed to restart');
  }

  // Web
  const s2 = spinner('Restarting Vite dev...');
  s2.start();
  restartService('web');
  if (waitForPort(5175)) {
    s2.succeed(`Vite dev restarted (PID ${getPid('web') || '?'})`);
  } else {
    s2.warn('Vite dev not responding');
  }

  // Tunnel
  if (opts.tunnel) {
    const s3 = spinner('Restarting tunnel...');
    s3.start();
    const result = restartTunnel();
    if (result.ok) {
      s3.succeed(`Tunnel: ${result.url}`);
    } else {
      s3.warn('Tunnel URL not received');
    }
  }

  log.dim('');
  log.success('Dashboard restarted');
}
