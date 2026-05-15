import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { getPidDir, getLogsDir, writePublicTunnelUrl, getPublicTunnelUrlPath } from './config.js';

const TUNNEL_URL_FILE = () => `${getPidDir()}/tunnel.url`;
const TUNNEL_PID_FILE = () => `${getPidDir()}/tunnel-ssh.pid`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getTunnelUrl() {
  try {
    return readFileSync(TUNNEL_URL_FILE(), 'utf-8').trim();
  } catch {
    return null;
  }
}

export function isTunnelRunning() {
  try {
    execSync('pgrep -af "ssh .*localhost.run"', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function getTunnelPid() {
  try {
    return readFileSync(TUNNEL_PID_FILE(), 'utf-8').trim();
  } catch {
    return null;
  }
}

export async function startTunnel() {
  try {
    execSync('systemctl --user start hermes-dashboard-tunnel.service', { stdio: 'pipe' });
    for (let i = 0; i < 20; i++) {
      const url = getTunnelUrl();
      if (url) {
        writePublicTunnelUrl(url);
        return { ok: true, url };
      }
      await sleep(1000);
    }
    return { ok: false, url: null, error: 'Tunnel URL never became available' };
  } catch {
    return { ok: false, url: null, error: 'Unable to start tunnel service' };
  }
}

export function stopTunnel() {
  try {
    execSync('systemctl --user stop hermes-dashboard-tunnel.service', { stdio: 'pipe' });
    const pubPath = getPublicTunnelUrlPath();
    if (existsSync(pubPath)) {
      try { unlinkSync(pubPath); } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

export async function restartTunnel() {
  stopTunnel();
  await sleep(1000);
  return startTunnel();
}

export function getTunnelLogPath() {
  return `${getLogsDir()}/tunnel.log`;
}

export function readTunnelLog(lines = 50) {
  try {
    const logPath = getTunnelLogPath();
    const content = readFileSync(logPath, 'utf-8');
    const allLines = content.split('\n');
    return allLines.slice(-lines).join('\n');
  } catch {
    return '';
  }
}

export function getTunnelStatus() {
  return {
    running: isTunnelRunning(),
    url: getTunnelUrl(),
    pid: getTunnelPid(),
  };
}
