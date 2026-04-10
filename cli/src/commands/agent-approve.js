import { log, json, header } from '../lib/logger.js';
import { withSpinner } from '../lib/exec.js';
import { confirm } from '../lib/confirm.js';
import Table from 'cli-table3';

// Agent API endpoint
const AGENT_API = 'http://localhost:5174';

// Fetch helper with timeout and error handling
async function httpFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 5000);

  try {
    const res = await fetch(`${AGENT_API}${url}`, {
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timer);

    const text = await res.text();

    if (!res.ok) {
      return { ok: false, data: null, status: res.status, message: text || res.statusText };
    }

    try {
      return { ok: true, data: text ? JSON.parse(text) : {} };
    } catch {
      return { ok: true, data: text };
    }
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, data: null, message: err.message || 'Network error' };
  }
}

// Fetch pending approvals from agent API
async function fetchPendingApprovals() {
  return httpFetch('/api/agent/approvals/pending');
}

// Approve a specific approval
async function approveApproval(id) {
  const result = await httpFetch(`/api/agent/approvals/${id}/approve`, {
    method: 'POST',
  });

  if (!result.ok) {
    throw new Error(result.message || 'Failed to approve approval');
  }

  return result.data;
}

// Reject a specific approval
async function rejectApproval(id, reason) {
  const result = await httpFetch(`/api/agent/approvals/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  if (!result.ok) {
    throw new Error(result.message || 'Failed to reject approval');
  }

  return result.data;
}

// Approve all pending approvals
async function approveAllApprovals() {
  const pendingResult = await fetchPendingApprovals();

  if (!pendingResult.ok || !pendingResult.data?.length) {
    throw new Error(pendingResult.message || 'No pending approvals found');
  }

  const approvals = pendingResult.data;
  const results = [];

  for (const approval of approvals) {
    const result = await approveApproval(approval.id);
    results.push({ id: approval.id, approved: true });
  }

  return { total: approvals.length, results };
}

// Format pending approvals as a table
function formatPendingApprovals(approvals, json) {
  if (json) {
    return approvals;
  }

  if (!approvals || approvals.length === 0) {
    console.log('  No pending approvals');
    return [];
  }

  console.log('  Pending:');
  const table = new Table({
    head: ['#', 'Action', 'Source'],
    colWidths: [6, 40, 20],
    style: { head: ['cyan'] },
  });

  approvals.forEach((approval) => {
    const action = approval.action || '—';
    const source = approval.source || '—';
    table.push([approval.id, action, source]);
  });

  console.log(table.toString());
  console.log('');

  return approvals;
}

// Format approval action result
function formatApproveResult(result, json) {
  if (json) {
    json(result);
  } else {
    console.log(`  ✔ #${result.id} approved — gateway restarting`);
  }
}

// Format reject action result
function formatRejectResult(result, json) {
  if (json) {
    json(result);
  } else {
    const reason = result.reason || 'Wait for review';
    console.log(`  ✔ #${result.id} rejected — "${reason}" sent to agent`);
  }
}

// Format approve all result
function formatApproveAllResult(result, json) {
  if (json) {
    json(result);
  } else {
    console.log(`  ✔ Approved ${result.total} approvals`);
  }
}

export default async function agentApprove(id, opts) {
  const { all, force, reject: rejectReason, json } = opts;

  // If --all flag is set, require confirmation
  if (all) {
    if (json) {
      throw new Error('Confirmation not available in JSON mode');
    }

    const confirmed = await confirm(
      `This will approve all ${id || 'pending'} approvals. Continue?`,
      { force }
    );

    if (!confirmed) {
      console.log('  Aborted');
      return;
    }

    const result = await withSpinner(
      'Approving all pending approvals...',
      { json },
      approveAllApprovals
    );

    formatApproveAllResult(result, json);
    return;
  }

  // Reject action requires --reject argument
  if (rejectReason) {
    if (!id) {
      console.log('  ✖ Please specify an approval ID');
      return;
    }

    const result = await withSpinner(
      `Rejecting approval #${id}...`,
      { json },
      () => rejectApproval(id, rejectReason)
    );

    formatRejectResult(result, json);
    return;
  }

  // Approve specific action
  if (id) {
    const result = await withSpinner(
      `Approving approval #${id}...`,
      { json },
      () => approveApproval(id)
    );

    formatApproveResult(result, json);
    return;
  }

  // Default: list pending approvals
  const result = await withSpinner(
    'Fetching pending approvals...',
    { json },
    fetchPendingApprovals
  );

  if (!result.ok) {
    if (!json) {
      log.warn(result.message || 'Agent API not available');
    }
    return;
  }

  const approvals = result.data || [];

  if (json) {
    json({ pending: approvals });
  } else {
    header('Pending Approvals');
    formatPendingApprovals(approvals, json);
  }
}
