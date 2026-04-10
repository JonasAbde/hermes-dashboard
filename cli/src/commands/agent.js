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

// Fetch pending approvals as table
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

export default async function agent(action, opts) {
  // Handle 'approve' subcommand
  if (action === 'approve') {
    const { all, force, reject: rejectReason, json: jsonFlag } = opts;

    // If --all flag is set, require confirmation
    if (all) {
      if (jsonFlag) {
        throw new Error('Confirmation not available in JSON mode');
      }

      // Check if we have pending approvals first
      const pendingResult = await withSpinner(
        'Fetching pending approvals...',
        { json: jsonFlag },
        fetchPendingApprovals
      );

      if (!pendingResult.ok) {
        if (json) {
          json({ pending: [], error: pendingResult.message || 'Agent API not available' });
        } else {
          log.warn(pendingResult.message || 'Agent API not available');
        }
        return;
      }

      const approvals = pendingResult.data || [];
      const count = approvals.length;

      if (count === 0) {
        console.log('  No pending approvals');
        return;
      }

      const confirmed = await confirm(
        `This will approve all ${count} approvals. Continue?`,
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
      if (!opts.id) {
        console.log('  ✖ Please specify an approval ID');
        return;
      }

      const id = opts.id;

      const result = await withSpinner(
        `Rejecting approval #${id}...`,
        { json: jsonFlag },
        () => rejectApproval(id, rejectReason)
      );

      formatRejectResult(result, json);
      return;
    }

    // Approve specific action
    if (opts.id) {
      const id = opts.id;

      const result = await withSpinner(
        `Approving approval #${id}...`,
        { json: jsonFlag },
        () => approveApproval(id)
      );

      formatApproveResult(result, json);
      return;
    }

    // Default: list pending approvals
    const result = await withSpinner(
      'Fetching pending approvals...',
      { json: jsonFlag },
      fetchPendingApprovals
    );

    if (!result.ok) {
      if (json) {
        json({ pending: [], error: result.message || 'Agent API not available' });
      } else {
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
    return;
  }

  // Handle 'skills' subcommand
  if (action === 'skills') {
    const { list, enable, disable, info, json: jsonFlag, name } = opts;
    const listSub = list || enable || disable || info;

    if (listSub === 'list') {
      // List all skills
      const result = await withSpinner(
        'Fetching skills...',
        { json: jsonFlag },
        async () => {
          const res = await httpFetch('/api/agent/skills');
          if (!res.ok) throw new Error(res.message || 'Failed to fetch skills');
          return res.data;
        }
      );

      if (result.ok) {
        const data = result.data || {};
        const skills = data.skills || [];
        const total = skills.length;
        const enabled = skills.filter(s => s.enabled).length;

        if (json) {
          json({ skills, total, enabled });
        } else {
          header(`Skills (${total} total, ${enabled} enabled)`);
          const table = new Table({
            head: ['Name', 'Status', 'Last Used'],
            colWidths: [30, 10, 20],
            style: { head: ['cyan'] },
          });
          skills.forEach(skill => {
            const status = skill.enabled ? '✓ Enabled' : '✗ Disabled';
            const lastUsed = skill.lastUsed || '—';
            table.push([skill.name, status, lastUsed]);
          });
          console.log(table.toString());
          console.log('');
        }
      }
      return;
    }

    if (enable && name) {
      // Enable a skill
      const result = await withSpinner(
        `Enabling skill "${name}"...`,
        { json: jsonFlag },
        async () => {
          const res = await httpFetch(`/api/agent/skills/${name}/enable`, {
            method: 'POST',
          });
          if (!res.ok) throw new Error(res.message || 'Failed to enable skill');
          return res.data;
        }
      );

      if (result.ok) {
        if (json) {
          json({ success: true, skill: name });
        } else {
          console.log(`  ✔ Skill "${name}" enabled`);
        }
      }
      return;
    }

    if (disable && name) {
      // Disable a skill
      const result = await withSpinner(
        `Disabling skill "${name}"...`,
        { json: jsonFlag },
        async () => {
          const res = await httpFetch(`/api/agent/skills/${name}/disable`, {
            method: 'POST',
          });
          if (!res.ok) throw new Error(res.message || 'Failed to disable skill');
          return res.data;
        }
      );

      if (result.ok) {
        if (json) {
          json({ success: true, skill: name });
        } else {
          console.log(`  ✔ Skill "${name}" disabled`);
        }
      }
      return;
    }

    if (info && name) {
      // Get skill info
      const result = await withSpinner(
        `Fetching skill "${name}" info...`,
        { json: jsonFlag },
        async () => {
          const res = await httpFetch(`/api/agent/skills/${name}`);
          if (!res.ok) throw new Error(res.message || 'Failed to fetch skill info');
          return res.data;
        }
      );

      if (result.ok) {
        const data = result.data;
        if (json) {
          json(data);
        } else {
          header(`Skill: ${name}`);
          if (data.description) console.log(`  ${data.description}`);
          if (data.tags) console.log(`  Tags: ${data.tags.join(', ')}`);
          if (data.enabled !== undefined) {
            console.log(`  Status: ${data.enabled ? 'Enabled' : 'Disabled'}`);
          }
          if (data.lastUsed) console.log(`  Last Used: ${data.lastUsed}`);
        }
      }
      return;
    }

    // Default: list skills
    log.warn(`Unknown skills action: ${listSub || 'list'}`);
    console.log('  Available: list, enable <name>, disable <name>, info <name>');
    return;
  }

  // Handle 'send' subcommand
  if (action === 'send') {
    const { message, session: sessionId, json: jsonFlag } = opts;

    if (!message) {
      console.log('  ✖ Please provide a message');
      console.log('  Usage: hdb agent send <message> [--session <id>]');
      return;
    }

    const session = sessionId || 'telegram:14162'; // Default: telegram home

    const result = await withSpinner(
      `Sending message to session ${session}...`,
      { json: jsonFlag },
      async () => {
        const res = await httpFetch('/api/agent/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: session, message }),
        });
        if (!res.ok) throw new Error(res.message || 'Failed to send message');
        return res.data;
      }
    );

    if (result.ok) {
      const data = result.data;
      if (json) {
        json({ sent: true, session_id: session, message });
      } else {
        console.log(`  ✔ Message sent to session ${session}`);
      }
    }
    return;
  }

  // Handle 'history' subcommand
  if (action === 'history') {
    const { limit, json: jsonFlag } = opts;

    const limitValue = limit ? parseInt(limit, 10) : 10;

    if (limitValue < 1 || limitValue > 100) {
      console.log('  ✖ Limit must be between 1 and 100');
      return;
    }

    const result = await withSpinner(
      'Fetching agent history...',
      { json: jsonFlag },
      async () => {
        const res = await httpFetch(`/api/agent/history?limit=${limitValue}`);
        if (!res.ok) throw new Error(res.message || 'Failed to fetch history');
        return res.data;
      }
    );

    if (result.ok) {
      const data = result.data;
      const actions = data.actions || [];

      if (json) {
        json({ actions, limit: limitValue });
      } else {
        header(`Agent History (last ${actions.length} actions)`);
        const table = new Table({
          head: ['Time', 'Type', 'Description'],
          colWidths: [15, 15, 40],
          style: { head: ['cyan'] },
        });
        actions.forEach(action => {
          const time = action.time || '—';
          const type = action.type || '—';
          const desc = action.description || '—';
          table.push([time, type, desc]);
        });
        console.log(table.toString());
        console.log('');
      }
    }
    return;
  }

  // Unknown action
  log.warn(`Unknown agent action: ${action}`);
  console.log('  Available actions: approve, sessions, skills, send, history');
}
