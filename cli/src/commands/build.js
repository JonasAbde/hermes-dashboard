import { execSync } from 'child_process';
import { log, spinner, header, json } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function build(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Build`);

  const root = getDashboardRoot();

  if (!opts.json) {
    const s = spinner('Building...');
    s.start();
    try {
      const start = Date.now();
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
      const duration = Date.now() - start;
      s.succeed('Build complete');
      if (opts.json) json({ success: true, duration });
    } catch (e) {
      s.fail('Build failed');
      log.error(e.stderr?.toString() || e.message);
      if (opts.json) json({ success: false });
      process.exit(1);
    }
  } else {
    try {
      const start = Date.now();
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
      const duration = Date.now() - start;
      json({ success: true, duration });
    } catch {
      json({ success: false });
      process.exit(1);
    }
  }
}
