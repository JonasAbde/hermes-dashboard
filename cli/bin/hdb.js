#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Global error handler — prevents silent crashes
process.on('unhandledRejection', (err) => {
  console.error(chalk.red('✖ Unexpected error:'), err?.message || err);
  if (process.env.DEBUG) console.error(err?.stack);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error(chalk.red('✖ Fatal:'), err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const { isActive } = await import('../src/lib/services.js');
const { isTunnelRunning } = await import('../src/lib/tunnel.js');

program
  .name('hdb')
  .description('Hermes Dashboard CLI — services, dev, ops')
  .version(pkg.version, '-v, --version', 'Print version info')
  .option('--verbose', 'Show verbose version info (config, environment, services)');

// Handle --version --verbose before parsing
if (process.argv.includes('--version') && process.argv.includes('--verbose')) {
  const verboseVersionInfo = getVerboseVersionInfo();
  console.log(`\n${verboseVersionInfo}\n`);
  process.exit(0);
}

// Core lifecycle
program.addHelpText('beforeAll', `
Example:
  $ hdb --version          # Basic version
  $ hdb --version --verbose # Detailed system info
`);

/**
 * Get verbose version information
 * @returns {string} Formatted version info
 */
async function getVerboseVersionInfo() {
  const nodeVersion = process.version;
  const platform = `${process.platform} ${process.arch}`;
  const envName = await getEnvName().catch(() => 'development');
  const configPath = join(process.env.HOME, '.hermes', 'hdb.config.json');
  const configExists = existsSync(configPath);

  // Get dashboard version info
  let dashboardVersion = '?';
  let dashboardCommit = '?';
  let dashboardRunning = 0;
  let dashboardStopped = 0;

  const dashboardPkgPath = join(process.env.HOME, '.hermes/dashboard/package.json');
  const dashboardGitPath = join(process.env.HOME, '.hermes/dashboard/.git');

  try {
    if (existsPkg(dashboardPkgPath)) {
      dashboardVersion = JSON.parse(readFileSync(dashboardPkgPath, 'utf-8')).version;
    }

    if (existsPkg(dashboardGitPath)) {
      try {
        dashboardCommit = execSync('git rev-parse --short HEAD', {
          cwd: join(process.env.HOME, '.hermes/dashboard'),
          encoding: 'utf-8',
        }).trim();
      } catch {
        dashboardCommit = '?';
      }
    }

    // Get service status
    const services = ['api', 'web', 'proxy', 'gateway', 'tunnel'];

    for (const service of services) {
      const isRunning = isActive(service);
      const isTunnel = service === 'tunnel';

      if (isRunning || (isTunnel && isTunnelRunning())) {
        dashboardRunning++;
      } else {
        dashboardStopped++;
      }
    }
  } catch {
    // Silently fail if we can't get version info
  }

  // Build output
  const lines = [];

  // Basic version
  lines.push(`hdb v${pkg.version}`);

  // System info
  lines.push(`node ${nodeVersion}`);
  lines.push(`platform ${platform}`);

  // Config
  lines.push(`config: ${configPath}`);
  if (configExists) {
    lines.push(`env: ${envName}`);
  } else {
    lines.push(`env: default`);
  }

  // Dashboard
  lines.push(`dashboard: v${dashboardVersion} (${dashboardCommit})`);

  // Services
  lines.push(`services: ${dashboardRunning} running, ${dashboardStopped} stopped`);

  return lines.join('\n');
}

/**
 * Get environment name
 * @returns {string} Environment name
 */
async function getEnvName() {
  try {
    const { getEnv } = await import('../src/lib/env.js');
    const envConfig = await getEnv('development');
    const envName = envConfig.default_env || 'development';
    return envName;
  } catch {
    return 'development';
  }
}

// Core lifecycle
program.command('start')
  .description('Start dashboard services')
  .option('--env <name>', 'Environment name')
  .option('--no-tunnel', 'Skip tunnel startup')
  .option('--api-only', 'Start only API server')
  .option('--web-only', 'Start only Vite dev server')
  .option('--proxy-only', 'Start only CORS proxy')
  .option('--gateway', 'Also start gateway service')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/start.js');
    await cmd(opts);
  });

program.command('stop')
  .description('Stop dashboard services')
  .option('--env <name>', 'Environment name')
  .option('--api-only', 'Stop only API server')
  .option('--web-only', 'Stop only Vite dev server')
  .option('--proxy-only', 'Stop only CORS proxy')
  .option('--tunnel-only', 'Stop only tunnel')
  .option('--gateway', 'Also stop gateway service')
  .option('--force', 'Skip confirmation')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/stop.js');
    await cmd(opts);
  });

program.command('restart')
  .description('Restart dashboard services')
  .option('--env <name>', 'Environment name')
  .option('--no-tunnel', 'Skip tunnel restart')
  .option('--gateway', 'Also restart gateway service')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/restart.js');
    await cmd(opts);
  });

program.command('status')
  .description('Show dashboard status')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/status.js');
    await cmd(opts);
  });

// Development
program.command('dev')
  .description('Start dev environment (foreground)')
  .option('--env <name>', 'Environment name')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/dev.js');
    await cmd(opts);
  });

