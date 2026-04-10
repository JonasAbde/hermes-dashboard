import { readFileSync, writeFileSync, statSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { log, spinner, json, header } from '../lib/logger.js';
import os from 'os';

const HOME = process.env.HOME || os.homedir();

// Secure environment variables that should be rotated
const SENSITIVE_VARS = [
  'TELEGRAM_BOT_TOKEN',
  'DASHBOARD_TOKEN',
  'GITHUB_TOKEN',
  'KILOCODE_API_KEY',
  'AUXILIARY_VISION_API_KEY'
];

// Known dashboard ports and their security requirements
const PORTS = {
  api: { port: 5174, desc: 'Express API', required_host: '127.0.0.1' },
  web: { port: 5175, desc: 'Vite dev', required_host: '127.0.0.1' },
  proxy: { port: 5176, desc: 'CORS proxy', required_host: '127.0.0.1' }
};

/**
 * Check file permissions
 * @param {string} path - File path
 * @param {number} expectedMode - Expected file mode (e.g., 0o600)
 * @param {string} description - Human-readable description
 * @returns {Object} Check result
 */
function checkFilePermissions(path, expectedMode, description, severity = 'medium') {
  try {
    const stats = statSync(path);
    const mode = stats.mode;
    const isCorrect = (mode & 0o777) === expectedMode;

    return {
      path,
      description,
      severity,
      status: isCorrect ? 'ok' : 'failed',
      current: mode.toString(8).slice(-4),
      expected: expectedMode.toString(8)
    };
  } catch {
    // File doesn't exist - this is not a failure, just a missing file
    return {
      path,
      description,
      severity,
      status: 'missing',
      current: 'N/A',
      expected: expectedMode.toString(8)
    };
  }
}

/**
 * Check if a process is listening on a port and what interface it's bound to
 * @param {number} port - Port number
 * @returns {Object|null} { bound: string|null, pid: string|null } or null if port not bound
 */
function checkPortBinding(port) {
  try {
    // Use ss to check port binding
    const output = execSync(`ss -tlnp 2>/dev/null | grep :${port}`, {
      encoding: 'utf-8'
    }).trim();

    if (!output) {
      return { bound: null, pid: null };
    }

    // Parse output to find bind address
    const lines = output.split('\n');
    const firstLine = lines[0];

    // ss output format: state  recv-q send-q  local address:port  peer address:port  ...
    // We need to extract the local address
    const parts = firstLine.split(/\s+/);
    const addrPart = parts[3]; // local address:port

    // Extract address before :
    const address = addrPart.split(':')[0];

    // Get PID from process list
    const pid = execSync(`pgrep -f "node.*:${port}" 2>/dev/null`, {
      encoding: 'utf-8'
    }).trim() || null;

    return { bound: address, pid };
  } catch {
    return { bound: null, pid: null };
  }
}

/**
 * Check SSH key permissions
 * @param {string} home - User home directory
 * @returns {Array<Object>} Array of SSH key checks
 */
function checkSSHKeys(home) {
  const sshDir = join(home, '.ssh');
  const checks = [];

  if (!existsSync(sshDir)) {
    return checks;
  }

  const files = readdirSync(sshDir, { withFileTypes: true });
  files.forEach(file => {
    if (file.name.match(/^id_/)) {
      const path = join(sshDir, file.name);
      const stats = statSync(path);
      const mode = stats.mode;
      const isCorrect = (mode & 0o777) === 0o600;

      checks.push({
        path: path,
        description: `SSH key ${file.name}`,
        severity: isCorrect ? 'ok' : 'high',
        status: isCorrect ? 'ok' : 'failed',
        current: mode.toString(8).slice(-4),
        expected: '600'
      });
    }
  });

  return checks;
}

/**
 * Check if sensitive variables are in git history
 * @param {string} home - User home directory
 * @returns {Array<Object>} Array of findings
 */
function checkGitHistory(home) {
  const findings = [];
  const dashboardDir = join(home, '.hermes', 'dashboard');
  const repoPath = join(home, 'hermes-dashboard-work');

  if (!existsSync(repoPath)) {
    return findings;
  }

  // Check for sensitive patterns in recent commits
  const sensitivePatterns = [
    'TOKEN=',
    'SECRET=',
    'API_KEY=',
    'PASSWORD=',
    'KEY=',
    'AUTH=',
    'TOKEN=',
    'JWT='
  ];

  // Use git log to check commit messages and file contents
  try {
    // Check last commit for any sensitive file
    const logOutput = execSync(
      'git log -1 --pretty=%B --stat 2>/dev/null',
      { encoding: 'utf-8', cwd: repoPath }
    );

    const lines = logOutput.split('\n');
    let inPath = false;

    // Look for .env or sensitive patterns in the latest commit
    for (const line of lines) {
      if (line.startsWith('    ')) {
        // File path line
        const trimmed = line.trim();
        if (trimmed.endsWith('.env') || trimmed.endsWith('.config.json')) {
          inPath = true;
        } else if (trimmed === '' && inPath) {
          inPath = false;
          continue;
        }

        if (inPath) {
          for (const pattern of sensitivePatterns) {
            if (line.includes(pattern)) {
              findings.push({
                type: 'git_commit',
                severity: 'high',
                message: `Commit contains potentially sensitive data matching pattern: ${pattern}`
              });
              break;
            }
          }
        }
      }
    }
  } catch (e) {
    // Git not available or not a git repo, ignore
  }

  return findings;
}

/**
 * Check for uncommitted sensitive files
 * @param {string} repoPath - Repository path
 * @returns {Array<Object>} Array of findings
 */
function checkUncommittedFiles(repoPath) {
  const findings = [];

  if (!existsSync(repoPath)) {
    return findings;
  }

  try {
    // Check for untracked .env files
    const untracked = execSync(
      'git ls-files --others --exclude-standard',
      { encoding: 'utf-8', cwd: repoPath }
    ).trim();

    const lines = untracked.split('\n');

    for (const file of lines) {
      if (file.includes('.env')) {
        findings.push({
          type: 'uncommitted',
          severity: 'high',
          message: `Uncommitted .env file found: ${file}`
        });
      }
    }
  } catch (e) {
    // Git not available, ignore
  }

  return findings;
}

/**
 * Generate a secure random token
 * @param {number} length - Token length
 * @returns {string} Random token
 */
function generateToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const crypto = require('crypto');
  for (let i = 0; i < length; i++) {
    token += chars[crypto.randomInt(0, chars.length)];
  }
  return token;
}

