import { execSync } from 'child_process';
import { log, header } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';
import { withSpinner, jsonOrHuman } from '../lib/exec.js';

export default async function build(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Build`);

  const root = getDashboardRoot();

  try {
    const duration = await withSpinner('Building...', opts, async () => {
      const start = Date.now();
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
      return Date.now() - start;
    });
    jsonOrHuman(opts, { success: true, duration });
  } catch (e) {
    log.error(e.stderr?.toString() || e.message);
    jsonOrHuman(opts, { success: false });
    process.exit(1);
  }
}
