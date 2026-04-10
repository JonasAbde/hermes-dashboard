import { execSync } from 'child_process';
import { log, spinner, header, json } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function update(opts) {
  const version = getVersion();
  const root = getDashboardRoot();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Update`);

  const result = { pulled: false, installed: false, built: false, stashed: false };

  // Auto-stash before pull
  let didStash = false;
  if (!opts.json) {
    const s1 = spinner('Checking git status...');
    s1.start();
    try {
      const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8' }).trim();
      if (status) {
        s1.info('Uncommitted changes detected — stashing...');
        try {
          execSync('git stash push -m "hdb: auto-stash before update"', { cwd: root, stdio: 'pipe' });
          didStash = true;
          result.stashed = true;
          log.dim('  Stashed local changes');
        } catch {
          s1.fail('Git stash failed');
          if (opts.json) json(result);
          process.exit(1);
        }
      } else {
        s1.succeed('Working tree clean');
      }
    } catch {
      s1.warn('Could not check git status');
    }
  } else {
    try {
      const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8' }).trim();
      if (status) {
        try {
          execSync('git stash push -m "hdb: auto-stash before update"', { cwd: root, stdio: 'pipe' });
          didStash = true;
          result.stashed = true;
        } catch {
          json(result);
          process.exit(1);
        }
      }
    } catch {}
  }

  // Pull
  if (!opts.json) {
    const s2 = spinner('Pulling latest...');
    s2.start();
    try {
      execSync('git pull', { cwd: root, stdio: 'pipe' });
      s2.succeed('Pulled latest');
      result.pulled = true;
    } catch (e) {
      s2.fail('Git pull failed');
      log.error(e.stderr?.toString() || e.message);
      if (opts.json) json(result);
      process.exit(1);
    }
  } else {
    try {
      execSync('git pull', { cwd: root, stdio: 'pipe' });
      result.pulled = true;
    } catch {
      json(result);
      process.exit(1);
    }
  }

  // npm install
  if (!opts.json) {
    const s3 = spinner('Installing dependencies...');
    s3.start();
    try {
      execSync('npm install', { cwd: root, stdio: 'pipe' });
      s3.succeed('Dependencies installed');
      result.installed = true;
    } catch {
      s3.fail('npm install failed');
      process.exit(1);
    }
  } else {
    try {
      execSync('npm install', { cwd: root, stdio: 'pipe' });
      result.installed = true;
    } catch {
      json(result);
      process.exit(1);
    }
  }

  // Build
  if (!opts.json) {
    const s4 = spinner('Building...');
    s4.start();
    try {
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
      s4.succeed('Build complete');
      result.built = true;
    } catch {
      s4.fail('Build failed');
      process.exit(1);
    }
  } else {
    try {
      execSync('npm run build', { cwd: root, stdio: 'pipe' });
      result.built = true;
    } catch {
      process.exit(1);
    }
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

  if (opts.json) {
    json(result);
    return;
  }

  log.success('Update complete');
}
