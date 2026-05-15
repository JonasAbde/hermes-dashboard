#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { setOutputPolicy, log } from '../src/lib/logger.js';
import { buildOutputPolicy, getFrameStyle } from '../src/lib/output-policy.js';

// Global error handler — prevents silent crashes
process.on('unhandledRejection', (err) => {
  log.error(`Unexpected error: ${err?.message || err}`);
  if (process.env.DEBUG && err?.stack) {
    log.error(err.stack);
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  log.error(`Fatal: ${err.message}`);
  if (process.env.DEBUG && err?.stack) {
    log.error(err.stack);
  }
  process.exit(1);
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const { isActive } = await import('../src/lib/services.js');
const { getTunnelStatus } = await import('../src/lib/tunnel.js');

program
  .name('hdb')
  .description('Hermes Dashboard CLI — services, dev, ops')
  .version(pkg.version, '-v, --version', 'Print version info')
  .option('--verbose', 'Show verbose version info (config, environment, services)')
  .option('--plain', 'Plain output mode (no colors, no emoji, no spinner)')
  .option('--skin <style>', 'Output skin (minimal|standard|vivid|experimental)', 'standard');

function getInitialSkinFromArgs() {
  const direct = process.argv.find((entry) => entry.startsWith('--skin='));
  if (direct) return direct.split('=')[1];
  const idx = process.argv.indexOf('--skin');
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function repeat(str, length) {
  return str.repeat(Math.max(0, length));
}

function framedLine(frame, label, width) {
  const content = ` ${label} `;
  const available = Math.max(4, width - 2);
  const leftPad = Math.max(0, Math.floor((available - content.length) / 2));
  const rightPad = Math.max(0, available - content.length - leftPad);
  return `${frame.vertical}${repeat(' ', leftPad)}${content}${repeat(' ', rightPad)}${frame.vertical}`;
}

function buildHelpPrelude() {
  const policy = buildOutputPolicy({
    plain: process.argv.includes('--plain'),
    skin: getInitialSkinFromArgs(),
  });
  const frame = getFrameStyle(policy).header;
  const width = frame.headerWidth || 58;
  const slogans = {
    minimal: 'quiet, scriptable, verified',
    standard: 'control, verify, recover',
    vivid: 'living sigil operator shell',
    experimental: 'relay warden command room',
  };
  const top = `${frame.topLeft}${repeat(frame.horizontal, Math.max(4, width - 2))}${frame.topRight}`;
  const bottom = `${frame.bottomLeft}${repeat(frame.horizontal, Math.max(4, width - 2))}${frame.bottomRight}`;
  const lines = [
    (frame.mascot || 'HDB').trim(),
    'Hermes Dashboard CLI',
    slogans[policy.skin] || slogans.standard,
  ];

  return `
${top}
${lines.map((line) => framedLine(frame, line, width)).join('\n')}
${bottom}

Quickstart:
  $ hdb status
  $ hdb health --skin vivid
  $ hdb mcp list --skin experimental

Output:
  --plain        Human-friendly output without ANSI colors, emoji, or animated spinners
  --skin         Output shell style: minimal, standard, vivid, or experimental
  --json         Structured output for scripts
  NO_COLOR=1     Force plain output for any command
  FORCE_COLOR=1  Force ANSI colors when output supports it
`;
}

setOutputPolicy({
  plain: process.argv.includes('--plain'),
  skin: getInitialSkinFromArgs(),
});

program.hook('preAction', (_, actionCommand) => {
  const rootOptions = program.opts();
  const commandOptions = actionCommand?.opts ? actionCommand.opts() : {};
  const runtimeSkin = getInitialSkinFromArgs();
  setOutputPolicy({ ...rootOptions, ...commandOptions, ...(runtimeSkin !== undefined ? { skin: runtimeSkin } : {}) });
});

// Handle --version --verbose before parsing
if (process.argv.includes('--version') && process.argv.includes('--verbose')) {
  const verboseVersionInfo = await getVerboseVersionInfo();
  console.log(`\n${verboseVersionInfo}\n`);
  process.exit(0);
}

// Core lifecycle
program.addHelpText('beforeAll', buildHelpPrelude());

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
  const timestamp = new Date().toISOString();

  // Get dashboard version info
  let dashboardVersion = '?';
  let dashboardCommit = '?';
  let dashboardRunning = 0;
  let dashboardStopped = 0;
  const serviceDetails = {};
  let serviceError = null;

  const dashboardPkgPath = join(process.env.HOME, '.hermes/dashboard/package.json');
  const dashboardGitPath = join(process.env.HOME, '.hermes/dashboard/.git');

  try {
    if (existsSync(dashboardPkgPath)) {
      dashboardVersion = JSON.parse(readFileSync(dashboardPkgPath, 'utf-8')).version;
    }

    if (existsSync(dashboardGitPath)) {
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
      const isRunning = await isActive(service);
      const isTunnel = service === 'tunnel';

      const running = isTunnel ? getTunnelStatus().running : isRunning;
      serviceDetails[service] = {
        running,
      };

      if (running) {
        dashboardRunning++;
      } else {
        dashboardStopped++;
      }
    }
  } catch (error) {
    serviceError = error?.message || 'unable to collect service status';
  }

  const block = {
    schema_version: '1.0',
    command: 'version',
    status: serviceError ? 'warning' : 'ok',
    timestamp,
    data: {
      hdb: pkg.version,
      node: nodeVersion,
      platform,
      config: {
        path: configPath,
        exists: configExists,
        env: configExists ? envName : 'default',
      },
      dashboard: {
        version: dashboardVersion,
        commit: dashboardCommit,
      },
      services: {
        running: dashboardRunning,
        stopped: dashboardStopped,
        details: serviceDetails,
      },
      error: serviceError,
    },
  };

  return [
    `hdb v${pkg.version}`,
    `node ${nodeVersion}`,
    `platform ${platform}`,
    `config: ${configPath}`,
    `env: ${configExists ? envName : 'default'}`,
    `dashboard: v${dashboardVersion} (${dashboardCommit})`,
    `services: ${dashboardRunning} running, ${dashboardStopped} stopped`,
    '',
    `schema_version: ${block.schema_version}`,
    `command: ${block.command}`,
    `status: ${block.status}`,
    `timestamp: ${block.timestamp}`,
    `service_errors: ${serviceError ? 'yes' : 'no'}`,
    `running_services: ${dashboardRunning}`,
    `stopped_services: ${dashboardStopped}`,
  ].join('\n');
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

program.command('pack [action] [packId]')
        .description('Agent pack management (list|show|register|lifecycle|deploy|verify|preview|install|clone|dependencies|versions|workspaces|metrics|logs)')
  .option('--env <name>', 'Environment name')
  .option('--json', 'Output as JSON')
  .option('--status <status>', 'Filter by lifecycle status (list)')
  .option('--workspace <id>', 'Filter by workspace id (list); omit for all workspaces')
  .option('--visibility <scope>', 'Visibility filter for list or register value (private|workspace|public)')
  .option('--catalog', 'Catalog-only list (public published packs)')
  .option('--query <text>', 'Search query for list')
  .option('--sort <key>', 'Sort order for list (updated-desc|trust-desc|trust-asc|name-asc)')
  .option('--pack-id <id>', 'Pack ID (if not passed as positional arg)')
  .option('--name <name>', 'Pack name')
  .option('--card-name <name>', 'Card name')
  .option('--card-title <title>', 'Card title')
  .option('--card-theme <theme>', 'Card theme')
  .option('--file <path>', 'Read pack payload from JSON file')
  .option('--slug <slug>', 'Pack slug')
  .option('--entrypoint <entrypoint>', 'Pack entrypoint')
  .option('--requirements <list>', 'Comma-separated requirements')
  .option('--capabilities <list>', 'Comma-separated capabilities')
  .option('--initial-status <status>', 'Initial pack status for register')
  .option('--summary <markdown>', 'Pack summary / why this pack exists')
  .option('--docs-url <url>', 'External docs URL for the pack')
  .option('--payload <json>', 'Raw JSON payload')
  .option('--to-state <state>', 'Target lifecycle state')
  .option('--actor <actor>', 'Actor name')
  .option('--notes <notes>', 'Lifecycle notes')
  .option('--verifier <id>', 'Verifier ID')
  .option('--environment <env>', 'Deploy environment')
  .option('--agent-id <id>', 'Agent ID')
  .option('--runtime-notes <notes>', 'Runtime notes')
  .action(async (action, packId, opts) => {
    const { default: cmd } = await import('../src/commands/pack.js');
    await cmd(action, packId, opts);
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
  .option('--dry-run', 'Show what would happen without executing (for create|restore)')
  .option('--confirm-restore', 'Explicit confirm restore (for restore, bypasses standard confirmation)')
  .option('--json', 'Output as JSON')
  .action(async (action, opts) => {
    const { default: cmd } = await import('../src/commands/backup.js');
    await cmd(action, opts);
  });

program.parse();
