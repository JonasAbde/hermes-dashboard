import { log, spinner, header, json } from '../lib/logger.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveEnv } from '../lib/env.js';
import { withSpinner } from '../lib/exec.js';

export default async function dev(opts) {
  // Resolve env name (doesn't require env file to exist)
  const envName = resolveEnv(opts.env);

  header(`Development environment: ${envName}`);

  // Build the app
  await withSpinner('Building application...', opts, async () => {
    await import('child_process').then(({ execSync }) => {
      execSync('npm run build', { stdio: 'inherit' });
    });
  });

  // Start in development mode
  await withSpinner('Starting development server...', opts, async () => {
    await import('child_process').then(({ execSync }) => {
      execSync('npm run dev', { stdio: 'inherit' });
    });
  });
}
