import Table from 'cli-table3';
import chalk from 'chalk';
import { log, header, json } from '../lib/logger.js';
import { withSpinner } from '../lib/exec.js';

async function fetchAgentStatus() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch('http://localhost:5174/api/agent/status', {
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, data: null, message: 'Agent API not available' };
    }

    const text = await res.text();
    if (!text) {
      return { ok: false, data: null, message: 'Empty response from agent API' };
    }

    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, data: null, message: 'Invalid JSON response from agent API' };
    }
  } catch (err) {
    return { ok: false, data: null, message: 'Agent API not available' };
  } finally {
    clearTimeout(timer);
  }
}

export default async function agentStatus(opts) {
  const result = await withSpinner(
    'Querying agent status...',
    opts,
    async () => await fetchAgentStatus()
  );

  if (opts.json) {
    if (!result.ok) {
      json({ running: false, error: result.message });
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
  header('Agent Status');

  const status = data.running ? chalk.green('● ACTIVE') : chalk.gray('○ IDLE');
  const pid = data.session_id || '—';
  const label = data.session_label || '—';
  const uptime = formatUptime(data.uptime_seconds);
  const tokens = formatNumber(data.tokens_today);
  const pending = data.pending_approvals || 0;

  console.log(`  Status: ${status}`);
  console.log(`  Session: ${label} (${pid})`);
  console.log(`  Uptime: ${uptime}`);
  console.log(`  Tokens today: ${tokens}`);
  console.log(`  Last action: ${data.last_action?.description || '—'} (${data.last_action ? formatAgo(data.last_action.ago_seconds) : '—'})`);
  console.log(`  Pending approvals: ${pending}`);
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

function formatNumber(num) {
  if (!num) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

function formatAgo(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);
  if (hours > 0) {
    return `${hours}h ${mins % 60}m`;
  }
  return `${mins}m`;
}