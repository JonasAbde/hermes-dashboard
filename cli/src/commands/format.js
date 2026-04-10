import { execSync } from 'child_process';
import { log, header, json } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function format(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Format`);

  const root = getDashboardRoot();
  const command = opts.check ? 'npx prettier --check .' : 'npm run format';

  try {
    const output = execSync(command, { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (opts.json) {
      json({ formatted: true, check: !!opts.check });
    } else {
      if (output) process.stdout.write(output);
      log.success(opts.check ? 'All files formatted' : 'Code formatted');
    }
  } catch (e) {
    const output = e.stdout?.toString() || '';
    if (opts.json) {
      json({ formatted: false, check: !!opts.check });
    } else {
      if (output) process.stderr.write(output);
      log.error(opts.check ? 'Format check failed — run "hdb format" to fix' : 'Format failed');
    }
    process.exit(1);
  }
}
