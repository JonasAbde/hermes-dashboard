import { execSync } from 'child_process';
import { log, header } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function test(opts) {
  const version = getVersion();
  header(`Hermes Dashboard v${version || '?'} — Test`);

  const root = getDashboardRoot();
  const cmd = opts.watch ? 'npm run test:watch' : 'npm run test';

  try {
    execSync(cmd, { cwd: root, stdio: 'inherit' });
  } catch {
    log.error('Tests failed');
    process.exit(1);
  }
}
