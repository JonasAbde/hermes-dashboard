import Table from 'cli-table3';
import chalk from 'chalk';
import { log, header, json } from '../lib/logger.js';
import { withSpinner } from '../lib/exec.js';

async function fetchAgentSessions(opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const url = opts.all
      ? 'http://localhost:5174/api/agent/sessions?all=true'
      : 'http://localhost:5174/api/agent/sessions';

    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      return { ok: false, data: null, message: 'Agent API not available' };
    }

    const text = await res.text();
    if (!text) {
      return { ok: false, data: null, message: 'Empty response from agent API' };
    }

    try {
      const parsed = JSON.parse(text);
      // Normalize API response
      if (!parsed.sessions && !parsed.all) {
        return { ok: false, data: null, message: 'Unexpected format from agent API' };
      }
      return { ok: true, data: parsed };
    } catch {
      return { ok: false, data: null, message: 'Invalid JSON response from agent API' };
    }
  } catch (err) {
    return { ok: false, data: null, message: 'Agent API not available' };
  } finally {
    clearTimeout(timer);
  }
}

export default async function agentSessions(opts) {
  const result = await withSpinner(
    'Querying agent sessions...',
    opts,
    async () => await fetchAgentSessions(opts)
  );

  if (opts.json) {
    if (!result.ok) {
      json({ sessions: [], total_active: 0, total_cached: 0, error: result.message });
    } else {
      json(result.data);
    }
    return;
  }

  if (!result.ok) {
    log.warn('Agent offline - no data');
    return;
  }

  const data = result.data;
  header('Agent Sessions');

  let sessions = data.sessions || [];
  if (!Array.isArray(sessions)) {
    sessions = [];
  }

  // Sort: active first, then by started_at (newest first)
  sessions.sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    if (a.started_at && b.started_at) {
      return new Date(b.started_at) - new Date(a.started_at);
    }
    return 0;
  });

  if (sessions.length === 0) {
    log.dim('No sessions found');
    return;
  }

  const table = new Table({
    head: ['ID', 'Label', 'Status', 'Uptime', 'Current Task', 'Started'].map((h) =>
      chalk.cyan(h)
    ),
    style: { head: [], border: [] },
  });

  for (const session of sessions) {
    const id = session.id || '—';
    const label = session.label || '—';
    const status = session.status
      ? session.status === 'active'
        ? chalk.green('ACTIVE')
        : session.status === 'cached'
        ? chalk.yellow('CACHED')
        : chalk.gray('CLOSED')
      : chalk.gray('—');
    const uptime = formatUptime(session.uptime_seconds);
    const task = session.current_task || '—';
    const started = session.started_at ? new Date(session.started_at).toLocaleString() : '—';

    table.push([id, label, status, uptime, task, started]);
  }

  console.log(table.toString());

  // Summary
  const totalActive = sessions.filter((s) => s.status === 'active').length;
  const totalCached = sessions.filter((s) => s.status === 'cached' || s.status === 'closed').length;

  console.log();
  log.dim(`Total sessions: ${sessions.length}`);
  if (totalActive > 0) {
    log.success(`Active sessions: ${totalActive}`);
  }
  if (totalCached > 0) {
    log.info(`Cached/Closed sessions: ${totalCached}`);
  }
}

function formatUptime(seconds) {
  if (!seconds) return '—';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}
