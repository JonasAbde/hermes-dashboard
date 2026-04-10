import { execSync } from 'child_process';
import { log, header, json } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function format(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Format`);

  const root = getDashboardRoot();
  const command = opts.check ? 'npx prettier --check .' : 'npm run format';

  if (opts.json) {
    try {
      execSync(command, { cwd: root, stdio: 'pipe' });
      json({ formatted: true, check: !!opts.check });
    } catch {
      json({ formatted: false, check: !!opts.check });
      process.exit(1);
    }
  } else {
    try {
      execSync(command, { cwd: root, stdio: 'inherit' });
      log.success(opts.check ? 'All files formatted' : 'Code formatted');
    } catch {
      log.error(opts.check ? 'Format check failed — run "hdb format" to fix' : 'Format failed');
      process.exit(1);
    }
  }
}
