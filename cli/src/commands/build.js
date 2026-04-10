import { execSync } from 'child_process';
import { log, spinner, header } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function build(opts) {
  const version = getVersion();
  header(`Hermes Dashboard v${version || '?'} — Build`);

  const root = getDashboardRoot();
  const s = spinner('Building...');
  s.start();

  try {
    execSync('npm run build', { cwd: root, stdio: 'pipe' });
    s.succeed('Build complete');
  } catch (e) {
    s.fail('Build failed');
    log.error(e.stderr?.toString() || e.message);
    process.exit(1);
  }
}
