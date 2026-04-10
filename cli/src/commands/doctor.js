import { execSync } from 'child_process';
import { log, header, json } from '../lib/logger.js';

function checkCmd(name, cmd) {
  try {
    const out = execSync(`${cmd} 2>&1`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return { ok: true, version: out.split('\n')[0].trim() };
  } catch {
    return { ok: false, version: null };
  }
}

export default async function doctor(opts) {
  if (!opts.json) header('Hermes Dashboard — Doctor');

  const checkDefs = [
    ['Node.js', 'node --version'],
    ['npm', 'npm --version'],
    ['ssh', 'ssh -V'],
    ['fuser', 'fuser --version'],
    ['curl', 'curl --version'],
    ['git', 'git --version'],
    ['systemctl', 'systemctl --version'],
  ];

  const checks = {};
  let allOk = true;

  for (const [name, cmd] of checkDefs) {
    const result = checkCmd(name, cmd);
    checks[name] = result;
    if (!opts.json) {
      if (result.ok) {
        log.success(`${name}: ${result.version}`);
      } else {
        log.error(`${name}: NOT FOUND`);
      }
    }
    if (!result.ok) allOk = false;
  }

  // Node version check
  if (checks['Node.js'] && checks['Node.js'].ok) {
    const major = parseInt(checks['Node.js'].version.replace('v', ''), 10);
    if (major < 18) {
      if (!opts.json) log.error(`Node.js version ${checks['Node.js'].version} — requires >=18`);
      allOk = false;
    }
  }

  if (opts.json) {
    json({ checks, allOk });
    return;
  }

  log.dim('');
  if (allOk) {
    log.success('All dependencies OK');
  } else {
    log.error('Some dependencies missing');
    process.exit(1);
  }
}
