import { execSync } from 'child_process';
import { log, header } from '../lib/logger.js';

function checkCmd(name, cmd) {
  try {
    const out = execSync(`${cmd} 2>&1`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return { ok: true, version: out.split('\n')[0].trim() };
  } catch {
    return { ok: false, version: null };
  }
}

export default async function doctor(opts) {
  header('Hermes Dashboard — Doctor');

  const checks = [
    ['Node.js', checkCmd('node', 'node --version')],
    ['npm', checkCmd('npm', 'npm --version')],
    ['ssh', checkCmd('ssh', 'ssh -V')],
    ['fuser', checkCmd('fuser', 'fuser --version')],
    ['curl', checkCmd('curl', 'curl --version')],
    ['git', checkCmd('git', 'git --version')],
    ['systemctl', checkCmd('systemctl', 'systemctl --version')],
  ];

  let allOk = true;
  for (const [name, result] of checks) {
    if (result.ok) {
      log.success(`${name}: ${result.version}`);
    } else {
      log.error(`${name}: NOT FOUND`);
      allOk = false;
    }
  }

  // Node version check
  const nodeVersion = checkCmd('node', 'node --version');
  if (nodeVersion.ok) {
    const major = parseInt(nodeVersion.version.replace('v', ''), 10);
    if (major < 18) {
      log.error(`Node.js version ${nodeVersion.version} — requires >=18`);
      allOk = false;
    }
  }

  log.dim('');
  if (allOk) {
    log.success('All dependencies OK');
  } else {
    log.error('Some dependencies missing');
    process.exit(1);
  }
}
