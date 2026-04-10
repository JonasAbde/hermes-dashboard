import { log, spinner, header, json } from '../lib/logger.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveEnv, getEnv } from '../lib/env.js';

export default async function tunnel(action, opts) {
  const version = await getVersion();
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

  action = action || 'status';

  if (!opts.json) {
    log.dim(`Tunnel for environment: ${envName}`);
  }

  switch (action) {
    case 'url':
      await handleUrl(opts);
      break;
    case 'restart':
      await handleRestart(opts);
      break;
    case 'status':
      await handleStatus(opts);
      break;
    default:
      log.error(`Unknown tunnel action: ${action}`);
      log.dim('Available actions: status, url, restart');
      process.exit(2);
  }
}

async function handleUrl(opts) {
  try {
    // Check if tunnel is running and get URL
    const { execSync } = await import('child_process');
    const result = execSync('ps aux | grep tunnel', { encoding: 'utf-8' });
    if (result.includes('hermes-dashboard')) {
      log.dim('Tunnel is running, check the tunnel tab for URL');
    } else {
      log.warn('Tunnel is not running');
    }
  } catch (error) {
    log.warn('Tunnel is not running');
  }
}

async function handleRestart(opts) {
  await withSpinner('Restarting tunnel...', opts, async () => {
    try {
      const { execSync } = await import('child_process');
      execSync('pkill -f "hermes-dashboard.*tunnel"', { stdio: 'ignore' });
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Start tunnel in background
      const tunnelPid = execSync('npm run start -- --tunnel-only', {
        stdio: 'pipe',
        detached: true
      });
      log.dim('Tunnel restarted');
    } catch (error) {
      throw new Error('Failed to restart tunnel');
    }
  });
}

async function handleStatus(opts) {
  try {
    const { execSync } = await import('child_process');
    const result = execSync('ps aux | grep tunnel', { encoding: 'utf-8' });
    const isRunning = result.includes('hermes-dashboard');
    if (isRunning) {
      log.success('Tunnel: RUNNING');
    } else {
      log.error('Tunnel: STOPPED');
    }
  } catch (error) {
    log.error('Tunnel: STOPPED');
  }
}

async function getVersion() {
  try {
    const { readFileSync } = await import('fs');
    const pkgPath = join(process.env.HOME, '.hermes/dashboard/cli/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '?';
  }
}
