import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DASHBOARD_ROOT = join(homedir(), '.hermes', 'dashboard');

export function getDashboardRoot() {
  return DASHBOARD_ROOT;
}

export function getLogsDir() {
  return join(DASHBOARD_ROOT, 'logs');
}

export function getPidDir() {
  return join(DASHBOARD_ROOT, 'scripts', '.pids');
}

export function getTunnelUrl() {
  try {
    return readFileSync(join(getPidDir(), 'tunnel.url'), 'utf-8').trim();
  } catch {
    return null;
  }
}

export function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(DASHBOARD_ROOT, 'package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return null;
  }
}

export function getEnvVars() {
  const envPath = join(homedir(), '.hermes', '.env');
  if (!existsSync(envPath)) return {};
  try {
    const content = readFileSync(envPath, 'utf-8');
    const vars = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
      }
    }
    return vars;
  } catch {
    return {};
  }
}

export function validateEnv() {
  const vars = getEnvVars();
  const required = [];
  const missing = required.filter((k) => !vars[k]);
  return { vars, required, missing, valid: missing.length === 0 };
}
