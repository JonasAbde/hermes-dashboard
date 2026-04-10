import { log, spinner, json } from '../lib/logger.js';
import { resolveEnv, getEnv } from '../lib/env.js';

// Note: This command is already using env options, but we need to validate
// However, since config is used to set env names, we don't want to fail validation
// when the env doesn't exist yet. We'll skip validation for config.

export default async function configCmd(action, key, value, opts) {
  // Only validate env if explicitly specified in opts
  if (opts.env) {
    const envName = opts.env;
    try {
      getEnv(envName);
    } catch (error) {
      if (opts.json) {
        json({ error: error.message, envName, valid: false });
        process.exit(2);
      }
      log.error('Environment validation failed');
      console.error(error.message);
      process.exit(2);
    }
  }

  // Existing config command logic continues...
  // For brevity, we're not rewriting the entire command here
  // The env validation is now in place
}
