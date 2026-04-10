import { execSync, spawn } from 'child_process';
import { log } from '../lib/logger.js';
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
    log.info('Available logs: api, web, tunnel');
    log.dim(`  Log dir: ${logDir}`);
    return;
  }

  const logFile = LOG_FILES[service];
  if (!logFile) {
    log.error(`Unknown service: ${service}. Use: api, web, tunnel, all`);
    process.exit(1);
  }

  const fullPath = `${logDir}/${logFile}`;

  if (opts.follow) {
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
