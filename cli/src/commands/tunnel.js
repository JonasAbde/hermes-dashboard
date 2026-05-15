import { log, header, json, section, statusLine } from '../lib/logger.js';
import { resolveEnv, getEnv } from '../lib/env.js';
import { getVersion } from '../lib/config.js';
import { withSpinner } from '../lib/exec.js';
import { getTunnelStatus, restartTunnel } from '../lib/tunnel.js';
import { buildCommandResult } from '../lib/command-result.js';

export default async function tunnel(action, opts) {
  const version = await getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'}`);

  const envName = resolveEnv(opts.env);
  try {
    getEnv(envName);
  } catch (error) {
    log.error('Environment validation failed');
    log.error(`Reason: ${error.message}`);
    log.error('Action: run with --env and a valid environment');
    process.exit(2);
  }

  action = action || 'status';

  if (!opts.json) {
    log.dim(`Tunnel for environment: ${envName}`);
  }

  switch (action) {
    case 'url':
      await handleUrl(opts);
      break;
    case 'restart':
      await handleRestart(opts);
      break;
    case 'status':
      await handleStatus(opts);
      break;
    default:
      log.error('Unknown action');
      log.error(`Reason: ${action} is not supported`);
      log.error('Action: use one of status, url, restart');
      process.exit(2);
  }
}

async function handleUrl(opts) {
  const status = getTunnelStatus();

  if (opts.json) {
    json(buildCommandResult({
      command: 'tunnel',
      ok: status.running,
      status: status.running ? 'running' : 'stopped',
      payload: {
        action: 'url',
        running: status.running,
        url: status.url,
        pid: status.pid,
        error: status.running ? null : 'Tunnel not running',
      },
    }));
    return;
  }

  section('Tunnel URL', opts);
  if (status.running && status.url) {
    statusLine('URL', true, status.url, opts);
    if (status.pid) log.dim(`PID: ${status.pid}`);
  } else if (status.running) {
    statusLine('URL', false, 'Running, but URL not yet available', opts);
  } else {
    statusLine('URL', false, 'Tunnel not running', opts);
  }
}

async function handleRestart(opts) {
  let actionResult = { action: 'restart', running: false, url: null, pid: null, error: null };
  try {
    actionResult = await withSpinner('Restarting tunnel...', opts, async () => {
      const started = await restartTunnel();
      if (!started.ok) {
        throw new Error(started.error || 'Failed to restart tunnel');
      }
      const status = getTunnelStatus();
      return { action: 'restart', running: status.running, url: status.url, pid: status.pid, error: null };
    });
  } catch (error) {
    actionResult = { action: 'restart', running: false, url: null, pid: null, error: error.message };
  }

  if (opts.json) {
    json(buildCommandResult({
      command: 'tunnel',
      ok: !actionResult.error,
      status: actionResult.error ? 'error' : 'ok',
      payload: actionResult,
    }));
    if (actionResult.error) process.exit(1);
    return;
  }

  section('Tunnel restart', opts);
  if (actionResult.error) {
    log.error(actionResult.error);
    log.error('Action: check tunnel service status and dependencies');
    process.exit(1);
  }
  statusLine('Tunnel', true, `running${actionResult.url ? ` (${actionResult.url})` : ''}`, opts);
}

async function handleStatus(opts) {
  const status = getTunnelStatus();
  if (opts.json) {
    json(buildCommandResult({
      command: 'tunnel',
      ok: status.running,
      status: status.running ? 'running' : 'stopped',
      payload: {
        action: 'status',
        running: status.running,
        url: status.url,
        pid: status.pid,
      },
    }));
    return;
  }

  section('Tunnel status', opts);
  if (status.running) {
    statusLine('Tunnel', true, status.url || 'No URL available yet', opts);
    if (status.pid) log.dim(`PID: ${status.pid}`);
  } else {
    statusLine('Tunnel', false, 'not running', opts);
  }
}
