import { execSync } from 'child_process';
import { log, header, json } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';
import { withSpinner } from '../lib/exec.js';
import { confirm } from '../lib/confirm.js';

export default async function update(opts) {
  const version = getVersion();
  const root = getDashboardRoot();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Update`);

  const result = { pulled: false, installed: false, built: false, stashed: false };

  // Auto-stash before pull
  let didStash = false;
  try {
    const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8' }).trim();
    if (status && !opts.force) {
      const ok = await confirm('Stash uncommitted changes before update?');
      if (!ok) { log.dim('Cancelled'); process.exit(0); }
    }
    await withSpinner('Checking git status...', opts, (s) => {
      const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8' }).trim();
      if (status) {
        if (s) s.info('Uncommitted changes detected — stashing...');
        execSync('git stash push -m "hdb: auto-stash before update"', { cwd: root, stdio: 'pipe' });
        didStash = true;
        result.stashed = true;
        if (!opts.json) log.dim('  Stashed local changes');
      }
    });
  } catch { /* git status unavailable, skip */ }

  // Pull
  try {
    await withSpinner('Pulling latest...', opts, () => {
      execSync('git pull', { cwd: root, stdio: 'pipe' });
    });
    result.pulled = true;
  } catch (e) {
    log.error(e.stderr?.toString() || e.message);
    json(result);
    process.exit(1);
  }

  // npm install
  try {
    await withSpinner('Installing dependencies...', opts, () => {
      execSync('npm install', { cwd: root, stdio: 'pipe' });
    });
    result.installed = true;
  } catch {
    json(result);
    process.exit(1);
  }

  // Build
  try {
    await withSpinner('Building...', opts, () => {
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
    });
    result.built = true;
  } catch {
    json(result);
    process.exit(1);
  }

  // Try to pop stash
  if (didStash) {
    try {
      const stashList = execSync('git stash list', { cwd: root, encoding: 'utf-8' }).trim();
      if (stashList.includes('hdb: auto-stash')) {
        if (!opts.json) log.dim('Restoring stashed changes...');
        try {
          execSync('git stash pop', { cwd: root, stdio: 'pipe' });
          if (!opts.json) log.success('Stashed changes restored');
        } catch {
          if (!opts.json) log.warn('Stash pop had conflicts — run git stash pop manually');
        }
      }
    } catch {}
  }

  if (opts.json) { json(result); return; }
  log.success('Update complete');
}
