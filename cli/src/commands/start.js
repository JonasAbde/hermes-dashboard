import { log, spinner, header, json } from '../lib/logger.js';
import { start as startService, isActive, getPid } from '../lib/services.js';
import { isPortOpen, waitForPort } from '../lib/ports.js';
import { startTunnel, getTunnelUrl } from '../lib/tunnel.js';
import { getVersion } from '../lib/config.js';

export default async function start(opts) {
  const version = getVersion();

  if (!opts.json) header(`Hermes Dashboard v${version || '?'}`);

  if (opts.apiOnly && opts.webOnly) {
    log.error('Cannot use --api-only and --web-only together');
    process.exit(1);
  }

  const result = {
    services: {
      api: { started: false, pid: null },
      web: { started: false, pid: null },
      tunnel: { started: false, url: null },
    },
  };

  // API
  if (!opts.webOnly) {
    if (isPortOpen(5174)) {
      if (!opts.json) log.info(`API already running (PID ${getPid('api') || '?'})`);
      result.services.api = { started: true, pid: getPid('api') };
    } else {
      if (!opts.json) {
        const s = spinner('Starting API server...');
        s.start();
        startService('api');
        if (waitForPort(5174)) {
          s.succeed('API started on port 5174');
          result.services.api = { started: true, pid: getPid('api') };
        } else {
          s.fail('API failed to start');
          process.exit(1);
        }
      } else {
        startService('api');
        if (waitForPort(5174)) {
          result.services.api = { started: true, pid: getPid('api') };
        } else {
          result.services.api = { started: false, pid: null };
        }
      }
    }
  }

  // Web
  if (!opts.apiOnly) {
    if (isPortOpen(5175)) {
      if (!opts.json) log.info(`Vite dev already running (PID ${getPid('web') || '?'})`);
      result.services.web = { started: true, pid: getPid('web') };
    } else {
      if (!opts.json) {
        const s = spinner('Starting Vite dev server...');
        s.start();
        startService('web');
        if (waitForPort(5175)) {
          s.succeed('Vite dev started on port 5175');
          result.services.web = { started: true, pid: getPid('web') };
        } else {
          s.warn('Vite dev not responding after 7.5s');
        }
      } else {
        startService('web');
        if (waitForPort(5175)) {
          result.services.web = { started: true, pid: getPid('web') };
        }
      }
    }
  }

  // Tunnel
  if (opts.tunnel && !opts.apiOnly) {
    if (!opts.json) {
      const s = spinner('Starting tunnel...');
      s.start();
      const tunnelResult = startTunnel();
      if (tunnelResult.ok) {
        s.succeed(`Tunnel: ${tunnelResult.url}`);
        result.services.tunnel = { started: true, url: tunnelResult.url };
      } else {
        s.warn('Tunnel URL not received (may still be connecting)');
      }
    } else {
      const tunnelResult = startTunnel();
      if (tunnelResult.ok) {
        result.services.tunnel = { started: true, url: tunnelResult.url };
      }
    }
  }

  if (opts.json) {
    json(result);
    return;
  }

  log.dim('');
  log.success('Dashboard running');
  log.dim(`  Local:  http://localhost:${opts.apiOnly ? '5174' : '5175'}`);
  if (opts.tunnel && !opts.apiOnly) {
    const url = getTunnelUrl();
    if (url) log.dim(`  Tunnel: ${url}`);
  }
}
