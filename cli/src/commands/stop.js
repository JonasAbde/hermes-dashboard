import { log, header, json } from '../lib/logger.js';
import { stopService } from '../lib/services.js';
import { isPortOpen, KNOWN_PORTS } from '../lib/ports.js';
import { resolveEnv, getEnv } from '../lib/env.js';
import { getVersion } from '../lib/config.js';


export default async function stop(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'}`);

  // Resolve env name
  const envName = resolveEnv(opts.env);
  try {
    getEnv(envName);
  } catch (error) {
    log.error('Environment validation failed');
    log.error(`Reason: ${error.message}`);
    log.error('Action: use --env to choose a valid environment');
    process.exit(2);
  }

  if (opts.apiOnly && opts.webOnly) {
    log.error('Invalid stop option combination');
    log.error('Reason: --api-only cannot be used together with --web-only');
    log.error('Action: choose only one service selector, or use --all');
    process.exit(2);
  }
  if (opts.proxyOnly && (opts.apiOnly || opts.webOnly)) {
    log.error('Invalid stop option combination');
    log.error('Reason: --proxy-only cannot be combined with --api-only or --web-only');
    log.error('Action: choose only one of --api-only, --web-only, --proxy-only, or --all');
    process.exit(2);
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
    const port = KNOWN_PORTS[service]?.port;
    if (!port) continue;

    const pid = isPortOpen(port) ? port : null;
    if (pid) {
      try {
        await stopService(service);
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



function stopTunnel() {
  const { execSync } = require('child_process');
  try {
    execSync('pkill -f "hermes-dashboard.*tunnel"', { stdio: 'ignore' });
  } catch {
    // Tunnel not running, ignore
  }
}
