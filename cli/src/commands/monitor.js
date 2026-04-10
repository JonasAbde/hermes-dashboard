import { execSync } from 'child_process';
import { log, header } from '../lib/logger.js';
import { isActive, getPid } from '../lib/services.js';
import { isPortOpen } from '../lib/ports.js';
import { getTunnelUrl, isTunnelRunning } from '../lib/tunnel.js';
import { checkApiHealth } from '../lib/health.js';

export default async function monitor(opts) {
  header('Hermes Dashboard — Live Monitor');
  log.dim('  Refreshing every 2s — Ctrl+C to stop\n');

  async function tick() {
    process.stdout.write('\x1b[2J\x1b[0f'); // clear screen
    header('Hermes Dashboard — Live Monitor');

    const apiUp = isActive('api');
    const webUp = isActive('web');
    const tunnelUp = isTunnelRunning();
    const apiHealth = await checkApiHealth();

    const icon = (ok) => ok ? '\x1b[32m●\x1b[0m' : '\x1b[31m○\x1b[0m';

    console.log(`  ${icon(apiUp)} API (5174)      PID: ${getPid('api') || '—'}`);
    console.log(`  ${icon(webUp)} Vite (5175)     PID: ${getPid('web') || '—'}`);
    console.log(`  ${icon(tunnelUp)} Tunnel          URL: ${getTunnelUrl() || '—'}`);
    console.log(`  ${icon(isPortOpen(8642))} Gateway (8642)`);
    console.log(`  ${icon(apiHealth.ok)} API Health`);

    const now = new Date().toLocaleTimeString('da-DK');
    console.log(`\n  Updated: ${now}`);
  }

  await tick();
  const interval = setInterval(tick, 2000);

  process.on('SIGINT', () => {
    clearInterval(interval);
    process.exit(0);
  });
}