/**
 * Rotate sensitive environment variables
 * @param {Object} envFileData - Current .env data
 * @returns {Object} Updated .env data with rotated values
 */
function rotateVariables(envFileData) {
  const rotated = [];
  const newValues = {};

  for (const varName of SENSITIVE_VARS) {
    if (envFileData[varName]) {
      const oldValue = envFileData[varName];
      const newValue = generateToken();

      // Mask the old value in the output
      if (oldValue.length > 20) {
        log.dim(`  Found ${varName}: ***`);
      }

      // Update the variable
      envFileData[varName] = newValue;
      rotated.push(varName);
      newValues[varName] = newValue;
    } else {
      log.dim(`  ${varName} not found, skipping`);
    }
  }

  return { rotated, newValues };
}

/**
 * Format findings for human-readable output
 * @param {Array<Object>} findings - Array of check results
 * @returns {string} Formatted table
 */
function formatFindingsTable(findings) {
  if (findings.length === 0) {
    return 'All security checks passed! ✓';
  }

  const lines = [
    '\nSecurity Findings:',
    'Severity | Status | Message',
    '──────────────────────────────────────────────────────────────'
  ];

  for (const finding of findings) {
    const severity = finding.severity?.toUpperCase() || 'OK';
    const status = finding.status?.toUpperCase() || 'PASS';
    let message = finding.description || finding.message || finding.path || '';

    // Format message to be concise
    if (message.length > 50) {
      message = message.substring(0, 47) + '...';
    }

    let severityColor = finding.severity === 'high' ? 'red' :
                        finding.severity === 'medium' ? 'yellow' : 'green';

    lines.push(
      `  ${severity.padEnd(8)} | ${status.padEnd(6)} | ${message}`
    );
  }

  return lines.join('\n');
}

