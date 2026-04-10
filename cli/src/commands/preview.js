import { spawn } from 'child_process';
import { log, header } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function preview(opts) {
  const version = getVersion();
  header(`Hermes Dashboard v${version || '?'} — Preview`);

  const root = getDashboardRoot();
  log.info('Starting preview (foreground)...');
  log.dim('  Press Ctrl+C to stop\n');

  const proc = spawn('npx', ['vite', 'preview', '--host', '0.0.0.0'], {
    cwd: root,
    stdio: 'inherit',
  });

  process.on('SIGINT', () => {
    proc.kill();
    process.exit(0);
  });
}
