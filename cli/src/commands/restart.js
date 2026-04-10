import { log, header, json } from '../lib/logger.js';
import { restart as restartService, getPid } from '../lib/services.js';
import { isPortOpen, killPort, waitForPort } from '../lib/ports.js';
import { restartTunnel, getTunnelUrl } from '../lib/tunnel.js';
import { getVersion } from '../lib/config.js';
import { withSpinner } from '../lib/exec.js';

export default async function restart(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Restarting`);

  const result = {
    services: {
      api: { restarted: false, pid: null },
      web: { restarted: false, pid: null },
      tunnel: { restarted: false, url: null },
    },
  };

  // Pre-kill lingering processes to prevent EADDRINUSE
  for (const port of [5174, 5175]) {
    if (isPortOpen(port)) {
      if (!opts.json) log.dim(`  Pre-kill port ${port}...`);
      killPort(port);
    }
  }

  // API
  try {
    await withSpinner('Restarting API...', opts, () => {
      restartService('api');
      if (!waitForPort(5174)) throw new Error('API failed to restart');
      result.services.api = { restarted: true, pid: getPid('api') };
    });
  } catch {
    json(result);
    process.exit(1);
  }

  // Web
  await withSpinner('Restarting Vite dev...', opts, () => {
    restartService('web');
    if (waitForPort(5175)) {
      result.services.web = { restarted: true, pid: getPid('web') };
    }
  });

  // Tunnel
  if (opts.tunnel) {
    await withSpinner('Restarting tunnel...', opts, () => {
      const tunnelResult = restartTunnel();
      if (tunnelResult.ok) {
        result.services.tunnel = { restarted: true, url: tunnelResult.url };
      }
    });
  }

  if (opts.json) { json(result); return; }
  log.dim('');
  log.success('Dashboard restarted');
}
