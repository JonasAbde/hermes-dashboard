import { log, spinner, header, json } from '../lib/logger.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveEnv } from '../lib/env.js';
import { withSpinner } from '../lib/exec.js';

export default async function doctor(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'}`);

  // Resolve env name (doesn't require env file to exist)
  const envName = resolveEnv(opts.env);

  log.dim(`Environment: ${envName}`);
  log.dim('Checking dependencies...');
}

function getVersion() {
  try {
    const { readFileSync } = require('fs');
    const pkgPath = join(process.env.HOME, '.hermes/dashboard/cli/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '?';
  }
}
