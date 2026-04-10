import { execSync } from 'child_process';
import { log, header, json } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';
import { restart as restartService, getPid } from '../lib/services.js';
import { waitForPort } from '../lib/ports.js';
import { withSpinner } from '../lib/exec.js';

export default async function deploy(opts) {
  const version = getVersion();
  const root = getDashboardRoot();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Deploy`);

  const result = { success: false, build: false, api: false, web: false };

  // Build
  try {
    await withSpinner('Building...', opts, () => {
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
    });
    result.build = true;
  } catch (e) {
    log.error(e.stderr?.toString() || e.message);
    json(result);
    process.exit(1);
  }

  // Restart API
  try {
    await withSpinner('Restarting API...', opts, () => {
      restartService('api');
      if (!waitForPort(5174)) throw new Error('API failed to restart');
    });
    result.api = true;
  } catch {
    json(result);
    process.exit(1);
  }

  // Restart Web
  await withSpinner('Restarting Vite...', opts, () => {
    restartService('web');
    if (waitForPort(5175)) result.web = true;
  });

  result.success = result.build && result.api;

  if (opts.json) { json(result); return; }
  log.success('Deploy complete');
}
