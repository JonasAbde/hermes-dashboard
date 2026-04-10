import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Cache for env lookups
 */
const envCache = new Map();

/**
 * Cache for config lookups
 */
const configCache = new Map();

/**
 * Get HDB config from ~/.hermes/hdb.config.json
 * @returns {Object} Config object
 */
function getConfig() {
  const cacheKey = 'main';
  if (configCache.has(cacheKey)) {
    return configCache.get(cacheKey);
  }

  const HDB_CONFIG_PATH = join(process.env.HOME, '.hermes', 'hdb.config.json');
  const DEFAULT_CONFIG = {
    default_env: 'development',
    confirm_destructive: true,
    log_rotation_threshold_mb: 1,
    json_indent: 2,
    monitor_interval_ms: 2000,
    backup_keep_count: 10,
    auto_backup_before_deploy: true
  };

  if (!existsSync(HDB_CONFIG_PATH)) {
    configCache.set(cacheKey, DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(HDB_CONFIG_PATH, 'utf-8');
    let config = JSON.parse(content);

    // Convert string values to proper types
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        if (value === 'true') {
          config[key] = true;
        } else if (value === 'false') {
          config[key] = false;
        } else if (!isNaN(value) && value.trim() !== '') {
          config[key] = Number(value);
        }
      }
    }

    configCache.set(cacheKey, config);
    return config;
  } catch (error) {
    configCache.set(cacheKey, DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
}

/**
 * Get env config from ~/.hermes/envs/<name>/hdb.env.json
 * @param {string} envName - Environment name (default: 'development')
 * @returns {Object} Env configuration object
 * @throws {Error} If env file doesn't exist or is invalid
 */
export function getEnv(envName = 'development') {
  // Normalize env name
  envName = String(envName || 'development').trim().toLowerCase();

  // If already cached, return it
  if (envCache.has(envName)) {
    return envCache.get(envName);
  }

  // If trying to fall back to development and we're already in development, use cached or create default
  if (envName === 'development' && envCache.has('development')) {
    return envCache.get('development');
  }

  const envPath = join(process.env.HOME, '.hermes/envs', envName, 'hdb.env.json');

  try {
    const content = readFileSync(envPath, 'utf-8');
    const config = JSON.parse(content);

    // Validate required fields
    if (!config.api_port && !config.env_file) {
      throw new Error('Env file is missing required fields (api_port or env_file)');
    }

    envCache.set(envName, config);
    return config;
  } catch (error) {
    // For commands that need env config: throw error to require explicit setup
    // For commands that just resolve env: use development env silently as fallback
    if (error.code === 'ENOENT') {
      // Check if we should throw (for commands that need env config)
      // vs silently fall back to development (for commands that don't)
      const callingModule = getCallingModule();
      if (needsEnvConfig(callingModule)) {
        throw new Error(
          `Environment '${envName}' not found.\n` +
          `Run: hdb config set --env ${envName}\n` +
          `Or: hdb env validate ${envName}`
        );
      }
      // Silently fall back to development
      if (envCache.has('development')) {
        return envCache.get('development');
      }
      // If development not cached yet, create a default development env
      const defaultDev = {
        env_name: 'development',
        api_port: 5174,
        development: true
      };
      envCache.set('development', defaultDev);
      return defaultDev;
    }
    if (error instanceof SyntaxError) {
      throw new Error(
        `Environment '${envName}' has invalid JSON format.\n` +
        `Path: ${envPath}\n` +
        `Error: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Check if the calling module needs env config
 * @param {string} moduleName - Module name from stack trace
 * @returns {boolean} True if module needs env config
 */
function needsEnvConfig(moduleName) {
  const modulesNeedingConfig = [
    'start.js',
    'stop.js',
    'restart.js'
  ];
  return modulesNeedingConfig.some(name => moduleName.includes(name));
}

/**
 * Get the name of the calling module from stack trace
 * @returns {string} Module name or unknown
 */
function getCallingModule() {
  try {
    const stack = new Error().stack;
    if (!stack) return 'unknown';

    // Find the first entry that mentions a source file in our CLI directory
    const lines = stack.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/at\s+(\S+)\s+\(/);
      if (match) {
        const moduleName = match[1];
        // Check if it's one of our commands or CLI files
        if (moduleName.includes('.hermes/dashboard/cli/src/commands/') ||
            moduleName.includes('.hermes/dashboard/cli/bin/hdb.js')) {
          return moduleName;
        }
      }
    }
  } catch (error) {
    // If stack trace parsing fails, assume we need env config
    return 'unknown';
  }
  return 'unknown';
}

/**
 * Resolve environment name with priority:
 * 1. Command-line --env flag (highest)
 * 2. hdb config default_env (medium)
 * 3. Default development (lowest)
 * @param {string} commandLineEnv - Env from command line
 * @returns {string} Resolved environment name
 */
export function resolveEnv(commandLineEnv) {
  // Priority 1: Command-line --env override (highest)
  if (commandLineEnv) {
    return String(commandLineEnv).trim().toLowerCase();
  }

  // Priority 2: Config default_env (medium)
  const config = getConfig();
  if (config && config.default_env) {
    return String(config.default_env).trim().toLowerCase();
  }

  // Priority 3: Default development (lowest)
  return 'development';
}

/**
 * Check if environment file exists
 * @param {string} envName - Environment name
 * @returns {boolean} True if env file exists
 */
export function envExists(envName) {
  const envPath = join(process.env.HOME, '.hermes/envs', envName, 'hdb.env.json');
  try {
    existsSync(envPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate environment exists and is valid
 * @param {string} envName - Environment name
 * @returns {Object} Validation result { valid: boolean, envName: string }
 */
export function validateEnv(envName) {
  try {
    getEnv(envName);
    return { valid: true, envName };
  } catch (error) {
    return { valid: false, envName, error: error.message };
  }
}

/**
 * List all available environments
 * @returns {string[]} Array of environment names
 */
export function listEnvs() {
  try {
    const envsDir = join(process.env.HOME, '.hermes/envs');
    const entries = require('fs').readdirSync(envsDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch {
    return [];
  }
}

/**
 * Clear env cache (useful for testing or after setting a new env)
 */
export function clearCache() {
  envCache.clear();
  configCache.clear();
}
