import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, statSync, renameSync, truncateSync, readFileSync, writeFileSync } from 'fs';
import { log, json } from '../lib/logger.js';
import { getLogsDir } from '../lib/config.js';
import { confirm } from '../lib/confirm.js';

const LOG_FILES = {
  api: 'api.log',
  web: 'vite.log',
  vite: 'vite.log',
  proxy: 'cors-proxy.log',
  'cors-proxy': 'cors-proxy.log',
  tunnel: 'tunnel.log',
  gateway: 'gateway.log',
  webhooks: 'webhooks.log',
  dev: 'dev.log',
  monitor: 'monitor.log',
};

const ROTATE_THRESHOLD = 1024 * 1024; // 1MB

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

function rotateLog(logDir, filename) {
  const fullPath = join(logDir, filename);
  if (!existsSync(fullPath)) return { rotated: false, reason: 'not found' };

  const stats = statSync(fullPath);
  if (stats.size < ROTATE_THRESHOLD) return { rotated: false, reason: 'under threshold', size: stats.size };

  // Rotate: rename current to .old, truncate current
  const oldPath = `${fullPath}.old`;
  try {
    // Preserve content by copying first
    const content = readFileSync(fullPath);
    writeFileSync(oldPath, content);
    truncateSync(fullPath, 0);
    return { rotated: true, size: stats.size };
  } catch (err) {
    return { rotated: false, reason: err.message };
  }
}

function clearLog(logDir, filename) {
  const fullPath = join(logDir, filename);
  if (!existsSync(fullPath)) return { cleared: false, reason: 'not found' };

  try {
    truncateSync(fullPath, 0);
    return { cleared: true };
  } catch (err) {
    return { cleared: false, reason: err.message };
  }
}

export default async function logsCmd(service, opts) {
  const logDir = getLogsDir();
  const lines = parseInt(opts.lines, 10) || 50;

  // Get unique log filenames (deduplicate aliases)
  const uniqueLogFiles = [...new Set(Object.values(LOG_FILES))];

  // Handle --rotate
  if (opts.rotate) {
    const targets = (!service || service === 'all')
      ? uniqueLogFiles
      : [LOG_FILES[service]].filter(Boolean);

    if (targets.length === 0 && service && service !== 'all') {
      if (opts.json) json({ error: `Unknown service: ${service}` });
      else log.error(`Unknown service: ${service}`);
      process.exit(1);
    }

    const results = {};
    for (const filename of targets) {
      results[filename] = rotateLog(logDir, filename);
    }

    if (opts.json) {
      json({ action: 'rotate', results });
    } else {
      log.info('Log rotation results:');
      for (const [file, result] of Object.entries(results)) {
        if (result.rotated) {
          log.success(`${file} — rotated (${(result.size / 1024).toFixed(1)}KB → ${file}.old)`);
        } else {
          log.dim(`${file} — skipped (${result.reason})`);
        }
      }
    }
    return;
  }

  // Handle --clear
  if (opts.clear) {
    const confirmed = await confirm('Clear all log files?', opts);
    if (!confirmed) {
      if (opts.json) json({ action: 'clear', cancelled: true });
      else log.dim('Cancelled.');
      return;
    }

    const targets = (!service || service === 'all')
      ? uniqueLogFiles
      : [LOG_FILES[service]].filter(Boolean);

    if (targets.length === 0 && service && service !== 'all') {
      if (opts.json) json({ error: `Unknown service: ${service}` });
      else log.error(`Unknown service: ${service}`);
      process.exit(1);
    }

    const results = {};
    for (const filename of targets) {
      results[filename] = clearLog(logDir, filename);
    }

    if (opts.json) {
      json({ action: 'clear', results });
    } else {
      log.info('Log clear results:');
      for (const [file, result] of Object.entries(results)) {
        if (result.cleared) {
          log.success(`${file} — cleared`);
        } else {
          log.dim(`${file} — skipped (${result.reason})`);
        }
      }
    }
    return;
  }

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
      log.error(`Unknown service: ${service}. Use: api, web, proxy, tunnel, gateway, webhooks, dev, monitor, all`);
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