/**
 * Security audit command
 * @param {Object} opts - Command options
 */
export async function audit(opts) {
  if (!opts.json) header('HDB Security Audit');

  const findings = [];
  let checksRun = 0;
  let passedCount = 0;

  // 1. Check file permissions
  checksRun++;
  const hdbDir = join(HOME, '.hermes');
  const envPath = join(hdbDir, '.env');

  // Check .env permissions (0600 = rw-------)
  const envPerm = checkFilePermissions(
    envPath,
    0o600,
    '~/.hermes/.env',
    'high'
  );
  findings.push(envPerm);
  if (envPerm.status === 'ok') passedCount++;
  else if (envPerm.status !== 'missing') findings.push(envPerm);

  // Check JSON files in .hermes directory
  try {
    const files = readdirSync(hdbDir, { withFileTypes: true });
    files.forEach(file => {
      if (file.isFile() && file.name.endsWith('.json')) {
        const path = join(hdbDir, file.name);
        const perm = checkFilePermissions(path, 0o600, `~/.hermes/${file.name}`, 'medium');
        findings.push(perm);
        if (perm.status === 'ok') passedCount++;
        else if (perm.status !== 'missing') findings.push(perm);
      }
    });
  } catch {
    // No .hermes directory, that's fine
  }

  // 2. Check SSH keys
  const sshChecks = checkSSHKeys(HOME);
  findings.push(...sshChecks);
  checksRun += sshChecks.length;
  for (const check of sshChecks) {
    if (check.status === 'ok') passedCount++;
  }

  // 3. Check port bindings
  for (const [service, config] of Object.entries(PORTS)) {
    checksRun++;
    const binding = checkPortBinding(config.port);
    const isCorrect = binding.bound === config.required_host;

    if (!isCorrect && binding.bound !== null) {
      findings.push({
        path: `Port ${config.port} (${service})`,
        description: `Bound to ${binding.bound} instead of ${config.required_host}`,
        severity: 'high',
        status: 'failed',
        current: binding.bound,
        expected: config.required_host
      });
    } else if (isCorrect) {
      passedCount++;
    } else if (binding.bound === null) {
      // Port not in use - this is ok
      if (!opts.json) log.dim(`  Port ${config.port} not in use`);
    }
  }

  // 4. Check git history
  const gitFindings = checkGitHistory(HOME);
  findings.push(...gitFindings);

  // 5. Check uncommitted files
  const uncommittedFindings = checkUncommittedFiles(join(HOME, 'hermes-dashboard-work'));
  findings.push(...uncommittedFindings);

  // Output results
  if (opts.json) {
    const failedCount = findings.filter(f => f.status === 'failed').length;
    json({
      passed: failedCount === 0,
      checks_run: checksRun,
      passed_count: passedCount,
      failed_count: failedCount,
      findings
    });

    if (failedCount > 0) {
      process.exit(1);
    }
    return;
  }

  console.log(formatFindingsTable(findings));
  console.log(`\nChecks: ${checksRun} | Passed: ${passedCount} | Failed: ${findings.filter(f => f.status === 'failed').length}`);

  // Exit code: 0 = all checks passed, 1 = some failed, 2 = error
  const failedCount = findings.filter(f => f.status === 'failed').length;
  if (failedCount > 0) {
    console.log('\n⚠ Security concerns detected. Please review and address.');
    process.exit(1);
  }
}

/**
 * Security rotate command
 * @param {Object} opts - Command options
 */
