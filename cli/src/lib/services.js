import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getPidDir } from './config.js';

const SERVICES = {
  api: 'hermes-dashboard-api.service',
  web: 'hermes-dashboard-web.service',
  proxy: 'hermes-dashboard-proxy.service',
  tunnel: 'hermes-dashboard-tunnel.service',
};

const PID_SERVICES = ['api', 'web', 'proxy'];

function ensurePidDir() {
  const dir = getPidDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// --- PID file management ---

export function writePid(service, pid) {
  ensurePidDir();
  writeFileSync(join(getPidDir(), `${service}.pid`), String(pid), 'utf-8');
}

export function cleanPid(service) {
  const file = join(getPidDir(), `${service}.pid`);
  try {
    unlinkSync(file);
  } catch {
    // already gone
  }
}

export function readPid(service) {
  try {
    const raw = readFileSync(join(getPidDir(), `${service}.pid`), 'utf-8').trim();
    const pid = parseInt(raw, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

// --- systemctl wrapper with error logging ---

function systemctl(action, service) {
  try {
    execSync(`systemctl --user ${action} ${service}`, { stdio: 'pipe' });
    return { success: true, error: null };
  } catch (e) {
    const error = e.stderr?.toString().trim() || e.stdout?.toString().trim() || e.message;
    console.error(`[services] systemctl ${action} ${service} failed: ${error}`);
    return { success: false, error };
  }
}

// --- individual service commands ---

export function start(service) {
  const result = systemctl('start', SERVICES[service]);
  if (result.success && PID_SERVICES.includes(service)) {
    const pid = getPid(service);
    if (pid) writePid(service, pid);
  }
  return result.success;
}

export function stop(service) {
  const result = systemctl('stop', SERVICES[service]);
  if (PID_SERVICES.includes(service)) {
    cleanPid(service);
  }
  return result.success;
}

export function restart(service) {
  const result = systemctl('restart', SERVICES[service]);
  if (result.success && PID_SERVICES.includes(service)) {
    const pid = getPid(service);
    if (pid) writePid(service, pid);
    else cleanPid(service);
  }
  return result.success;
}

export function isActive(service) {
  try {
    execSync(`systemctl --user is-active --quiet ${SERVICES[service]}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function getPid(service) {
  try {
    const out = execSync(`systemctl --user show -p MainPID --value ${SERVICES[service]}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return out && out !== '0' ? parseInt(out, 10) : null;
  } catch {
    return null;
  }
}

export function getStatus(service) {
  try {
    const raw = execSync(`systemctl --user status ${SERVICES[service]} --no-pager -l 2>&1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return raw;
  } catch (e) {
    return e.stdout?.toString() || e.message;
  }
}

export function getUptime(service) {
  try {
    const out = execSync(
      `systemctl --user show ${SERVICES[service]} -p ActiveEnterTimestamp --value`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

// --- batch commands ---

export function startAll() {
  const results = {};
  for (const svc of PID_SERVICES) {
    results[svc] = start(svc);
  }
  return results;
}

export function stopAll() {
  const results = {};
  for (const svc of [...PID_SERVICES].reverse()) {
    results[svc] = stop(svc);
  }
  return results;
}

export const serviceNames = SERVICES;
