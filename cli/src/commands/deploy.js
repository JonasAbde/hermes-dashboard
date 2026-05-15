import { log, spinner, header, json } from '../lib/logger.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveEnv } from '../lib/env.js';
import { withSpinner } from '../lib/exec.js';
import { getVersion } from '../lib/config.js'


export default async function deploy(opts) {
  const version = getVersion();
  if (!opts.json) header(`Hermes Dashboard v${version || '?'}`);

  // Resolve env name (doesn't require env file to exist)
  const envName = resolveEnv(opts.env);

  // Build
  await withSpinner(`Building for environment: ${envName}...`, opts, async () => {
    const { execSync } = require('child_process');
    execSync('npm run build', { stdio: 'inherit' });
  });

  // Stop services
  await withSpinner('Stopping services...', opts, async () => {
    const { execSync } = require('child_process');
    execSync('npm run stop', { stdio: 'inherit' });
  });

  // Start services
  await withSpinner('Starting services...', opts, async () => {
    const { execSync } = require('child_process');
    execSync('npm run start', { stdio: 'inherit' });
  });

  if (!opts.json) {
    log.dim('');
    log.success(`Deployed to environment: ${envName}`);
  }
}


