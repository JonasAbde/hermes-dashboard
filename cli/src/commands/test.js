import { execSync } from 'child_process';
import { log, header, json } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function test(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Test`);

  const root = getDashboardRoot();
  const cmd = opts.watch ? 'npm run test:watch' : 'npm run test';

  if (opts.json) {
    try {
      const out = execSync(cmd, { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      json({ passed: true, results: out });
    } catch (e) {
      json({ passed: false, results: e.stdout?.toString() || e.stderr?.toString() || e.message });
      process.exit(1);
    }
  } else {
    try {
      execSync(cmd, { cwd: root, stdio: 'inherit' });
    } catch {
      log.error('Tests failed');
      process.exit(1);
    }
  }
}
