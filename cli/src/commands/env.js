import { log, header } from '../lib/logger.js';
import { getEnvVars, validateEnv } from '../lib/config.js';

export default async function envCmd(opts) {
  header('Environment Config');

  const { vars, missing, valid } = validateEnv();

  if (Object.keys(vars).length === 0) {
    log.warn('No .env file found');
    return;
  }

  log.info(`Variables: ${Object.keys(vars).length}`);

  for (const [key, value] of Object.entries(vars)) {
    const masked = key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')
      ? value.slice(0, 8) + '...'
      : value;
    log.dim(`  ${key}=${masked}`);
  }

  if (missing.length > 0) {
    log.warn(`Missing required: ${missing.join(', ')}`);
  } else {
    log.success('All required variables present');
  }
}
