import { join } from 'path';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { log, json, header } from '../lib/logger.js';
import { isPortOpen, waitForPort } from '../lib/ports.js';
import { isTunnelRunning, getTunnelUrl } from '../lib/tunnel.js';
import { isTunnelRunning as isTunnelRunningFromTunnel } from '../lib/tunnel.js';
import { isActive } from '../lib/services.js';
import { getEnv, resolveEnv } from '../lib/env.js';
import { readFileSync as readPkg, existsSync as existsPkg } from 'fs';

// Dependencies to check
const DEPENDENCIES = ['node', 'npm', 'ssh', 'fuser'];

// Required environment variables (examples - can be expanded)
const REQUIRED_ENV_VARS = ['TELEGRAM_BOT_TOKEN', 'DASHBOARD_TOKEN', 'KILOCODE_API_KEY'];

// Health check endpoints
const HEALTH_ENDPOINTS = [
  { name: 'API', url: 'http://localhost:5174/api/health' },
  { name: 'API Ready', url: 'http://localhost:5174/api/ready' },
  { name: 'Web', url: 'http://localhost:5175/api/health' },
  { name: 'Vite Proxy', url: 'http://localhost:5176/api/health' },
  { name: 'Gateway', url: 'http://localhost:8642/health' },
];

/**
 * Check if a dependency exists
 * @param {string} dep - Dependency name
 * @returns {Object} Check result
 */
