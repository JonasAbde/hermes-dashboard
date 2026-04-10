import { log, spinner, header, json } from '../lib/logger.js';
import { start as startService, getPid } from '../lib/services.js';
import { isPortOpen, waitForPort } from '../lib/ports.js';
import { startTunnel, getTunnelUrl } from '../lib/tunnel.js';
import { getVersion, writePublicTunnelUrl } from '../lib/config.js';
import { withSpinner, jsonOrHuman } from '../lib/exec.js';
import { resolveEnv, getEnv } from '../lib/env.js';

export default async function start(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'}`);

  // Resolve env name with priority: CLI flag > config default_env > development
  const envName = resolveEnv(opts.env);
  let envConfig;

  try {
    envConfig = getEnv(envName);
  } catch (error) {
    log.error('Environment validation failed');
    console.error(error.message);
    process.exit(2);
  }

  if (opts.apiOnly && opts.webOnly) {
    log.error('Cannot use --api-only and --web-only together');
    process.exit(1);
  }
  if (opts.proxyOnly && (opts.apiOnly || opts.webOnly)) {
    log.error('Cannot combine --proxy-only with --api-only or --web-only');
    process.exit(1);
  }

  const result = {
    services: {
      api: { started: false, pid: null },
      web: { started: false, pid: null },
      proxy: { started: false, pid: null },
      gateway: { started: false, pid: null },
      tunnel: { started: false, url: null },
    },
  };

  // Proxy-only mode
  if (opts.proxyOnly) {
    if (isPortOpen(5176)) {
      if (!opts.json) log.info(`Proxy already running (PID ${getPid('proxy') || '?'})`);
      result.services.proxy = { started: true, pid: getPid('proxy') };
    } else {
      await withSpinner('Starting CORS proxy (5176)...', opts, () => {
        startService('proxy');
        if (!waitForPort(5176)) throw new Error('Proxy failed to start');
        result.services.proxy = { started: true, pid: getPid('proxy') };
      });
    }
    if (opts.json) { json(result); return; }
    log.dim('');
    log.success('Proxy running on port 5176');
    return;
  }

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

  // Proxy (after API, before web)
  if (!opts.webOnly) {
    if (isPortOpen(5176)) {
      if (!opts.json) log.info(`Proxy already running (PID ${getPid('proxy') || '?'})`);
      result.services.proxy = { started: true, pid: getPid('proxy') };
    } else {
      await withSpinner('Starting CORS proxy (5176)...', opts, () => {
        startService('proxy');
        if (!waitForPort(5176)) throw new Error('Proxy failed to start');
        result.services.proxy = { started: true, pid: getPid('proxy') };
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

  // Gateway (optional, only with --gateway flag)
  if (opts.gateway) {
    if (isPortOpen(8642)) {
      if (!opts.json) log.info(`Gateway already running (PID ${getPid('gateway') || '?'})`);
      result.services.gateway = { started: true, pid: getPid('gateway') };
    } else {
      await withSpinner('Starting gateway (8642)...', opts, () => {
        startService('gateway');
        if (!waitForPort(8642)) throw new Error('Gateway failed to start');
        result.services.gateway = { started: true, pid: getPid('gateway') };
      });
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
    log.dim(`  Proxy:  http://localhost:5176`);
  }
  if (opts.gateway) {
    log.dim(`  Gateway: http://localhost:8642`);
  }
  if (opts.tunnel && !opts.apiOnly) {
    const url = getTunnelUrl();
    if (url) log.dim(`  Tunnel: ${url}`);
  }
}
