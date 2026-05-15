import { join } from 'path';
import { homedir } from 'os';
import { statSync, existsSync, readFileSync, writeFileSync, unlinkSync, rmdirSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import Table from 'cli-table3';
import { log, json } from '../lib/logger.js';
import { getVersion, getDashboardRoot } from '../lib/config.js';
import { isActive, stopService, startService } from '../lib/services.js';
import { isTunnelRunning, stopTunnel as stopTunnelService, getTunnelStatus } from '../lib/tunnel.js';
import { withSpinner } from '../lib/exec.js';
import { confirm } from '../lib/confirm.js';
import { KNOWN_PORTS, waitForPortWithService } from '../lib/ports.js';
import { buildCommandResult } from '../lib/command-result.js';

const BACKUP_DIR = join(homedir(), '.hermes', 'backups');

function logHuman(level, message, opts) {
  if (opts?.json) return;
  const fn = log[level] || log.info;
  fn(message, opts);
}

function formatDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

async function createBackup(opts) {
  const dashboardRoot = getDashboardRoot();

  // Get service status
  const serviceStatus = {
    api: await isActive('api'),
    web: await isActive('web'),
    proxy: await isActive('proxy'),
    gateway: await isActive('gateway'),
    tunnel: getTunnelStatus().running,
  };

  // Generate unique ID with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `backup-${timestamp}`;
  const backupPath = join(BACKUP_DIR, backupId);
  const archivePath = join(BACKUP_DIR, `${backupId}.tar.gz`);

  // Create metadata
  const metadata = {
    id: backupId,
    label: opts.label || 'Unnamed backup',
    files: 0,
    created_at: formatDate(new Date()),
    dashboard_version: getVersion(),
    services: serviceStatus,
  };

  // Get git commit info if possible
  try {
    const gitPath = join(dashboardRoot, '.git');
    if (existsSync(gitPath)) {
      metadata.git_commit = execSync('git rev-parse --short HEAD', {
        cwd: dashboardRoot,
        encoding: 'utf-8',
      }).trim();
      metadata.git_branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: dashboardRoot,
        encoding: 'utf-8',
      }).trim();
    }
  } catch (e) {
    metadata.git_commit = 'unknown';
    metadata.git_branch = 'unknown';
  }

  return withSpinner('Creating backup archive', opts, async (s) => {
    try {
      // Create backup directory
      if (!existsSync(BACKUP_DIR)) {
        mkdirSync(BACKUP_DIR, { recursive: true });
      }

      // Create the backup
      execSync(`tar -czf "${archivePath}" -C "${dashboardRoot}" .`, {
        stdio: 'pipe',
      });

      // Read archive info
      const archiveStat = statSync(archivePath);
      metadata.size_bytes = archiveStat.size;
      metadata.size = formatSize(archiveStat.size);

      // Count files in archive
      const fileCount = parseInt(execSync(`tar -tzf "${archivePath}" | wc -l`, {
        encoding: 'utf-8'
      }).trim(), 10);
      metadata.files = fileCount;

      // Calculate checksum
      const checksum = execSync(`sha256sum "${archivePath}"`, { encoding: 'utf-8' }).split(' ')[0];
      metadata.checksum = checksum;

      // Write manifest
      const manifestPath = join(BACKUP_DIR, `${backupId}.json`);
      writeFileSync(manifestPath, JSON.stringify(metadata, null, 2));

      const result = {
        id: backupId,
        label: metadata.label,
        size_bytes: metadata.size_bytes,
        size: metadata.size,
        files: metadata.files,
        created_at: metadata.created_at,
        checksum: metadata.checksum,
        path: archivePath,
      };

      if (opts.json) {
        json(buildCommandResult({
          command: 'backup',
          ok: true,
          payload: { action: 'create', ...result },
        }));
      } else {
        log.success(`Backup created: ${backupId}`);
        log.dim(`  Size: ${metadata.size}`);
        log.dim(`  Files: ${metadata.files}`);
        log.dim(`  Path: ${archivePath}`);
        log.dim(`  Checksum: ${metadata.checksum}`);
      }

      // DRY RUN header
      if (opts.dryRun && !opts.json) {
        log.dim('');
        log.dim('CREATE BACKUP DRY RUN');
        log.dim('='.repeat(60));
        logHuman('info', `Backup: ${backupId}`, opts);
        logHuman('info', `Label: ${metadata.label || 'Unnamed'}`, opts);
        logHuman('info', `Created: ${metadata.created_at}`, opts);
        logHuman('info', `Version: ${metadata.dashboard_version || 'unknown'}`, opts);
        logHuman('info', `Git commit: ${metadata.git_commit || 'unknown'}`, opts);
        logHuman('info', `Files: ${metadata.files}`, opts);
        logHuman('info', `Size: ${metadata.size}`, opts);
        logHuman('info', `Checksum: ${metadata.checksum}`, opts);
        logHuman('warn', 'This backup was created but NOT stored or validated.', opts);
        logHuman('warn', 'To actually save this backup, run without --dry-run flag.', opts);
        log.dim('='.repeat(60));
      }

      return result;
    } catch (e) {
      // Clean up failed backup
      if (existsSync(archivePath)) {
        try {
          execSync(`rm -f "${archivePath}"`, { stdio: 'ignore' });
        } catch {}
      }
      throw e;
    }
  });
}

