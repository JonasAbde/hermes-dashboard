import { execSync } from 'child_process';
import { log, spinner, header } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';
import { restart as restartService, getPid } from '../lib/services.js';
import { waitForPort } from '../lib/ports.js';

export default async function deploy(opts) {
  const version = getVersion();
  const root = getDashboardRoot();
  header(`Hermes Dashboard v${version || '?'} — Deploy`);

  // Build
  const s1 = spinner('Building...');
  s1.start();
  try {
    execSync('npm run build', { cwd: root, stdio: 'pipe' });
    s1.succeed('Build complete');
  } catch (e) {
    s1.fail('Build failed');
    log.error(e.stderr?.toString() || e.message);
    process.exit(1);
  }

  // Restart API
  const s2 = spinner('Restarting API...');
  s2.start();
  restartService('api');
  if (waitForPort(5174)) {
    s2.succeed(`API restarted (PID ${getPid('api') || '?'})`);
  } else {
    s2.fail('API failed to restart');
    process.exit(1);
  }

  // Restart Web
  const s3 = spinner('Restarting Vite...');
  s3.start();
  restartService('web');
  if (waitForPort(5175)) {
    s3.succeed('Vite restarted');
  } else {
    s3.warn('Vite not responding');
  }

  log.success('Deploy complete');
}
