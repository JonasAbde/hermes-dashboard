#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

program
  .name('hdb')
  .description('Hermes Dashboard CLI — services, dev, ops')
  .version(pkg.version);

// Core lifecycle
program.command('start')
  .description('Start dashboard services')
  .option('--no-tunnel', 'Skip tunnel startup')
  .option('--api-only', 'Start only API server')
  .option('--web-only', 'Start only Vite dev server')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/start.js');
    await cmd(opts);
  });

program.command('stop')
  .description('Stop dashboard services')
  .option('--api-only', 'Stop only API server')
  .option('--web-only', 'Stop only Vite dev server')
  .option('--tunnel-only', 'Stop only tunnel')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/stop.js');
    await cmd(opts);
  });

program.command('restart')
  .description('Restart dashboard services')
  .option('--no-tunnel', 'Skip tunnel restart')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/restart.js');
    await cmd(opts);
  });

program.command('status')
  .description('Show dashboard status')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/status.js');
    await cmd(opts);
  });

// Development
program.command('dev')
  .description('Start dev environment (foreground)')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/dev.js');
    await cmd(opts);
  });

program.command('build')
  .description('Production build')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/build.js');
    await cmd(opts);
  });

program.command('preview')
  .description('Preview production build')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/preview.js');
    await cmd(opts);
  });

program.command('test')
  .description('Run test suite')
  .option('--watch', 'Watch mode')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/test.js');
    await cmd(opts);
  });

program.command('lint')
  .description('Run ESLint + Prettier check')
  .option('--fix', 'Auto-fix issues')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/lint.js');
    await cmd(opts);
  });

program.command('format')
  .description('Format code with Prettier')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/format.js');
    await cmd(opts);
  });

// Operations
program.command('logs [service]')
  .description('Tail logs (api|web|tunnel|all)')
  .option('-n, --lines <n>', 'Number of lines', '50')
  .option('-f, --follow', 'Follow log output')
  .action(async (service, opts) => {
    const { default: cmd } = await import('../src/commands/logs.js');
    await cmd(service, opts);
  });

program.command('health')
  .description('Deep health check')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/health.js');
    await cmd(opts);
  });

program.command('tunnel [action]')
  .description('Tunnel management (url|restart|status)')
  .option('--json', 'Output as JSON')
  .action(async (action, opts) => {
    const { default: cmd } = await import('../src/commands/tunnel.js');
    await cmd(action, opts);
  });

// Config & Environment
program.command('env')
  .description('Environment config (show|validate|set KEY=VALUE)')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/env.js');
    await cmd(opts);
  });

// Deploy & Update
program.command('deploy')
  .description('Build + restart pipeline')
  .option('--no-tunnel', 'Skip tunnel after deploy')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/deploy.js');
    await cmd(opts);
  });

program.command('update')
  .description('Git pull + npm install + build')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/update.js');
    await cmd(opts);
  });

program.command('doctor')
  .description('Check dependencies (node, npm, ssh, fuser)')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/doctor.js');
    await cmd(opts);
  });

program.command('monitor')
  .description('Live multi-service monitoring')
  .action(async (opts) => {
    const { default: cmd } = await import('../src/commands/monitor.js');
    await cmd(opts);
  });

program.parse();
