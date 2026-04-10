import { log, spinner, header, json } from '../lib/logger.js';
import { restart as restartService, isActive, getPid } from '../lib/services.js';
import { isPortOpen, killPort, waitForPort } from '../lib/ports.js';
import { restartTunnel, getTunnelUrl } from '../lib/tunnel.js';
import { getVersion } from '../lib/config.js';

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
  if (!opts.json) {
    const s1 = spinner('Restarting API...');
    s1.start();
    restartService('api');
    if (waitForPort(5174)) {
      s1.succeed(`API restarted (PID ${getPid('api') || '?'})`);
      result.services.api = { restarted: true, pid: getPid('api') };
    } else {
      s1.fail('API failed to restart');
    }
  } else {
    restartService('api');
    if (waitForPort(5174)) {
      result.services.api = { restarted: true, pid: getPid('api') };
    }
  }

  // Web
  if (!opts.json) {
    const s2 = spinner('Restarting Vite dev...');
    s2.start();
    restartService('web');
    if (waitForPort(5175)) {
      s2.succeed(`Vite dev restarted (PID ${getPid('web') || '?'})`);
      result.services.web = { restarted: true, pid: getPid('web') };
    } else {
      s2.warn('Vite dev not responding');
    }
  } else {
    restartService('web');
    if (waitForPort(5175)) {
      result.services.web = { restarted: true, pid: getPid('web') };
    }
  }

  // Tunnel
  if (opts.tunnel) {
    if (!opts.json) {
      const s3 = spinner('Restarting tunnel...');
      s3.start();
      const tunnelResult = restartTunnel();
      if (tunnelResult.ok) {
        s3.succeed(`Tunnel: ${tunnelResult.url}`);
        result.services.tunnel = { restarted: true, url: tunnelResult.url };
      } else {
        s3.warn('Tunnel URL not received');
      }
    } else {
      const tunnelResult = restartTunnel();
      if (tunnelResult.ok) {
        result.services.tunnel = { restarted: true, url: tunnelResult.url };
      }
    }
  }

  if (opts.json) {
    json(result);
    return;
  }

  log.dim('');
  log.success('Dashboard restarted');
}
