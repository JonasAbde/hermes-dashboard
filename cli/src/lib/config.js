import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
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

export function getPublicTunnelUrlPath() {
  return join(DASHBOARD_ROOT, 'public', 'tunnel-url.txt');
}

export function writePublicTunnelUrl(url) {
  try {
    const filePath = getPublicTunnelUrlPath();
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, url, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function getEnvironment() {
  return process.env.NODE_ENV || 'development';
}

export function isDev() {
  return getEnvironment() === 'development';
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
        let val = trimmed.slice(eq + 1);
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        vars[trimmed.slice(0, eq)] = val;
      }
    }
    return vars;
  } catch {
    return {};
  }
}

export function validateEnv() {
  const vars = getEnvVars();

  // Required: gateway + dashboard auth cannot function without these
  const required = [
    'TELEGRAM_BOT_TOKEN',
    'DASHBOARD_TOKEN',
  ];

  // Recommended: won't block startup but should be present for full functionality
  const recommended = [
    'TELEGRAM_ALLOWED_USERS',
    'CORS_ORIGINS',
    'GITHUB_TOKEN',
  ];

  const missingRequired = required.filter((k) => !vars[k]);
  const missingRecommended = recommended.filter((k) => !vars[k]);

  return {
    vars,
    required,
    recommended,
    missing: missingRequired,
    missingRecommended,
    valid: missingRequired.length === 0,
  };
}
