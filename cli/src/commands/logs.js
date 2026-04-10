import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { log, json } from '../lib/logger.js';
import { getLogsDir } from '../lib/config.js';

const LOG_FILES = {
  api: 'api.log',
  web: 'web.log',
  tunnel: 'tunnel.log',
};

function tailFile(fullPath, lines, follow = false) {
  const args = follow
    ? ['-f', '-n', String(lines), fullPath]
    : ['-n', String(lines), fullPath];
  const proc = spawn('tail', args, { stdio: 'inherit' });
  return proc;
}

function readTailJson(fullPath, lines) {
  return new Promise((resolve, reject) => {
    const proc = spawn('tail', ['-n', String(lines), fullPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => { out += d; });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(err || `tail exited with code ${code}`));
      else resolve(out.split('\n').filter(Boolean));
    });
  });
}

export default async function logsCmd(service, opts) {
  const logDir = getLogsDir();
  const lines = parseInt(opts.lines, 10) || 50;

  if (!service || service === 'all') {
    // Show recent logs from ALL services
    const services = Object.keys(LOG_FILES);
    if (opts.json) {
      const allLines = {};
      for (const svc of services) {
        const fullPath = join(logDir, LOG_FILES[svc]);
        if (existsSync(fullPath)) {
          try {
            allLines[svc] = await readTailJson(fullPath, lines);
          } catch {
            allLines[svc] = [];
          }
        } else {
          allLines[svc] = [];
        }
      }
      json({ service: 'all', logs: allLines });
    } else {
      for (const svc of services) {
        const fullPath = join(logDir, LOG_FILES[svc]);
        if (existsSync(fullPath)) {
          log.info(`--- ${svc} ---`);
          try {
            tailFile(fullPath, lines);
          } catch {
            log.error(`Could not read ${fullPath}`);
          }
        } else {
          log.dim(`--- ${svc}: no log file ---`);
        }
      }
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

  const fullPath = join(logDir, logFile);

  if (opts.json) {
    try {
      const outputLines = await readTailJson(fullPath, lines);
      json({ service, lines: outputLines });
    } catch {
      json({ service, lines: [], error: `Could not read ${fullPath}` });
      process.exit(1);
    }
  } else if (opts.follow) {
    const proc = tailFile(fullPath, lines, true);
    process.on('SIGINT', () => {
      proc.kill();
      process.exit(0);
    });
  } else {
    try {
      tailFile(fullPath, lines);
    } catch {
      log.error(`Could not read ${fullPath}`);
    }
  }
}
