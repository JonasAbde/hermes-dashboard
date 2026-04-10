import { log, header, json } from '../lib/logger.js';
import { checkApiHealth, checkViteProxy, checkTunnelReachable } from '../lib/health.js';
import { isTunnelRunning, getTunnelUrl } from '../lib/tunnel.js';
import { isPortOpen } from '../lib/ports.js';
import { resolveEnv, getEnv } from '../lib/env.js';

export default async function health(opts) {
  const version = getVersion();
  if (!opts.json) {
    const envName = resolveEnv(opts.env);
    header(`Hermes Dashboard v${version || '?'} [${envName}]`);
  }

  // Resolve env name
  const envName = resolveEnv(opts.env);
  try {
    getEnv(envName);
  } catch (error) {
    if (opts.json) {
      json({ error: error.message, envName, valid: false });
      process.exit(2);
    }
    log.error('Environment validation failed');
    console.error(error.message);
    process.exit(2);
  }

  if (!opts.json) {
    log.dim(`Environment: ${envName}`);
  }

  // Check ports
  const apiHealthy = checkApiHealth();
  const proxyOk = checkViteProxy();
  const tunnelReachable = isTunnelRunning() ? checkTunnelReachable(getTunnelUrl()) : false;

  if (opts.json) {
    json({
      env: envName,
      api: { healthy: apiHealthy.ok, data: apiHealthy.data },
      proxy: { working: proxyOk.ok, data: proxyOk.data },
      tunnel: {
        running: isTunnelRunning(),
        url: getTunnelUrl(),
        reachable: tunnelReachable
      },
      ports: {
        api: isPortOpen(5174),
        web: isPortOpen(5175),
        proxy: isPortOpen(5176),
        gateway: isPortOpen(8642),
      }
    });
    return;
  }

  if (apiHealthy.ok) {
    log.success(`API: ${JSON.stringify(apiHealthy.data)}`);
  } else {
    log.error('API: NOT RESPONDING');
  }

  if (proxyOk.ok) {
    log.success('Proxy: WORKING (/api → 5174)');
  } else {
    log.error('Proxy: NOT WORKING');
  }

  if (isTunnelRunning()) {
    const url = getTunnelUrl();
    const reachLabel = tunnelReachable ? 'REACHABLE' : 'UNREACHABLE';
    log.info(`Tunnel: ${url} [${reachLabel}]`);
  } else {
    log.warn('Tunnel: Not running');
  }

  console.log();
  log.dim('Environment: ' + envName);
}

function getVersion() {
  try {
    const { readFileSync } = require('fs');
    const pkgPath = join(process.env.HOME, '.hermes/dashboard/cli/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '?';
  }
}
