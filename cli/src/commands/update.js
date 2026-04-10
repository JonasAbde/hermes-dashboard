import { execSync } from 'child_process';
import { log, spinner, header } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function update(opts) {
  const version = getVersion();
  const root = getDashboardRoot();
  header(`Hermes Dashboard v${version || '?'} — Update`);

  // Auto-stash before pull
  const s1 = spinner('Checking git status...');
  s1.start();
  try {
    const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8' }).trim();
    if (status) {
      s1.info('Uncommitted changes detected — stashing...');
      try {
        execSync('git stash push -m "hdb: auto-stash before update"', { cwd: root, stdio: 'pipe' });
        log.dim('  Stashed local changes');
      } catch {
        s1.fail('Git stash failed');
        process.exit(1);
      }
    } else {
      s1.succeed('Working tree clean');
    }
  } catch {
    s1.warn('Could not check git status');
  }

  // Pull
  const s2 = spinner('Pulling latest...');
  s2.start();
  try {
    execSync('git pull', { cwd: root, stdio: 'pipe' });
    s2.succeed('Pulled latest');
  } catch (e) {
    s2.fail('Git pull failed');
    log.error(e.stderr?.toString() || e.message);
    process.exit(1);
  }

  // npm install
  const s3 = spinner('Installing dependencies...');
  s3.start();
  try {
    execSync('npm install', { cwd: root, stdio: 'pipe' });
    s3.succeed('Dependencies installed');
  } catch {
    s3.warn('npm install had issues');
  }

  // Build
  const s4 = spinner('Building...');
  s4.start();
  try {
    execSync('npm run build', { cwd: root, stdio: 'pipe' });
    s4.succeed('Build complete');
  } catch {
    s4.warn('Build had issues');
  }

  // Try to pop stash
  try {
    const stashList = execSync('git stash list', { cwd: root, encoding: 'utf-8' }).trim();
    if (stashList.includes('hdb: auto-stash')) {
      log.dim('Restoring stashed changes...');
      try {
        execSync('git stash pop', { cwd: root, stdio: 'pipe' });
        log.success('Stashed changes restored');
      } catch {
        log.warn('Stash pop had conflicts — run git stash pop manually');
      }
    }
  } catch {}

  log.success('Update complete');
}
