import { log, spinner, header, json } from '../lib/logger.js';
import { restartService, getPid } from '../lib/services.js';
import { waitForPort } from '../lib/ports.js';
import { resolveEnv, getEnv } from '../lib/env.js';

export default async function restart(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'}`);

  // Resolve env name
  const envName = resolveEnv(opts.env);
  try {
    getEnv(envName);
  } catch (error) {
    log.error('Environment validation failed');
    console.error(error.message);
    process.exit(2);
  }

  const services = ['api', 'web', 'proxy', 'gateway'];
  const result = {
    services: {},
    errors: []
  };

  for (const service of services) {
    const pid = getPid(service);
    if (pid) {
      try {
        stopService(service);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for cleanup

        await withSpinner(`Restarting ${service}...`, opts, async () => {
          startService(service);
          if (!opts.json) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for startup
          }
        });

        result.services[service] = { action: 'restarted', pid: getPid(service) };
        if (!opts.json) log.dim(`Restarted ${service} (PID ${getPid(service)})`);
      } catch (error) {
        result.services[service] = { action: 'failed', error: error.message };
        result.errors.push(`${service}: ${error.message}`);
        if (!opts.json) log.warn(`Failed to restart ${service}: ${error.message}`);
      }
    } else {
      result.services[service] = { action: 'skipped', reason: 'not running' };
      if (!opts.json) log.dim(`${service} was not running`);
    }
  }

  // Handle tunnel
  if (opts.tunnel) {
    try {
      stopTunnel();
      if (!opts.json) log.dim('Stopped tunnel');
      setTimeout(() => {
        startTunnel();
        if (!opts.json) log.dim('Started tunnel');
      }, 1000);
      result.services.tunnel = { action: 'restarted' };
    } catch (error) {
      result.services.tunnel = { action: 'failed', error: error.message };
      if (!opts.json) log.warn(`Failed to restart tunnel: ${error.message}`);
    }
  }

  if (opts.json) {
    json(result);
    if (result.errors.length > 0) process.exit(1);
    return;
  }

  if (result.errors.length > 0) {
    log.dim('');
    log.error(`Failed: ${result.errors.join(', ')}`);
    process.exit(1);
  }

  log.dim('');
  log.success('Services restarted');
}

function getVersion() {
  try {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const pkgPath = join(process.env.HOME, '.hermes/dashboard/cli/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '?';
  }
}

function stopService(service) {
  const { execSync } = require('child_process');
  const pid = getPid(service);
  if (pid) {
    execSync(`kill -TERM ${pid}`, { stdio: 'ignore' });
  }
}

function startService(service) {
  const { readFileSync } = require('fs');
  const { join } = require('path');
  const pkgPath = join(process.env.HOME, '.hermes/dashboard/cli/package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const pid = require('child_process').fork(
    join(process.env.HOME, '.hermes/dashboard/cli/node_modules/@hermes/dashboard/cli/dist/main.js'),
    ['--start', service],
    { stdio: 'pipe' }
  );
}

function stopTunnel() {
  const { execSync } = require('child_process');
  try {
    execSync('pkill -f "hermes-dashboard.*tunnel"', { stdio: 'ignore' });
  } catch {
    // Tunnel not running, ignore
  }
}

function startTunnel() {
  const { readFileSync } = require('fs');
  const { join } = require('path');
  const pkgPath = join(process.env.HOME, '.hermes/dashboard/cli/package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  require('child_process').fork(
    join(process.env.HOME, '.hermes/dashboard/cli/node_modules/@hermes/dashboard/cli/dist/main.js'),
    ['--tunnel'],
    { stdio: 'pipe' }
  );
}
