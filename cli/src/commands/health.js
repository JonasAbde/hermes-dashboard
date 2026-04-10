import { log, header, json } from '../lib/logger.js';
import { deepHealthCheck, checkApiHealth, checkApiReady, checkFrontend, checkViteProxy, checkGateway } from '../lib/health.js';
import { getTunnelUrl, isTunnelRunning } from '../lib/tunnel.js';

function statusIcon(ok) {
  return ok ? '✔' : '✖';
}

export default async function health(opts) {
  const results = await deepHealthCheck();

  if (opts.json) {
    json(results);
    return;
  }

  header('Hermes Dashboard — Health Check');

  const checks = [
    ['API Health', results.api_health?.ok],
    ['API Ready', results.api_ready?.ok],
    ['Frontend', results.frontend?.ok],
    ['Vite Proxy (/api → 5174)', results.vite_proxy?.ok],
    ['Gateway', results.gateway?.ok],
    ['MCP Server', results.mcp?.ok],
    ['Tunnel', results.tunnel?.ok],
  ];

  for (const [name, ok] of checks) {
    if (ok) {
      log.success(`${name}: OK`);
    } else {
      log.error(`${name}: FAILED`);
    }
  }

  if (results.tunnel?.url) {
    log.dim(`\nTunnel URL: ${results.tunnel.url}`);
  }
}
