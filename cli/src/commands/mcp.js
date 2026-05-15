import { log, header, json, section, statusLine } from '../lib/logger.js';
import { resolveEnv } from '../lib/env.js';
import { getVersion } from '../lib/config.js';
import { checkMcpStatus } from '../lib/health.js';
import { buildCommandResult } from '../lib/command-result.js';


export default async function mcp(action, opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'}`);

  // Resolve env name (doesn't require env file to exist)
  const envName = resolveEnv(opts.env);
  const mcpResponse = await checkMcpStatus();
  const isRunning = mcpResponse?.ok === true;
  const routes = Array.isArray(mcpResponse?.data?.routes) ? mcpResponse.data.routes : [];

  action = action || 'status';

  if (opts.json) {
    json(buildCommandResult({
      command: 'mcp',
      ok: isRunning,
      status: isRunning ? 'running' : 'stopped',
      payload: {
        env: envName,
        action,
        running: isRunning,
        routes,
        details: mcpResponse?.data || null,
      },
    }));
    return;
  }

  log.dim(`MCP status for environment: ${envName}`);

  if (action === 'status') {
    section('MCP Server Status', opts);
    statusLine('MCP', isRunning, isRunning ? 'AVAILABLE' : 'UNAVAILABLE', opts);
    if (isRunning && routes.length > 0) {
      log.info(`Routes available: ${routes.length}`);
    }
    return;
  }

  if (action === 'list') {
    section('MCP Routes', opts);
    if (!routes.length) {
      log.warn('No routes available');
      return;
    }
    for (const route of routes) {
      const label = typeof route === 'string' ? route : JSON.stringify(route);
      log.info(`- ${label}`);
    }
    return;
  }

  log.error('Unknown action');
  log.error(`Reason: ${action} is not supported`);
  log.error('Action: use one of status, list');
  process.exit(2);
}