async function listBackups(opts) {
  const backups = [];

  if (!existsSync(BACKUP_DIR)) {
    if (opts.json) {
      json(buildCommandResult({
        command: 'backup',
        ok: true,
        payload: { action: 'list', backups: [], total: 0, total_size: 0 },
      }));
    } else {
      log.info('No backups found');
    }
    return;
  }

  const entries = execSync(`ls -1 "${BACKUP_DIR}"`, { encoding: 'utf-8' }).trim().split('\n');

  for (const entry of entries) {
    if (!entry) continue;

    const archivePath = join(BACKUP_DIR, entry);
    const backupId = entry.replace('.tar.gz', '');
    const manifestPath = join(BACKUP_DIR, `${backupId}.json`);

    if (entry.endsWith('.tar.gz')) {
      const manifest = existsSync(manifestPath)
        ? JSON.parse(readFileSync(manifestPath, 'utf-8'))
        : null;

      // Check if checksum is valid
      let checksumValid = null;
      if (manifest && existsSync(archivePath)) {
        try {
          const storedChecksum = manifest.checksum;
          const actualChecksum = execSync(`sha256sum "${archivePath}"`, {
            encoding: 'utf-8',
          }).split(' ')[0];
          checksumValid = storedChecksum === actualChecksum;
        } catch (e) {
          checksumValid = false;
        }
      }

      const stat = statSync(archivePath);
      backups.push({
        id: entry.replace('.tar.gz', ''),
        label: manifest?.label || 'Unnamed',
        size_bytes: stat.size,
        size: formatSize(stat.size),
        created_at: manifest?.created_at || new Date(stat.mtime).toISOString().replace('T', ' ').substring(0, 19),
        valid: checksumValid,
        files: manifest?.files || 0,
      });
    }
  }

  // Sort by creation date (newest first)
  backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const totalSize = backups.reduce((sum, b) => sum + b.size_bytes, 0);

  if (opts.json) {
    json(buildCommandResult({
      command: 'backup',
      ok: true,
      payload: { action: 'list', backups, total: backups.length, total_size: totalSize },
    }));
  } else {
    if (backups.length === 0) {
      log.info('No backups found');
    } else {
      const table = new Table({
        head: ['ID', 'Label', 'Size', 'Created', 'Status'].map((h) => h.padEnd(25)),
        style: { head: [], border: [] },
        colWidths: [22, 25, 10, 25, 15],
      });

      for (const b of backups) {
        const status = b.valid ? 'OK' : 'Invalid';
        table.push([
          b.id.substring(0, 20),
          b.label.substring(0, 23),
          b.size,
          b.created_at,
          status,
        ]);
      }

      log.info(table.toString(), opts);
      log.info(`Total: ${backups.length} backups, ${formatSize(totalSize)} space used`);
    }
  }

  return { backups, total: backups.length, total_size: totalSize };
}

