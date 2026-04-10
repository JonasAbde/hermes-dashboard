import { log, header, json } from '../lib/logger.js';
import { getTunnelStatus, startTunnel, stopTunnel, restartTunnel } from '../lib/tunnel.js';

export default async function tunnelCmd(action, opts) {
  const status = getTunnelStatus();

  if (opts.json) {
    json(status);
    return;
  }

  if (!action || action === 'status') {
    header('Tunnel Status');
    log.info(`Running: ${status.running ? 'Yes' : 'No'}`);
    log.info(`URL: ${status.url || 'None'}`);
    log.info(`PID: ${status.pid || 'None'}`);
    return;
  }

  if (action === 'restart') {
    log.info('Restarting tunnel...');
    const result = restartTunnel();
    if (result.ok) {
      log.success(`Tunnel: ${result.url}`);
    } else {
      log.error('Tunnel restart failed');
    }
    return;
  }

  if (action === 'start') {
    const result = startTunnel();
    if (result.ok) {
      log.success(`Tunnel: ${result.url}`);
    } else {
      log.error('Tunnel start failed');
    }
    return;
  }

  if (action === 'stop') {
    stopTunnel();
    log.success('Tunnel stopped');
    return;
  }

  log.error(`Unknown action: ${action}. Use: status, start, stop, restart`);
}
