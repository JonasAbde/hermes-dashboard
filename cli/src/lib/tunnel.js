import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { getPidDir, getLogsDir } from './config.js';

const TUNNEL_URL_FILE = () => `${getPidDir()}/tunnel.url`;
const TUNNEL_PID_FILE = () => `${getPidDir()}/tunnel-ssh.pid`;

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

export function startTunnel() {
  try {
    execSync('systemctl --user start hermes-dashboard-tunnel.service', { stdio: 'pipe' });
    for (let i = 0; i < 20; i++) {
      const url = getTunnelUrl();
      if (url) return { ok: true, url };
      execSync('sleep 1');
    }
    return { ok: false, url: null };
  } catch {
    return { ok: false, url: null };
  }
}

export function stopTunnel() {
  try {
    execSync('systemctl --user stop hermes-dashboard-tunnel.service', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function restartTunnel() {
  stopTunnel();
  execSync('sleep 1');
  return startTunnel();
}

export function getTunnelStatus() {
  return {
    running: isTunnelRunning(),
    url: getTunnelUrl(),
    pid: getTunnelPid(),
  };
}
