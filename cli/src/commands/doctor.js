import { log, header, json } from '../lib/logger.js';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveEnv } from '../lib/env.js';
import { withSpinner } from '../lib/exec.js';
import { getVersion } from '../lib/config.js';
import { buildCommandResult } from '../lib/command-result.js';

export default async function doctor(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'}`);

  // Resolve env name (doesn't require env file to exist)
  const envName = resolveEnv(opts.env);

  if (!opts.json) {
    log.dim(`Environment: ${envName}`);
    log.dim('Checking dependencies...');
  }

  const checks = {
    'Node.js': {
      ok: false,
      version: null,
    },
    'npm': {
      ok: false,
      version: null,
    },
    'ssh': {
      ok: false,
      version: null,
    },
    'fuser': {
      ok: false,
      version: null,
    },
    'curl': {
      ok: false,
      version: null,
    },
    'git': {
      ok: false,
      version: null,
    },
    'systemctl': {
      ok: false,
      version: null,
    },
  };

  // Check Node.js
  try {
    const nodeVersion = process.version;
    checks['Node.js'].ok = true;
    checks['Node.js'].version = nodeVersion;
  } catch (e) {
    checks['Node.js'].ok = false;
  }

  // Check npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    checks['npm'].ok = true;
    checks['npm'].version = npmVersion;
  } catch (e) {
    checks['npm'].ok = false;
  }

  // Check ssh
  try {
    const sshVersion = execSync('ssh -V 2>&1', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    checks['ssh'].ok = true;
    checks['ssh'].version = sshVersion;
  } catch (e) {
    checks['ssh'].ok = false;
  }

  // Check fuser
  try {
    const fuserVersion = execSync('fuser --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    checks['fuser'].ok = true;
    checks['fuser'].version = fuserVersion;
  } catch (e) {
    checks['fuser'].ok = false;
  }

  // Check curl
  try {
    const curlVersion = execSync('curl --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    checks['curl'].ok = true;
    checks['curl'].version = curlVersion.split(' ')[0];
  } catch (e) {
    checks['curl'].ok = false;
  }

  // Check git
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    checks['git'].ok = true;
    checks['git'].version = gitVersion.split(' ')[0];
  } catch (e) {
    checks['git'].ok = false;
  }

  // Check systemctl
  try {
    const systemctlVersion = execSync('systemctl --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    checks['systemctl'].ok = true;
    checks['systemctl'].version = systemctlVersion.split(' ')[0];
  } catch (e) {
    checks['systemctl'].ok = false;
  }

  const allOk = Object.values(checks).every(c => c.ok);

  if (opts.json) {
    json(buildCommandResult({
      command: 'doctor',
      ok: allOk,
      status: allOk ? 'ok' : 'warning',
      payload: {
        checks,
        allOk,
      },
    }));
  } else {
    log.dim('');
    for (const [name, check] of Object.entries(checks)) {
      if (check.ok) {
        log.success(`${name}: ${check.version}`);
      } else {
        log.error(`${name}: NOT FOUND`);
      }
    }
    log.dim('');
    if (allOk) {
      log.success('All dependencies OK');
    } else {
      log.error('Some dependencies missing');
    }
  }
}