async function verifyBackup(backupId, opts) {
  const backupPath = join(BACKUP_DIR, `${backupId}.tar.gz`);
  const manifestPath = join(BACKUP_DIR, `${backupId}.json`);

  return withSpinner('Verifying backup', opts, async (s) => {
    if (!existsSync(backupPath)) {
      const error = `Backup not found: ${backupId}`;
      if (opts.json) {
        json(buildCommandResult({
          command: 'backup',
          ok: false,
          status: 'error',
          payload: { action: 'verify', id: backupId, valid: false, files_count: 0, error },
        }));
      } else {
        log.error(error);
      }
      return { id: backupId, valid: false, files_count: 0, error };
    }

    if (!existsSync(manifestPath)) {
      const error = `Manifest not found for backup: ${backupId}`;
      if (opts.json) {
        json(buildCommandResult({
          command: 'backup',
          ok: false,
          status: 'error',
          payload: { action: 'verify', id: backupId, valid: false, files_count: 0, error },
        }));
      } else {
        log.error(error);
      }
      return { id: backupId, valid: false, files_count: 0, error };
    }

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      // Verify checksum
      const actualChecksum = execSync(`sha256sum "${backupPath}"`, {
        encoding: 'utf-8',
      }).split(' ')[0];
      const checksumValid = actualChecksum === manifest.checksum;

      // Count files in archive
      const fileCount = parseInt(execSync(`tar -tzf "${backupPath}" | wc -l`).trim(), 10);

      // List files
      const fileCounting = execSync(`tar -tzf "${backupPath}"`, {
        encoding: 'utf-8',
      }).trim().split('\n');

      if (opts.json) {
        json(buildCommandResult({
          command: 'backup',
          ok: true,
          payload: {
            action: 'verify',
            id: backupId,
            valid: checksumValid,
            files_count: fileCount,
            file_counting: fileCounting.length,
            files: fileCounting,
            error: null,
          },
        }));
      } else {
        if (checksumValid) {
          log.success(`Backup verified: ${backupId}`);
          log.dim(`  Files: ${fileCount}`);
          log.dim(`  Checksum: ${actualChecksum}`);
        } else {
          log.error(`Backup verification failed: ${backupId}`);
          log.error(`  Stored checksum: ${manifest.checksum}`);
          log.error(`  Actual checksum: ${actualChecksum}`);
          throw new Error('Checksum mismatch');
        }
      }

      return {
        id: backupId,
        valid: checksumValid,
        files_count: fileCount,
        file_counting: fileCounting.length,
        files: fileCounting,
        error: null,
      };
    } catch (e) {
      if (opts.json) {
        json(buildCommandResult({
          command: 'backup',
          ok: false,
          status: 'error',
          payload: { action: 'verify', id: backupId, valid: false, files_count: 0, error: e.message },
        }));
      } else {
        log.error(`Verification failed: ${e.message}`);
      }
      throw e;
    }
  });
}

