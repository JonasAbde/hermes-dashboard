import { execSync, spawn } from 'child_process';
import { log, header } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function dev(opts) {
  const version = getVersion();
  header(`Hermes Dashboard v${version || '?'} — Dev Mode`);

  const root = getDashboardRoot();
  log.info('Starting API + Vite dev (foreground)...');
  log.dim('  Press Ctrl+C to stop\n');

  // Start API in background, then Vite in foreground
  const api = spawn('node', ['api/server.js'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  api.stdout.on('data', (d) => process.stdout.write(`  [API] ${d}`));
  api.stderr.on('data', (d) => process.stderr.write(`  [API] ${d}`));

  // Wait for API to be ready
  log.dim('  Waiting for API...');
  execSync('sleep 2');

  const vite = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '5175'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env },
  });

  process.on('SIGINT', () => {
    log.dim('\nStopping...');
    api.kill();
    vite.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    api.kill();
    vite.kill();
    process.exit(0);
  });
}