async function checkDependency(dep) {
  try {
    await new Promise((resolve, reject) => {
      const child = execSync(`${dep} --version`, {
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      resolve(child);
    });
    return { name: dep, found: true, version: null };
  } catch {
    return { name: dep, found: false, version: null };
  }
}

/**
 * Check for specific environment variable
 * @param {string} varName - Environment variable name
 * @returns {Object} Check result
 */
async function checkEnvVar(varName) {
  return {
    name: varName,
    present: varName in process.env,
    value: process.env[varName] ? '***' : null,
  };
}

/**
 * Check backup count
 * @returns {Object} Backup check result
 */
async function checkBackups() {
  const backupDir = join(homedir(), '.hermes', 'backups');
  const backups = [];

  if (!existsSync(backupDir)) {
    return { count: 0, dirExists: false };
  }

  try {
    const entries = readdirSync(backupDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.endsWith('.tar.gz') && existsSync(join(backupDir, `${entry.name}.json`))) {
        const manifestPath = join(backupDir, `${entry.name}.json`);
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        backups.push({
          id: entry.name.replace('.tar.gz', ''),
          created_at: manifest.created_at || new Date(entry.birthtime).toISOString().split('T')[0],
        });
      }
    }
  } catch (e) {
    return { count: 0, error: e.message };
  }

  // Sort by date (oldest first)
  backups.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return {
    count: backups.length,
    backups,
    oldestAgeHours: backups.length > 0 ? getBackupAgeHours(backups[0].created_at) : 0,
  };
}

/**
 * Get backup age in hours
 * @param {string} dateString - ISO date string
 * @returns {number} Age in hours
 */
function getBackupAgeHours(dateString) {
  const created = new Date(dateString);
  const now = new Date();
  const diffMs = now - created;
  return Math.floor(diffMs / (1000 * 60 * 60));
}

/**
 * Main audit function
 * @param {Object} opts - Command options
 */
export default async function audit(opts) {
  const version = getVersion();
  const envName = resolveEnv(opts.env);

  if (!opts.json) {
    header('HDB System Audit');
  }

  // Check services
  const services = await checkServices();

  // Check ports
  const ports = checkPorts();

  // Check health endpoints
  const health = await checkHealthEndpoints();

  // Check dependencies
  const dependencies = await checkDependencies();

  // Check environment variables
  const env = await checkEnvVars();

  // Check security
  const security = await checkSecurity();

  // Check backups
  const backups = await checkBackups();

  // Calculate overall health
  const results = {
    services,
    ports,
    health,
    dependencies,
    env,
    security,
    backups,
    overall: calculateOverallHealth(services, ports, health, security, backups),
  };

  if (opts.json) {
    json(results);
    process.exit(results.overall === 'healthy' ? 0 : 1);
    return;
  }

  // Human-readable output
  log.dim(`Environment: ${envName}\n`);
  log.dim(`Checking: ${Object.keys(services).length} services, ${ports.total} ports, ${health.total} endpoints...\n`);

  // Services
  const serviceIcon = services.total === services.running ? '✔' : '✖';
  log.info(`Services:   ${services.running}/${services.total} running  ${serviceIcon}`);

  // Ports
  const portIcon = ports.total === ports.open ? '✔' : '✖';
  log.info(`Ports:      ${ports.open}/${ports.total} open     ${portIcon}`);

  // Health
  const healthIcon = health.total === health.ok ? '✔' : '✖';
  log.info(`Health:     ${health.ok}/${health.total} endpoints OK ${healthIcon}`);

  // Dependencies
  const depIcon = dependencies.total === dependencies.found ? '✔' : '✖';
  log.info(`Dependencies: ${dependencies.found}/${dependencies.total} found     ${depIcon}`);

  // Env
  const envIcon = env.required_total === env.required_present ? '✔' : '✖';
  log.info(`Env:        ${env.required_present}/${env.required_total} required  ${envIcon}`);

  // Security
  const securityIcon = security.total > 0 ? (security.passed >= security.total * 0.7 ? '✔' : '⚠') : '✔';
  log.info(`Security:   ${security.passed}/${security.total} passed    ${securityIcon}`);

  // Backups
  const backupIcon = backups.count > 0 ? '✔' : '✖';
  log.info(`Backups:    ${backups.count} available ${backupIcon}`);

  if (backups.count > 0 && backups.oldestAgeHours > 0) {
    log.dim(`  (oldest: ${backups.oldestAgeHours}h)`);
  }

  const overallIcon = results.overall === 'healthy' ? '✔' : '⚠';
  console.log();
  log[results.overall === 'healthy' ? 'success' : 'warn'](`Overall: ${results.overall.toUpperCase()} ${overallIcon}`);

  // Exit code: 0=healthy, 1=unhealthy/warnings, 2=error
  const issues = services.missing + ports.missing + health.missing + security.failed + backups.missing;
  if (issues > 0) {
    process.exit(1);
  } else if (results.overall !== 'healthy') {
    process.exit(1);
  }
}

/**
 * Check service status
 * @returns {Object} Service status
 */
async function checkServices() {
  const serviceList = ['api', 'web', 'proxy', 'gateway'];
  const services = {};
  let running = 0;
  let missing = 0;

  for (const service of serviceList) {
    const isRunning = isActive(service);
    const isTunnel = service === 'tunnel';
    services[service] = {
      running: isRunning || (isTunnel && isTunnelRunningFromTunnel()),
      pid: isRunning ? getPid(service) : isTunnel ? getTunnelPid() : null,
    };

    if (services[service].running) running++;
    else missing++;
  }

  services.total = serviceList.length;
  services.running = running;
  services.missing = missing;

  return services;
}

/**
 * Get PID for a service
 * @param {string} service - Service name
 * @returns {number|null} PID or null
 */
function getPid(service) {
  try {
    const { execSync } = require('child_process');
    const out = execSync(`systemctl --user show -p MainPID --value hermes-dashboard-${service}.service`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return out && out !== '0' ? parseInt(out, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Get tunnel PID
 * @returns {number|null} PID or null
 */
function getTunnelPid() {
  try {
    const { execSync } = require('child_process');
    const out = execSync(`pgrep -f "ssh .*localhost.run"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const pid = out.split('\n').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
    return pid.length > 0 ? pid[0] : null;
  } catch {
    return null;
  }
}

/**
 * Check port status
 * @returns {Object} Port status
 */
function checkPorts() {
  const ports = {
    api: 5174,
    web: 5175,
    proxy: 5176,
    gateway: 8642,
  };

  let open = 0;
  let missing = 0;

  for (const [name, port] of Object.entries(ports)) {
    ports[name] = {
      port,
      open: isPortOpen(port),
    };
    if (ports[name].open) open++;
    else missing++;
  }

  ports.total = Object.keys(ports).length;
  ports.open = open;
  ports.missing = missing;

  return ports;
}

/**
 * Check health endpoints
 * @returns {Object} Health check results
 */
async function checkHealthEndpoints() {
  const results = {};
  let ok = 0;
  let missing = 0;

  for (const check of HEALTH_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(check.url, { signal: controller.signal });
      clearTimeout(timer);
      const text = await res.text();
      results[check.name] = {
        url: check.url,
        ok: res.ok,
        data: text ? (text.startsWith('{') ? JSON.parse(text) : text.slice(0, 100)) : null,
      };

      if (res.ok) ok++;
      else missing++;
    } catch {
      results[check.name] = {
        url: check.url,
        ok: false,
        error: 'Connection failed',
      };
      missing++;
    }
  }

  results.total = HEALTH_ENDPOINTS.length;
  results.ok = ok;
  results.missing = missing;

  return results;
}

/**
 * Check dependencies
 * @returns {Object} Dependency results
 */
async function checkDependencies() {
  const results = [];
  let found = 0;

  for (const dep of DEPENDENCIES) {
    const result = await checkDependency(dep);
    results.push(result);
    if (result.found) found++;
  }

  return { results, found, total: DEPENDENCIES.length };
}

/**
 * Check environment variables
 * @returns {Object} Env var results
 */
async function checkEnvVars() {
  const results = [];
  let required_present = 0;

  for (const varName of REQUIRED_ENV_VARS) {
    const result = await checkEnvVar(varName);
    results.push(result);
    if (result.present) required_present++;
  }

  return { results, required_present, required_total: REQUIRED_ENV_VARS.length };
}

/**
 * Check security audit
 * @returns {Object} Security results
 */
async function checkSecurity() {
  try {
    const { exec } = require('child_process');
    const stdout = execSync('node -e "require(\x27./src/commands/security\x27).audit({json:true})"', {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    }).toString();

    const data = JSON.parse(stdout);
    return {
      passed: data.passed_count || data.passed || 0,
      total: data.checks_run || data.total || 0,
      findings: data.findings || [],
      failed: data.failed_count || 0,
    };
  } catch {
    return { passed: 0, total: 0, findings: [], failed: 0 };
  }
}

/**
 * Calculate overall health
 * @param {Object} services - Service status
 * @param {Object} ports - Port status
 * @param {Object} health - Health check results
 * @param {Object} security - Security results
 * @param {Object} backups - Backup status
 * @returns {string} Overall health status
 */
function calculateOverallHealth(services, ports, health, security, backups) {
  // Count issues
  let issues = services.missing + ports.missing + health.missing + security.failed + backups.missing;

  // Critical issues: services down or ports not open
  if (issues > services.total || services.missing > 0) {
    return 'critical';
  }

  // Check for security failures
  if (security.failed > 0) {
    return 'warning';
  }

  // Check for high health failure rate
  if (health.ok < health.total * 0.7) {
    return 'warning';
  }

  // Check for backups missing
  if (backups.count === 0) {
    return 'warning';
  }

  return 'healthy';
}

/**
 * Get version
 * @returns {string} Version string
 */
function getVersion() {
  try {
    const pkgPath = join(process.env.HOME, '.hermes/dashboard/cli/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '?';
  }
}
