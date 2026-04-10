import { execSync } from 'child_process';

const SERVICES = {
  api: 'hermes-dashboard-api.service',
  web: 'hermes-dashboard-web.service',
  tunnel: 'hermes-dashboard-tunnel.service',
};

function systemctl(action, service) {
  try {
    execSync(`systemctl --user ${action} ${service}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function start(service) {
  return systemctl('start', SERVICES[service]);
}

export function stop(service) {
  return systemctl('stop', SERVICES[service]);
}

export function restart(service) {
  return systemctl('restart', SERVICES[service]);
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

export const serviceNames = SERVICES;
