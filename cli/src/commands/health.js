import { log, header, json, section, statusLine } from '../lib/logger.js';
import { checkApiHealth, checkViteProxy, checkTunnelReachable, checkMcpStatus } from '../lib/health.js';
import { getTunnelStatus } from '../lib/tunnel.js';
import { isPortOpen } from '../lib/ports.js';
import { resolveEnv, getEnv } from '../lib/env.js';
import { getVersion } from '../lib/config.js';
import { buildCommandResult, buildErrorResult } from '../lib/command-result.js';

export default async function health(opts) {
  const version = getVersion();
  const envName = resolveEnv(opts.env);

  if (!opts.json) {
    header(`Hermes Dashboard v${version || '?'} [${envName}]`);
  }

  try {
    getEnv(envName);
  } catch (error) {
    if (opts.json) {
      json(buildErrorResult('health', error.message, { envName }, 'validation_error'));
      process.exit(2);
    }
    log.error('Environment validation failed');
    log.error(`Reason: ${error.message}`);
    log.error('Action: use --env to choose a valid environment');
    process.exit(2);
  }

  if (!opts.json) {
    log.dim(`Environment: ${envName}`);
  }

  const apiHealthy = await checkApiHealth();
  const proxyOk = await checkViteProxy();
  const tunnelStatus = getTunnelStatus();
  const tunnelReachable = tunnelStatus.url ? await checkTunnelReachable(tunnelStatus.url) : false;
  const mcpStatus = await checkMcpStatus();

  if (opts.json) {
    json(buildCommandResult({
      command: 'health',
      ok: apiHealthy.ok && proxyOk.ok,
      payload: {
        env: envName,
        api: { healthy: apiHealthy.ok, data: apiHealthy.data },
        proxy: { working: proxyOk.ok, data: proxyOk.data },
        mcp: { ...mcpStatus },
        tunnel: {
          running: tunnelStatus.running,
          url: tunnelStatus.url,
          reachable: tunnelReachable,
        },
        ports: {
          api: isPortOpen(5174),
          web: isPortOpen(5175),
          proxy: isPortOpen(5176),
          gateway: isPortOpen(8642),
        },
      },
    }));
    return;
  }

  log.dim('Health checks');
  section('Endpoint checks', opts);
  statusLine('API', apiHealthy.ok, apiHealthy.ok ? 'RESPONDING' : 'NOT RESPONDING', opts);
  if (apiHealthy.ok) {
    log.info(`  Data: ${JSON.stringify(apiHealthy.data)}`);
  }

  statusLine('Proxy', proxyOk.ok, proxyOk.ok ? 'WORKING (/api → 5174)' : 'NOT WORKING', opts);
  statusLine('Tunnel', tunnelStatus.running, tunnelStatus.url ? `URL ${tunnelStatus.url}` : 'No URL', opts);
  statusLine('Tunnel reachability', tunnelReachable, tunnelReachable ? 'REACHABLE' : 'UNREACHABLE', opts);
  log.info(`MCP: ${mcpStatus.ok ? 'AVAILABLE' : 'UNAVAILABLE'}`);

  section('Environment', opts);
  log.dim(`Environment: ${envName}`);
}
