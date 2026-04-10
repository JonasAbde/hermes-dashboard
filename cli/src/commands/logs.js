import { execSync, spawn } from 'child_process';
import { log, json } from '../lib/logger.js';
import { getLogsDir } from '../lib/config.js';
import { serviceNames } from '../lib/services.js';

const LOG_FILES = {
  api: 'api.log',
  web: 'web.log',
  tunnel: 'tunnel.log',
};

export default async function logsCmd(service, opts) {
  const logDir = getLogsDir();
  const lines = parseInt(opts.lines, 10) || 50;

  if (!service || service === 'all') {
    if (opts.json) {
      json({ service: 'all', lines: [], available: ['api', 'web', 'tunnel'] });
    } else {
      log.info('Available logs: api, web, tunnel');
      log.dim(`  Log dir: ${logDir}`);
    }
    return;
  }

  const logFile = LOG_FILES[service];
  if (!logFile) {
    if (opts.json) {
      json({ service, lines: [], error: `Unknown service: ${service}` });
    } else {
      log.error(`Unknown service: ${service}. Use: api, web, tunnel, all`);
    }
    process.exit(1);
  }

  const fullPath = `${logDir}/${logFile}`;

  if (opts.json) {
    try {
      const output = execSync(`tail -n ${lines} ${fullPath}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      json({ service, lines: output.split('\n').filter(Boolean) });
    } catch {
      json({ service, lines: [], error: `Could not read ${fullPath}` });
      process.exit(1);
    }
  } else if (opts.follow) {
    const proc = spawn('tail', ['-f', '-n', String(lines), fullPath], { stdio: 'inherit' });
    process.on('SIGINT', () => {
      proc.kill();
      process.exit(0);
    });
  } else {
    try {
      execSync(`tail -n ${lines} ${fullPath}`, { stdio: 'inherit' });
    } catch {
      log.error(`Could not read ${fullPath}`);
    }
  }
}
