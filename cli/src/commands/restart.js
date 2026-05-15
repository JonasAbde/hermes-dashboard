import { log, header, json } from '../lib/logger.js';
import { restartService } from '../lib/services.js';
import { isPortOpen, KNOWN_PORTS } from '../lib/ports.js';
import { resolveEnv, getEnv } from '../lib/env.js';
import { getVersion } from '../lib/config.js';


export default async function restart(opts) {
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

  const services = ['api', 'web', 'proxy', 'gateway'];
  const result = {
    services: {},
    errors: []
  };

  for (const service of services) {
    const port = KNOWN_PORTS[service]?.port;
    if (!port) continue;

    if (isPortOpen(port)) {
      try {
        // Stop service
        await restartService(service);

        // Wait for restart
        await new Promise(resolve => setTimeout(resolve, 2000));

        result.services[service] = { action: 'restarted', pid: isPortOpen(port) ? port : null };
        if (!opts.json) log.dim(`Restarted ${service} (PID ${isPortOpen(port) ? port : 'unknown'})`);
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
