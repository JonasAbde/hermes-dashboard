import { execSync } from 'child_process';
import { log, header, json } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function format(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Format`);

  const root = getDashboardRoot();

  if (opts.json) {
    try {
      execSync('npm run format', { cwd: root, stdio: 'pipe' });
      json({ formatted: true });
    } catch {
      json({ formatted: false });
      process.exit(1);
    }
  } else {
    try {
      execSync('npm run format', { cwd: root, stdio: 'inherit' });
      log.success('Code formatted');
    } catch {
      log.error('Format failed');
      process.exit(1);
    }
  }
}
