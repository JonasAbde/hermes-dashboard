import { log, header, json, section, statusLine } from '../lib/logger.js';
import { startService } from '../lib/services.js';
import { isPortOpen, waitForPortWithService, getPidOnPort } from '../lib/ports.js';
import { startTunnel, getTunnelUrl } from '../lib/tunnel.js';
import { getVersion, writePublicTunnelUrl } from '../lib/config.js';
import { withSpinner } from '../lib/exec.js';
import { resolveEnv, getEnv } from '../lib/env.js';
import { buildCommandResult } from '../lib/command-result.js';

export default async function start(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'}`);

  const envName = resolveEnv(opts.env);
  try {
    getEnv(envName);
  } catch (error) {
    log.error('Environment validation failed');
    log.error(`Reason: ${error.message}`);
    log.error('Action: use --env to choose a valid environment');
    process.exit(2);
  }

  if (opts.apiOnly && opts.webOnly) {
    log.error('Cannot use --api-only and --web-only together');
    log.error('Action: remove one of these flags');
    process.exit(2);
  }
  if (opts.proxyOnly && (opts.apiOnly || opts.webOnly)) {
    log.error('Cannot combine --proxy-only with --api-only or --web-only');
    log.error('Action: run proxy-only on its own');
    process.exit(2);
  }

  const result = {
    services: {
      api: { started: false, pid: null },
      web: { started: false, pid: null },
      proxy: { started: false, pid: null },
      gateway: { started: false, pid: null },
      tunnel: { started: false, url: null },
    },
    failures: [],
  };
  const failures = [];

  if (opts.proxyOnly) {
    const success = await startAndTrackService(opts, 'proxy', 5176, result, failures, 'Proxy');
    if (!success) {
      process.exit(1);
    }
    if (opts.json) {
      json(buildCommandResult({
        command: 'start',
        ok: true,
        payload: { env: envName, services: result.services, failures: result.failures },
      }));
      return;
    }

    section('Startup summary', opts);
    statusLine('Proxy', true, `running on pid ${result.services.proxy.pid || 'unknown'}`, opts);
    return;
  }

  if (!opts.webOnly) {
    const started = await startAndTrackService(opts, 'api', 5174, result, failures, 'API');
    if (!started) failures.push('api');
  }

  if (!opts.webOnly) {
    const started = await startAndTrackService(opts, 'proxy', 5176, result, failures, 'CORS proxy');
    if (!started) failures.push('proxy');
  }

  if (!opts.apiOnly) {
    const started = await startAndTrackService(opts, 'web', 5175, result, failures, 'Vite dev');
    if (!started) failures.push('web');
  }

  if (opts.gateway) {
    const started = await startAndTrackService(opts, 'gateway', 8642, result, failures, 'Gateway');
    if (!started) failures.push('gateway');
  }

  if (opts.tunnel && !opts.apiOnly) {
    const tunnelResult = await withSpinner('Starting tunnel...', opts, async () => {
      const res = await startTunnel();
      if (!res.ok) {
        throw new Error(res.error || 'Tunnel failed to start');
      }
      return res;
    }).catch((error) => {
      result.services.tunnel = { started: false, url: null, lastError: error.message };
      return null;
    });

    if (tunnelResult?.ok) {
      result.services.tunnel = {
        started: true,
        url: tunnelResult.url,
        pid: tunnelResult.pid || null,
      };
      writePublicTunnelUrl(tunnelResult.url);
    } else {
      const message = result.services.tunnel.lastError || 'Failed to start tunnel';
      failures.push(`tunnel: ${message}`);
    }
  }

  if (opts.tunnel && !opts.apiOnly && !result.services.tunnel.started) {
    result.failures = failures;
  }
  result.failures = [...new Set(failures)];

  const anyFailed = (
    (!opts.webOnly && !result.services.api.started) ||
    (!opts.webOnly && !result.services.web.started) ||
    (!opts.apiOnly && !result.services.proxy.started) ||
    (opts.gateway && !result.services.gateway.started) ||
    result.failures.length > 0
  );

  if (opts.json) {
    json(buildCommandResult({
      command: 'start',
      ok: !anyFailed,
      status: anyFailed ? 'error' : 'ok',
      payload: {
        services: result.services,
        failures: result.failures,
        env: envName,
      },
    }));
    if (anyFailed) process.exit(1);
    return;
  }

  section('Startup summary', opts);
  statusLine('API', result.services.api.started, `pid ${result.services.api.pid || 'unknown'}`, opts);
  statusLine('Web', result.services.web.started, `pid ${result.services.web.pid || 'unknown'}`, opts);
  statusLine('Proxy', result.services.proxy.started, `pid ${result.services.proxy.pid || 'unknown'}`, opts);
  statusLine('Gateway', result.services.gateway.started, `pid ${result.services.gateway.pid || 'unknown'}`, opts);
  statusLine('Tunnel', result.services.tunnel.started, result.services.tunnel.url || 'not started', opts);

  if (anyFailed) {
    log.error('Some services failed to start');
    log.error('Action: inspect logs and retry');
    process.exit(1);
  }

  if (opts.apiOnly) {
    log.dim(`  API: http://localhost:5174`);
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

async function startAndTrackService(opts, service, port, result, failures, label) {
  return withSpinner(`Starting ${label} (${port})...`, opts, async () => {
    if (isPortOpen(port)) {
      if (!opts.json) log.info(`${label} already running (PID ${getPidOnPort(port) || '?'})`);
      result.services[service] = { started: true, pid: getPidOnPort(port), lastError: null };
      return true;
    }

    const started = await startService(service);
    if (!started) {
      throw new Error(`startService(${service}) returned false`);
    }

    const ready = await waitForPortWithService(service, port, 15, {
      message: `${label} did not respond on port ${port}`,
    });
    if (!ready.ok) {
      throw new Error(ready.error || `${label} did not become available`);
    }

    result.services[service] = { started: true, pid: getPidOnPort(port), lastError: null };
    return true;
  }).catch((error) => {
    failures.push(`${service}: ${error.message}`);
    result.services[service] = {
      started: false,
      pid: null,
      lastError: error.message,
    };
    return false;
  });
}
