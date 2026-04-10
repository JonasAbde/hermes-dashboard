import { execSync } from 'child_process';
import { log, header } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function format(opts) {
  const version = getVersion();
  header(`Hermes Dashboard v${version || '?'} — Format`);

  const root = getDashboardRoot();
  try {
    execSync('npm run format', { cwd: root, stdio: 'inherit' });
    log.success('Code formatted');
  } catch {
    log.error('Format failed');
    process.exit(1);
  }
}