program.command('build')
  .description('Production build')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/build.js');
    await cmd(opts);
  });

program.command('preview')
  .description('Preview production build')
  .option('--env <name>', 'Environment name')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/preview.js');
    await cmd(opts);
  });

program.command('test')
  .description('Run test suite')
  .option('--env <name>', 'Environment name')
  .option('--watch', 'Watch mode')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/test.js');
    await cmd(opts);
  });

program.command('lint')
  .description('Run ESLint + Prettier check')
  .option('--env <name>', 'Environment name')
  .option('--fix', 'Auto-fix issues')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/lint.js');
    await cmd(opts);
  });

program.command('format')
  .description('Format code with Prettier')
  .option('--env <name>', 'Environment name')
  .option('--check', 'Check formatting without writing')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/format.js');
    await cmd(opts);
  });

// Operations
program.command('logs [service]')
  .description('Tail logs (api|web|tunnel|all)')
  .option('--env <name>', 'Environment name')
  .option('-n, --lines <n>', 'Number of lines', '50')
  .option('-f, --follow', 'Follow log output')
  .option('--rotate', 'Rotate logs > 1MB (copy to .old, truncate)')
  .option('--clear', 'Clear all log files (with confirmation)')
  .option('--force', 'Skip confirmation for --clear')
  .option('--json', 'Output as JSON')
  .action(async (service, opts) => {
    const { default: cmd } = await import('../src/commands/logs.js');
    await cmd(service, opts);
  });

program.command('health')
  .description('Deep health check')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/health.js');
    await cmd(opts);
  });

program.command('tunnel [action]')
  .description('Tunnel management (url|restart|status)')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (action, opts) => {
    const { default: cmd } = await import('../src/commands/tunnel.js');
    await cmd(action, opts);
  });

// Config & Environment
program.command('env [action]')
  .description('Environment config (show|validate|list)')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (action, opts) => {
    const { default: cmd } = await import('../src/commands/env.js');
    await cmd(action, opts);
  });

program.command('config')
  .description('HDB config (show|get|set|reset)')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .argument('[action]', 'Action (show|get|set|reset)', 'show')
  .argument('[key]', 'Config key for get/set')
  .argument('[value]', 'Value for set')
  .action(async (action, key, value, opts) => {
    const { default: cmd } = await import('../src/commands/config.js');
    await cmd(action, key, value, opts);
  });

// MCP
program.command('mcp [action]')
  .description('MCP server status (status|list)')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (action, opts) => {
    const { default: cmd } = await import('../src/commands/mcp.js');
    await cmd(action, opts);
  });

// Deploy & Update
program.command('deploy')
  .description('Build + restart pipeline')
  .option('--env <name>', 'Environment name')
  .option('--no-tunnel', 'Skip tunnel after deploy')
  .option('--force', 'Skip confirmation')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/deploy.js');
    await cmd(opts);
  });

program.command('update')
  .description('Git pull + npm install + build')
  .option('--env <name>', 'Environment name')
  .option('--force', 'Skip confirmation')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/update.js');
    await cmd(opts);
  });

program.command('doctor')
  .description('Check dependencies (node, npm, ssh, fuser)')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/doctor.js');
    await cmd(opts);
  });

program.command('audit')
  .description('One-shot system audit (health, doctor, security)')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/audit.js');
    await cmd(opts);
  });

program.command('monitor')
  .description('Live multi-service monitoring')
  .option('--env <name>', 'Environment name')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/monitor.js');
    await cmd(opts);
  });

program.command('agent [action]')
  .description('Agent management (approve|sessions)')
  .option('--env <name>', 'Environment name')
  .option('--id <id>', 'Approval ID for approve command')
  .option('--all', 'Approve all pending approvals (requires confirmation)')
  .option('--force', 'Skip confirmation')
  .option('--reject <reason>', 'Reject with reason')
  .option('--json', 'Output as JSON')
  .action(async (action, opts) => {
    const { default: cmd } = await import('../src/commands/agent.js');
    await cmd(action, opts);
  });

program.command('watch [target]')
  .description('File watcher management (api|web|status)')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (target, opts) => {
    const { default: cmd } = await import('../src/commands/watch.js');
    await cmd(target, opts);
  });

// Security
program.command('security [action]')
  .description('Security audit and management (audit|rotate|check-env)')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .action(async (action, opts) => {
    const { default: cmd } = await import('../src/commands/security.js');
    await cmd(action, opts);
  });

// Backup
program.command('backup [action]')
  .description('Backup management (create|list|verify|restore|prune)')
  .option('--env <name>', 'Environment name')
  .option('--label <label>', 'Backup label (for create)')
  .option('--id <id>', 'Backup ID (for verify|restore)')
  .option('--force', 'Skip confirmation (for restore|prune)')
  .option('--keep <n>', 'Number of backups to keep (for prune)', 'required')
  .option('--json', 'Output as JSON')
  .action(async (action, opts) => {
    const { default: cmd } = await import('../src/commands/backup.js');
    await cmd(action, opts);
  });

program.parse();
