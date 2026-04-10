import { log, spinner, header, json } from '../lib/logger.js';
import { stopService, getPid } from '../lib/services.js';
import { resolveEnv, getEnv } from '../lib/env.js';

export default async function stop(opts) {
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

  if (opts.apiOnly && opts.webOnly) {
    log.error('Cannot use --api-only and --web-only together');
    process.exit(1);
  }
  if (opts.proxyOnly && (opts.apiOnly || opts.webOnly)) {
    log.error('Cannot combine --proxy-only with --api-only or --web-only');
    process.exit(1);
  }

  // Determine services to stop
  const servicesToStop = [];

  if (opts.apiOnly || (!opts.webOnly && !opts.proxyOnly && !opts.gateway && !opts.all)) {
    servicesToStop.push('api');
  }

  if (opts.webOnly || (!opts.apiOnly && !opts.proxyOnly && !opts.gateway && !opts.all)) {
    servicesToStop.push('web');
  }

  if (opts.proxyOnly || (!opts.apiOnly && !opts.webOnly && !opts.gateway && !opts.all)) {
    servicesToStop.push('proxy');
  }

  if (opts.gateway || (!opts.apiOnly && !opts.webOnly && !opts.proxyOnly && !opts.all)) {
    servicesToStop.push('gateway');
  }

  // Stop services
  const stopped = new Set();
  const failed = [];

  for (const service of servicesToStop) {
    const pid = getPid(service);
    if (pid) {
      try {
        stopService(service);
        if (!opts.json) log.dim(`Stopped ${service} (PID ${pid})`);
        stopped.add(service);
      } catch (error) {
        if (!opts.json) log.warn(`Failed to stop ${service}: ${error.message}`);
        failed.push(service);
      }
    } else {
      if (!opts.json) log.dim(`${service} was not running`);
      stopped.add(service);
    }
  }

  // Tunnel (stop if all other services stopped and --tunnel-only not specified)
  if (servicesToStop.length > 0 && opts.tunnel && !opts.tunnelOnly) {
    try {
      stopTunnel();
      if (!opts.json) log.dim('Stopped tunnel');
      stopped.add('tunnel');
    } catch (error) {
      if (!opts.json) log.warn(`Failed to stop tunnel: ${error.message}`);
    }
  }

  // Tunnel only mode
  if (opts.tunnelOnly) {
    try {
      stopTunnel();
      if (!opts.json) log.dim('Stopped tunnel');
      stopped.add('tunnel');
    } catch (error) {
      if (!opts.json) log.warn(`Failed to stop tunnel: ${error.message}`);
    }
  }

  if (opts.json) {
    json({
      stopped: [...stopped],
      failed: failed
    });
    if (failed.length > 0) process.exit(1);
    return;
  }

  if (failed.length > 0) {
    log.dim('');
    log.error(`Failed to stop: ${failed.join(', ')}`);
    process.exit(1);
  }

  log.dim('');
  log.success('Services stopped');
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

function stopTunnel() {
  const { execSync } = require('child_process');
  try {
    execSync('pkill -f "hermes-dashboard.*tunnel"', { stdio: 'ignore' });
  } catch {
    // Tunnel not running, ignore
  }
}
