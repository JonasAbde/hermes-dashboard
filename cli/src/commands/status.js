import Table from 'cli-table3';
import { log, header, json, section, statusLine } from '../lib/logger.js';
import { getServicesStatus } from '../lib/services.js';
import { isPortOpen, KNOWN_PORTS } from '../lib/ports.js';
import { getTunnelStatus } from '../lib/tunnel.js';
import { checkApiHealth, checkViteProxy, checkTunnelReachable } from '../lib/health.js';
import { getVersion } from '../lib/config.js';
import { resolveEnv, getEnv } from '../lib/env.js';
import { buildCommandResult, buildErrorResult } from '../lib/command-result.js';

function serviceStatusText(isUp) {
  return isUp ? 'OK' : 'OFF';
}

export default async function status(opts) {
  const version = getVersion();
  const envName = resolveEnv(opts.env);

  if (!opts.json) {
    header(`Hermes Dashboard v${version || '?'} [${envName}]`);
  }

  try {
    getEnv(envName);
  } catch (error) {
    if (opts.json) {
      json(buildErrorResult('status', error.message, { envName }, 'validation_error'));
      process.exit(2);
    }
    log.error('Environment validation failed');
    log.error(`Reason: ${error.message}`);
    log.error('Action: use --env to choose a valid environment');
    process.exit(2);
  }

  const serviceChecks = await getServicesStatus(['api', 'web', 'proxy', 'gateway']);
  const tunnel = getTunnelStatus();
  const tunnelUp = tunnel.running;
  const tunnelUrl = tunnel.url;
  const apiHealth = await checkApiHealth();
  const proxyOk = await checkViteProxy();
  const tunnelReachable = tunnelUrl ? await checkTunnelReachable(tunnelUrl) : false;

  if (opts.json) {
    const payload = buildCommandResult({
      command: 'status',
      payload: {
        version,
        environment: envName,
        services: {
          api: {
            ...serviceChecks.api,
            port: 5174,
            running: serviceChecks.api.running,
            healthy: apiHealth.ok,
          },
          web: {
            ...serviceChecks.web,
            port: 5175,
            running: serviceChecks.web.running,
            healthy: proxyOk.ok,
          },
          proxy: {
            ...serviceChecks.proxy,
            port: 5176,
            running: serviceChecks.proxy.running,
            healthy: proxyOk.ok,
          },
          gateway: {
            ...serviceChecks.gateway,
            port: 8642,
            running: serviceChecks.gateway.running,
            healthy: false,
          },
          tunnel: {
            running: tunnelUp,
            url: tunnelUrl,
            healthy: tunnelReachable,
          },
        },
        ports: {
          5174: isPortOpen(5174),
          5175: isPortOpen(5175),
          5176: isPortOpen(5176),
          8642: isPortOpen(8642),
        },
        proxy: proxyOk,
        details: {
          tunnel_running: tunnelUp,
          tunnel_reachable: tunnelReachable,
          command_version: version,
        },
      },
    });
    json(payload);
    return;
  }

  section('Services', opts);
  const svcTable = new Table({
    head: ['Service', 'Status', 'PID', 'Port'],
    style: { head: [], border: [] },
  });
  svcTable.push(
    ['API', serviceStatusText(serviceChecks.api.running), serviceChecks.api.pid || '—', '5174'],
    ['CORS Proxy', serviceStatusText(serviceChecks.proxy.running), serviceChecks.proxy.pid || '—', '5176'],
    ['Vite Dev', serviceStatusText(serviceChecks.web.running), serviceChecks.web.pid || '—', '5175'],
    ['Gateway', serviceStatusText(serviceChecks.gateway.running), serviceChecks.gateway.pid || '—', '8642'],
    ['Tunnel', serviceStatusText(tunnelUp), tunnelUrl || '—', '—'],
  );
  log.info(svcTable.toString());

  section('Ports', opts);
  const portTable = new Table({
    head: ['Port', 'Service', 'Status'],
    style: { head: [], border: [] },
  });
  for (const [key, info] of Object.entries(KNOWN_PORTS)) {
    const statusText = isPortOpen(info.port) ? 'OPEN' : 'CLOSED';
    portTable.push([info.port, info.desc, statusText]);
  }
  log.info(portTable.toString());

  section('Health checks', opts);
  statusLine('API health', apiHealth.ok, apiHealth.ok ? JSON.stringify(apiHealth.data) : 'not responding', opts);
  statusLine('Vite proxy', proxyOk.ok, proxyOk.ok ? 'WORKING (/api → 5174)' : 'NOT WORKING', opts);
  statusLine('Tunnel URL', tunnelUp, tunnelReachable ? `${tunnelUrl} (reachable)` : (tunnelUrl || 'No URL'), opts);
}
