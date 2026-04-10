import { log, header, json } from '../lib/logger.js';
import { validateEnv, getEnvironment } from '../lib/config.js';

const SENSITIVE_PATTERNS = /password|api_key|private|credential|secret|token/i;

function maskValue(key, value) {
  return SENSITIVE_PATTERNS.test(key) ? value.slice(0, 8) + '...' : value;
}

function showEnv(opts) {
  const { vars, required, recommended, missing, missingRecommended, valid } = validateEnv();
  const environment = getEnvironment();

  if (opts.json) {
    json({ environment, vars, required, recommended, missing, missingRecommended, valid });
    return;
  }

  header('Environment Config');

  log.info(`Environment: ${environment}`);
  log.info(`Variables: ${Object.keys(vars).length}`);

  for (const [key, value] of Object.entries(vars)) {
    log.dim(`  ${key}=${maskValue(key, value)}`);
  }

  if (missing.length > 0) {
    log.warn(`Missing required: ${missing.join(', ')}`);
    process.exit(1);
  } else {
    log.success('All required variables present');
  }

  if (missingRecommended.length > 0) {
    log.warn(`Missing recommended: ${missingRecommended.join(', ')}`);
  } else {
    log.success('All recommended variables present');
  }
}

function listEnv(opts) {
  const { vars } = validateEnv();
  const environment = getEnvironment();

  if (opts.json) {
    json({ environment, names: Object.keys(vars) });
    return;
  }

  header('Environment Variables');

  log.info(`Environment: ${environment}`);
  log.info(`Variables: ${Object.keys(vars).length}`);

  for (const key of Object.keys(vars)) {
    log.dim(`  ${key}`);
  }
}

function validateEnvCmd(opts) {
  const { vars, required, recommended, missing, missingRecommended, valid } = validateEnv();
  const environment = getEnvironment();

  if (opts.json) {
    json({ environment, valid, missing, missingRecommended, total: Object.keys(vars).length });
    return;
  }

  header('Environment Validation');

  log.info(`Environment: ${environment}`);
  log.info(`Total variables: ${Object.keys(vars).length}`);

  if (missing.length > 0) {
    log.error(`Missing required: ${missing.join(', ')}`);
    process.exit(1);
  } else {
    log.success('All required variables present');
  }

  if (missingRecommended.length > 0) {
    log.warn(`Missing recommended: ${missingRecommended.join(', ')}`);
  } else {
    log.success('All recommended variables present');
  }
}

export default async function envCmd(action, opts) {
  // Commander passes opts as first arg when no positional is given
  if (typeof action === 'object') {
    opts = action;
    action = 'show';
  } else if (action === undefined) {
    action = 'show';
  }
  opts = opts || {};

  switch (action) {
    case 'show':
      showEnv(opts);
      break;
    case 'validate':
      validateEnvCmd(opts);
      break;
    case 'list':
      listEnv(opts);
      break;
    default:
      log.error(`Unknown action: ${action}`);
      log.dim('Available actions: show, validate, list');
      process.exit(2);
  }
}
