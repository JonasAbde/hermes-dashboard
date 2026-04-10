import { log, header, json } from '../lib/logger.js';
import { checkMcpStatus } from '../lib/health.js';

async function showStatus(opts) {
  const status = await checkMcpStatus();

  if (opts.json) {
    json({ running: status.ok, data: status.data });
    return;
  }

  header('MCP Server Status');

  if (status.ok) {
    log.success('MCP server is responding');
    if (status.data && typeof status.data === 'object') {
      log.dim(`  ${JSON.stringify(status.data)}`);
    }
  } else {
    log.error('MCP server is not responding');
    log.dim('  Endpoint: http://localhost:5174/api/mcp/status');
  }
}

async function listRoutes(opts) {
  const status = await checkMcpStatus();

  if (opts.json) {
    json({ available: status.ok, data: status.data });
    return;
  }

  header('MCP Routes');

  if (status.ok) {
    log.success('MCP API is available');
    log.dim('  Available endpoints:');
    log.dim('    GET  /api/mcp/status');
    log.dim('    POST /api/mcp/:name/start');
    log.dim('    POST /api/mcp/:name/stop');
    log.dim('    GET  /api/mcp/:name/logs');
  } else {
    log.error('MCP API is not available');
    log.dim('  Start the API server first: hdb start --api-only');
  }
}

export default async function mcpCmd(action, opts) {
  // Commander passes opts as first arg when no positional is given
  if (typeof action === 'object') {
    opts = action;
    action = 'status';
  } else if (action === undefined) {
    action = 'status';
  }
  opts = opts || {};

  switch (action) {
    case 'status':
      await showStatus(opts);
      break;
    case 'list':
      await listRoutes(opts);
      break;
    default:
      log.error(`Unknown action: ${action}`);
      log.dim('Available actions: status, list');
      process.exit(2);
  }
}