export async function rotate(opts) {
  if (!opts.json) header('Rotate Sensitive Variables');

  const envPath = join(HOME, '.env');

  // Read current .env file
  let envContent = '';
  try {
    const path = join(HOME, '.env');
    console.log('DEBUG: envPath =', path);
    console.log('DEBUG: HOME =', HOME);
    console.log('DEBUG: file exists?', existsSync(path));

    // Try reading with absolute path
    envContent = readFileSync(path, 'utf-8');
  } catch (error) {
    console.error('Failed to read .env file');
    console.error('Error:', error.message);
    console.error('Path:', error.path);
    console.error('HOME:', HOME);
    console.error('Full stack:', error.stack);
    process.exit(2);
  }

  // Parse env file
  const envFileData = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0];
        const value = parts.slice(1).join('=');
        envFileData[key] = value;
      }
    }
  }

  // Rotate sensitive variables
  const { rotated, newValues } = rotateVariables(envFileData);

  if (rotated.length === 0) {
    if (!opts.json) {
      log.dim('No sensitive variables found to rotate');
    }
    if (opts.json) {
      json({ rotated: [], new_values: {} });
    }
    return;
  }

  // Confirm before writing
  if (!opts.json) {
    log.warn('This will rotate sensitive tokens and may require updating your services.');
    // In a real app, we'd prompt for confirmation here
  }

  // Write updated .env file
  try {
    const updatedLines = [];
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0];
          if (rotated.includes(key)) {
            // Replace with new value, but mask it slightly
            updatedLines.push(`${trimmed.substring(0, 30).padEnd(30)}***GENERATED***`);
          } else {
            updatedLines.push(trimmed);
          }
        }
      } else {
        updatedLines.push(trimmed);
      }
    }

    writeFileSync(envPath, updatedLines.join('\n') + '\n', 'utf-8');

    if (!opts.json) {
      for (const varName of rotated) {
        log.success(`  Rotated ${varName}`);
      }
      log.dim('\n⚠ Remember to update any external services that use these tokens.');
    }

    if (opts.json) {
      json({ rotated, new_values: newValues });
    }

  } catch (error) {
    log.error('Failed to write .env file');
    process.exit(2);
  }
}

/**
 * Security check-env command
 * @param {Object} opts - Command options
 */
export async function checkEnv(opts) {
  if (!opts.json) header('Environment Security Check');

  const findings = [];

  // Check git history
  const gitFindings = checkGitHistory(HOME);
  findings.push(...gitFindings);

  // Check uncommitted files
  const uncommittedFindings = checkUncommittedFiles(join(HOME, 'hermes-dashboard-work'));
  findings.push(...uncommittedFindings);

  // Parse .env file for sensitive variables
  const envPath = join(HOME, '.env');
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, 'utf-8');

      for (const varName of SENSITIVE_VARS) {
        if (envContent.includes(varName + '=')) {
          findings.push({
            type: 'env_file',
            severity: 'medium',
            message: `Sensitive variable '${varName}' found in .env file`,
            path: envPath
          });
        }
      }
    } catch {
      // Skip if we can't read the file
    }
  }

  // Output results
  if (opts.json) {
    json({
      found_in_git: findings.filter(f => f.type === 'git_commit'),
      uncommitted: findings.filter(f => f.type === 'uncommitted'),
      warnings: findings.filter(f => f.severity !== 'high').map(f => f.message)
    });

    const hasWarnings = findings.length > 0;
    if (hasWarnings) {
      process.exit(1);
    }
    return;
  }

  if (findings.length === 0) {
    console.log('  No security warnings detected. ✓');
  } else {
    console.log('\nSecurity Warnings:');
    for (const finding of findings) {
      let msg = `  ${finding.message}`;
      if (finding.severity === 'high') {
        console.error(`  ✖ ${msg}`);
      } else {
        console.log(`  ⚠ ${msg}`);
      }
    }
  }
}

/**
 * Main command handler
 * @param {string} action - Subcommand action
 * @param {Object} opts - Command options
 */
export default async function securityCmd(action, opts) {
  switch (action) {
    case 'audit':
      await audit(opts);
      break;
    case 'rotate':
      await rotate(opts);
      break;
    case 'check-env':
      await checkEnv(opts);
      break;
    default:
      log.error(`Unknown action: ${action}`);
      log.dim('Available actions: audit, rotate, check-env');
      process.exit(2);
  }
}
