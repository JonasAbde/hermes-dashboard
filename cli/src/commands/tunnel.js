import { log, header, json } from '../lib/logger.js';
import { getTunnelStatus, startTunnel, stopTunnel, restartTunnel, getTunnelUrl, readTunnelLog } from '../lib/tunnel.js';

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

  if (action === 'url') {
    const url = getTunnelUrl();
    if (url) {
      log.info(url);
    } else {
      log.warn('No tunnel URL');
    }
    return;
  }

  if (action === 'log') {
    const lines = opts.lines ? parseInt(opts.lines, 10) : 50;
    const logContent = readTunnelLog(lines);
    if (logContent) {
      console.log(logContent);
    } else {
      log.warn('No tunnel log found');
    }
    return;
  }

  log.error(`Unknown action: ${action}. Use: status, start, stop, restart, url, log`);
  process.exit(2);
}
