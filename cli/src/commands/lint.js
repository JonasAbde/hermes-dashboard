import { execSync } from 'child_process';
import { log, header } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function lint(opts) {
  const version = getVersion();
  header(`Hermes Dashboard v${version || '?'} — Lint`);

  const root = getDashboardRoot();
  const cmd = opts.fix ? 'npx eslint src/ api/ --fix' : 'npm run lint';

  try {
    execSync(cmd, { cwd: root, stdio: 'inherit' });
    log.success('Lint passed');
  } catch {
    log.error('Lint failed');
    process.exit(1);
  }
}
