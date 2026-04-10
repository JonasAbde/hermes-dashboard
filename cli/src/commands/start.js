import { log, spinner, header, json } from '../lib/logger.js';
import { start as startService, getPid } from '../lib/services.js';
import { isPortOpen, waitForPort } from '../lib/ports.js';
import { startTunnel, getTunnelUrl } from '../lib/tunnel.js';
import { getVersion, writePublicTunnelUrl } from '../lib/config.js';
import { withSpinner, jsonOrHuman } from '../lib/exec.js';

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
      await withSpinner('Starting API server...', opts, () => {
        startService('api');
        if (!waitForPort(5174)) throw new Error('API failed to start');
        result.services.api = { started: true, pid: getPid('api') };
      });
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
    await withSpinner('Starting tunnel...', opts, () => {
      const tunnelResult = startTunnel();
      if (tunnelResult.ok) {
        result.services.tunnel = { started: true, url: tunnelResult.url };
        writePublicTunnelUrl(tunnelResult.url);
      }
    });
  }

  // Check for partial failures
  const anyFailed =
    (!opts.webOnly && !result.services.api.started) ||
    (!opts.apiOnly && !result.services.web.started);

  if (opts.json) {
    json(result);
    if (anyFailed) process.exit(1);
    return;
  }

  if (anyFailed) {
    log.dim('');
    log.error('Some services failed to start');
    process.exit(1);
  }

  log.dim('');
  log.success('Dashboard running');
  if (opts.apiOnly) {
    log.dim('  API: http://localhost:5174');
  } else {
    log.dim(`  Local:  http://localhost:5175`);
  }
  if (opts.tunnel && !opts.apiOnly) {
    const url = getTunnelUrl();
    if (url) log.dim(`  Tunnel: ${url}`);
  }
}
