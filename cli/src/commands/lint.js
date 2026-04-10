import { execSync } from 'child_process';
import { log, header, json } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';

export default async function lint(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'} — Lint`);

  const root = getDashboardRoot();
  const cmd = opts.fix ? 'npx eslint src/ api/ --fix' : 'npm run lint';

  try {
    const output = execSync(cmd, { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (opts.json) {
      json({ passed: true });
    } else {
      if (output) process.stdout.write(output);
      log.success('Lint passed');
    }
  } catch (e) {
    const output = e.stderr?.toString() || e.stdout?.toString() || '';
    if (opts.json) {
      const fixable = output.includes('fixable') || output.includes('--fix');
      json({ passed: false, fixable });
    } else {
      if (output) process.stderr.write(output);
      log.error('Lint failed');
    }
    process.exit(1);
  }
}