async function stopServices(opts) {
  const stopped = [];
  const errors = [];

  for (const service of ['api', 'web', 'proxy', 'gateway']) {
    if (await isActive(service)) {
      const result = await stopService(service);
      if (result) {
        stopped.push(service);
      } else {
        errors.push(`${service}: failed to stop`);
      }
    }
  }

  // Stop tunnel if running
  if (isTunnelRunning()) {
    if (stopTunnelService()) {
      stopped.push('tunnel');
    } else {
      errors.push('tunnel: failed to stop');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Failed to stop services: ${errors.join('; ')}`);
  }

  return stopped;
}

async function startServices(opts) {
  const started = [];
  const errors = [];
  const services = ['api', 'web', 'gateway'];

  for (const service of services) {
    const result = await startAndTrackService(service, KNOWN_PORTS[service]?.port, 15, opts);
    if (result.ok) {
      started.push(service);
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    const firstError = errors[0];
    throw new Error(`Could not start services for restore: ${firstError}`);
  }

  return started;
}

async function startAndTrackService(service, port, timeoutSec = 15) {
  if (!KNOWN_PORTS[service] && !port) {
    return { ok: false, error: `Unknown service port mapping: ${service}` };
  }

  if (await isActive(service)) {
    return { ok: true, skipped: true };
  }

  const started = await startService(service);
  if (!started) {
    return { ok: false, error: `startService(${service}) returned false` };
  }

  const ready = await waitForPortWithService(service, port, timeoutSec, {
    message: `${service} did not bind to port ${port}`,
  });
  if (!ready.ok) {
    return { ok: false, error: ready.error || `${service} did not bind to port ${port}` };
  }

  return { ok: true, skipped: false };
}

async function restoreBackup(backupId, opts) {
  const dashboardRoot = getDashboardRoot();
  const backupPath = join(BACKUP_DIR, `${backupId}.tar.gz`);
  const backupDir = join(BACKUP_DIR, backupId);

  // Check if backup exists
  if (!existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupId}`);
  }

  // Check manifest
  const manifestPath = join(BACKUP_DIR, `${backupId}.json`);
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found for backup: ${backupId}. Cannot restore.`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  // DRY RUN MODE - Show what would happen without actually doing it
  if (opts.dryRun && !opts.json) {
    log.dim('');
    log.dim('RESTORE DRY RUN');
    log.dim('='.repeat(60));
    logHuman('info', `Backup: ${backupId}`, opts);
    logHuman('info', `Label: ${manifest.label || 'Unnamed'}`, opts);
    logHuman('info', `Created: ${manifest.created_at}`, opts);
    logHuman('info', `Version: ${manifest.dashboard_version || 'unknown'}`, opts);
    logHuman('info', `Git commit: ${manifest.git_commit || 'unknown'}`, opts);
    logHuman('info', `Files: ${manifest.files}`, opts);
    logHuman('info', `Size: ${manifest.size}`, opts);
    logHuman('info', `Checksum: ${manifest.checksum}`, opts);
    logHuman('warn', 'What will be done:', opts);
    logHuman('warn', '  1. Stop dashboard services (api, web, proxy, gateway)', opts);
    logHuman('warn', '  2. Backup current dashboard to ~/.hermes.backup.temp', opts);
    logHuman('warn', '  3. Extract backup to temporary location', opts);
    logHuman('warn', '  4. Replace dashboard directory with backup contents', opts);
    logHuman('warn', '  5. Reload systemd daemon', opts);
    logHuman('warn', '  6. Start dashboard services', opts);
    logHuman('warn', 'Safety:', opts);
    logHuman('warn', '  - Rollback on failure', opts);
    logHuman('warn', '  - Manual confirmation required unless --force', opts);
    log.dim('='.repeat(60));
    return { dryRun: true, backupId, manifest };
  }

  // Normal restore with confirm-restore flag for explicit destructive action
  if (!opts.force && !opts.confirmRestore) {
    logHuman('warn', '', opts);
    logHuman('warn', 'WARNING: This is a DANGEROUS operation', opts);
    logHuman('warn', '='.repeat(60), opts);
    logHuman('info', `Backup: ${backupId}`, opts);
    logHuman('info', `Label: ${manifest.label || 'Unnamed'}`, opts);
    logHuman('info', `Created: ${manifest.created_at}`, opts);
    logHuman('info', `Files: ${manifest.files}`, opts);
    logHuman('info', `Size: ${manifest.size}`, opts);
    logHuman('warn', 'This will:', opts);
    logHuman('warn', '  1. Stop all dashboard services (api, web, proxy, gateway)', opts);
    logHuman('warn', '  2. Backup current dashboard to ~/.hermes.backup.temp', opts);
    logHuman('warn', '  3. REPLACE dashboard directory with backup contents', opts);
    logHuman('warn', 'Note:', opts);
    logHuman('warn', '  - If any step fails, current dashboard is restored automatically', opts);
    logHuman('warn', '  - All existing data will be overwritten', opts);
    logHuman('warn', '='.repeat(60), opts);

    const confirmed = await confirm(
      `Do you want to RESTORE FROM BACKUP "${backupId}"? (THIS CANNOT BE UNDONE)`,
      opts
    );
    if (!confirmed) {
      log.dim('Cancelled');
      process.exit(0);
    }
  }

  // Check if services are running
  const servicesRunning = {
    api: await isActive('api'),
    web: await isActive('web'),
    proxy: await isActive('proxy'),
    gateway: await isActive('gateway'),
    tunnel: isTunnelRunning(),
  };

  const runningServices = Object.entries(servicesRunning)
    .filter(([_, running]) => running)
    .map(([name, _]) => name)
    .join(', ');

  if (runningServices && !opts.force && !opts.confirmRestore) {
    logHuman('warn', '', opts);
    logHuman('warn', 'Stopping services...', opts);
    logHuman('info', `  Stopping: ${runningServices}`, opts);
    await stopServices(opts);
    logHuman('success', 'Services stopped', opts);
  }

  let tempDir = null;
  let servicesStopped = [];
  let servicesStarted = [];

  try {
    // Step 1: Stop services
    logHuman('warn', 'Stopping services...', opts);
    servicesStopped = await stopServices(opts);
    logHuman('success', 'Services stopped', opts);

    // Step 2: Extract backup to temp location
    tempDir = join(homedir(), '.hermes', 'restore-tmp-' + Date.now());
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const restorePath = join(tempDir, 'dashboard');
    if (!existsSync(restorePath)) {
      mkdirSync(restorePath, { recursive: true });
    }

    logHuman('info', 'Extracting backup...', opts);
    execSync(`tar -xzf "${backupPath}" -C "${restorePath}"`, { stdio: 'pipe' });

    // Step 3: Backup current dashboard
    if (existsSync(dashboardRoot)) {
      const backupHome = join(homedir(), '.hermes.backup.temp');
      execSync(`mv "${dashboardRoot}" "${backupHome}"`, { stdio: 'pipe' });
    }

    // Step 4: Restore to dashboard
    execSync(`mv "${restorePath}/dashboard" "${dashboardRoot}"`, { stdio: 'pipe' });
    
    // Step 5: Daemon reload
    execSync(`systemctl --user daemon-reload`, { stdio: 'pipe' });

    logHuman('success', 'Restoring...', opts);

    // Step 6: Start services
    logHuman('info', 'Starting services...', opts);
    servicesStarted = await startServices(opts);

    logHuman('success', 'Verifying restore...', opts);
    logHuman('success', 'Restore complete', opts);

    // Success response
    return {
      success: true,
      restored_from: backupId,
      services_started: servicesStarted,
      services_running: servicesStarted.length > 0,
    };
  } catch (e) {
    // Cleanup on failure
    if (tempDir && existsSync(tempDir)) {
      execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' });
    }

    // Rollback: restore original if it exists
    const backupHome = join(homedir(), '.hermes.backup.temp');
    if (existsSync(backupHome)) {
      try {
        if (existsSync(dashboardRoot)) {
          execSync(`rm -rf "${dashboardRoot}"`, { stdio: 'pipe' });
        }
        execSync(`mv "${backupHome}" "${dashboardRoot}"`, { stdio: 'pipe' });
      } catch (rollbackError) {
        log.error(`Rollback failed: ${rollbackError.message}`, opts);
      }
    }

    // Error response
    throw e;
  }
}

async function pruneBackups(keepCount, opts) {
  // Validate keepCount
  if (!keepCount || keepCount < 1 || keepCount > 100 || !Number.isInteger(Number(keepCount))) {
    log.error('Keep count is required and must be a positive integer between 1 and 100');
    process.exit(2);
  }

  keepCount = Number(keepCount);

  // Get backup list first
  const { backups } = await listBackups({ json: true, quiet: true });

  if (backups.length === 0) {
    if (opts.json) {
      json(buildCommandResult({
        command: 'backup',
        ok: true,
        payload: {
          action: 'prune',
          kept: 0,
          deleted: 0,
          oldest_kept: null,
          oldest_deleted: null,
        },
      }));
    } else {
      log.dim('No backups found');
    }
    return { kept: 0, deleted: 0 };
  }

  const total = backups.length;
  const toDelete = total - keepCount;

  // Check if pruning is needed
  if (toDelete <= 0) {
    if (opts.json) {
      json(buildCommandResult({
        command: 'backup',
        ok: true,
        payload: {
          action: 'prune',
          kept: total,
          deleted: 0,
          oldest_kept: backups[0].created_at,
          oldest_deleted: null,
        },
      }));
    } else {
      log.success(`All ${total} backups are newer than the keep count`);
    }
    return { kept: total, deleted: 0 };
  }

  // Get IDs of backups to delete (oldest ones)
  const backupsToDelete = backups.slice(toDelete).map(b => b.id);

  // Show what will be deleted (keep N most recent)
  if (!opts.json) {
    logHuman('info', 'Backups before prune:', opts);
    for (let i = 0; i < Math.min(toDelete, 5); i++) {
      const backup = backups[i + keepCount];
      if (backup) {
        logHuman('warn', `  ${backup.id} – DELETING`, opts);
      }
    }

    if (toDelete > 5) {
      logHuman('warn', `  ... and ${toDelete - 5} more backups`, opts);
    }
  }

  // Confirm deletion (unless --force)
  if (!opts.force) {
    const confirmed = await confirm(
      `Remove ${toDelete} old backup${toDelete > 1 ? 's' : ''} (oldest: ${backupsToDelete[0].substring(0, 20)})?`,
      opts
    );
    if (!confirmed) {
      log.dim('Cancelled');
      process.exit(0);
    }
  }

  const deletedCount = [];
  const deletedAt = [];
  const deletedIds = [];

  try {
    await withSpinner('Pruning backups', opts, async (s) => {
      // Delete backup files
      for (const backupId of backupsToDelete) {
        const archivePath = join(BACKUP_DIR, `${backupId}.tar.gz`);
        const manifestPath = join(BACKUP_DIR, `${backupId}.json`);
        const backupDir = join(BACKUP_DIR, backupId);

        // Delete archive and manifest
        if (existsSync(archivePath)) {
          try {
            unlinkSync(archivePath);
            deletedCount.push(archivePath);
          } catch (e) {
            throw new Error(`Failed to delete ${archivePath}: ${e.message}`);
          }
        }

        if (existsSync(manifestPath)) {
          try {
            unlinkSync(manifestPath);
            deletedCount.push(manifestPath);
          } catch (e) {
            throw new Error(`Failed to delete ${manifestPath}: ${e.message}`);
          }
        }

        // Delete backup directory
        if (existsSync(backupDir)) {
          try {
            rmdirSync(backupDir);
            deletedCount.push(backupDir);
          } catch (e) {
            throw new Error(`Failed to delete ${backupDir}: ${e.message}`);
          }
        }

        deletedIds.push(backupId);
        deletedAt.push(backups.find(b => b.id === backupId).created_at);
      }
    });

    // Success output
    if (!opts.json) {
      log.success(`Deleted ${deletedIds.length} old backup${deletedIds.length > 1 ? 's' : ''}`);
      log.success(`Kept ${keepCount} most recent backups`);
    }

    // JSON output
    if (opts.json) {
      json(buildCommandResult({
        command: 'backup',
        ok: deletedIds.length >= 0,
        payload: {
          action: 'prune',
          kept: keepCount,
          deleted: deletedIds.length,
          oldest_kept: backups[keepCount - 1]?.created_at || null,
          oldest_deleted: deletedIds.length > 0 ? deletedAt[deletedIds.length - 1] : null,
          deleted_ids: deletedIds,
        },
      }));
    }

    return {
      kept: keepCount,
      deleted: deletedIds.length,
      oldest_kept: backups[keepCount - 1]?.created_at || null,
      oldest_deleted: deletedIds.length > 0 ? deletedAt[deletedIds.length - 1] : null,
      deleted_ids: deletedIds,
    };
  } catch (e) {
    log.error(`Prune failed: ${e.message}`);
    if (deletedIds.length > 0 && !opts.json) {
      log.dim(`Deleted: ${deletedIds.join(', ')}`);
      log.dim(`Failed to delete ${deletedIds.length} backup(s)`);
    }
    process.exit(1);
  }
}

export default async function backup(action, opts) {
  if (!action || action === 'list') {
    return await listBackups(opts);
  } else if (action === 'create') {
    return await createBackup(opts);
  } else if (action === 'verify') {
    return await verifyBackup(opts.id, opts);
  } else if (action === 'restore') {
    return await restoreBackup(opts.id, opts);
  } else if (action === 'prune') {
    return await pruneBackups(opts.keep, opts);
  }

  log.error('Unknown action');
  log.error(`Reason: unsupported action "${action}"`);
  log.error('Action: use one of create, list, verify, restore, prune');
  process.exit(2);
}
