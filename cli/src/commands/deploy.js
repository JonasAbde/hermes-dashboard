import { execSync } from 'child_process';
import { log, spinner, header, json } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';
import { restart as restartService, getPid } from '../lib/services.js';
import { waitForPort } from '../lib/ports.js';

export default async function deploy(opts) {
  const version = getVersion();
  const root = getDashboardRoot();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Deploy`);

  const result = { success: false, build: false, api: false, web: false };

  // Build
  if (!opts.json) {
    const s1 = spinner('Building...');
    s1.start();
    try {
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
      s1.succeed('Build complete');
      result.build = true;
    } catch (e) {
      s1.fail('Build failed');
      log.error(e.stderr?.toString() || e.message);
      if (opts.json) json(result);
      process.exit(1);
    }
  } else {
    try {
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
      result.build = true;
    } catch {
      json(result);
      process.exit(1);
    }
  }

  // Restart API
  if (!opts.json) {
    const s2 = spinner('Restarting API...');
    s2.start();
    restartService('api');
    if (waitForPort(5174)) {
      s2.succeed(`API restarted (PID ${getPid('api') || '?'})`);
      result.api = true;
    } else {
      s2.fail('API failed to restart');
      if (opts.json) json(result);
      process.exit(1);
    }
  } else {
    restartService('api');
    if (waitForPort(5174)) {
      result.api = true;
    } else {
      json(result);
      process.exit(1);
    }
  }

  // Restart Web
  if (!opts.json) {
    const s3 = spinner('Restarting Vite...');
    s3.start();
    restartService('web');
    if (waitForPort(5175)) {
      s3.succeed('Vite restarted');
      result.web = true;
    } else {
      s3.warn('Vite not responding');
    }
  } else {
    restartService('web');
    if (waitForPort(5175)) {
      result.web = true;
    }
  }

  result.success = result.build && result.api;

  if (opts.json) {
    json(result);
    return;
  }

  log.success('Deploy complete');
}
