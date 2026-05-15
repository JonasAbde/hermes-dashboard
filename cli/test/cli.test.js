import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const HDB = '/home/empir/.hermes/dashboard/cli/bin/hdb.js';

function run(args, options = {}) {
  const env = {
    ...process.env,
    ...(options.env || {}),
  };

  try {
    return {
      stdout: execSync(`node ${HDB} ${args}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      }),
      exitCode: 0,
    };
  } catch (e) {
    return {
      stdout: e.stdout?.toString() || '',
      stderr: e.stderr?.toString() || '',
      exitCode: e.status || 1,
    };
  }
}

function parseJson(raw) {
  return JSON.parse(raw || '{}');
}

async function withEnv(overrides, cb) {
  const previous = Object.fromEntries(
    Object.entries(overrides).map(([key]) => [key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined])
  );

  Object.entries(overrides).forEach(([key, value]) => {
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  try {
    return await cb();
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}

async function withTtyState(stdoutIsTty, stderrIsTty, cb) {
  const originalStdout = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  const originalStderr = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');

  function restore() {
    if (originalStdout) {
      Object.defineProperty(process.stdout, 'isTTY', originalStdout);
    }
    if (originalStderr) {
      Object.defineProperty(process.stderr, 'isTTY', originalStderr);
    }
  }

  try {
    if (originalStdout?.configurable) {
      Object.defineProperty(process.stdout, 'isTTY', { value: stdoutIsTty });
    }
    if (originalStderr?.configurable) {
      Object.defineProperty(process.stderr, 'isTTY', { value: stderrIsTty });
    }
    return await cb();
  } finally {
    restore();
  }
}

function runJson(args) {
  const result = run(`${args} --json`);
  if (result.exitCode === 0) {
    result.data = parseJson(result.stdout);
  }
  return result;
}

// ── CLI Basics ──────────────────────────────────────────────────────────────

describe('hdb CLI basics', () => {
  it('shows version', () => {
    const r = run('--version');
    assert.equal(r.exitCode, 0);
    assert.match(r.stdout, /^\d+\.\d+\.\d+/);
  });

  it('shows help', () => {
    const r = run('--help');
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.includes('Hermes Dashboard CLI'));
    assert.ok(r.stdout.includes('start'));
    assert.ok(r.stdout.includes('stop'));
    assert.ok(r.stdout.includes('status'));
    assert.ok(r.stdout.includes('doctor'));
    assert.ok(r.stdout.includes('--plain'));
    assert.ok(r.stdout.includes('--skin'));
    assert.ok(r.stdout.includes('--json'));
  });

  it('shows verbose version details', () => {
    const r = run('--version --verbose');
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.includes('hdb v'));
    assert.ok(r.stdout.includes('node'));
    assert.ok(r.stdout.includes('services:'));
  });

  it('verbose version output is parseable schema block', () => {
    const r = run('--version --verbose');
    const lines = r.stdout.split('\n').map((line) => line.trim()).filter(line => line.includes(':'));
    const block = {};
    for (const line of lines) {
      const [key, ...rest] = line.split(':');
      if (!key || !rest.length) continue;
      block[key.trim()] = rest.join(':').trim();
    }

    assert.equal(r.exitCode, 0);
    assert.equal(block.schema_version, '1.0');
    assert.equal(block.command, 'version');
    assert.ok(block.status === 'ok' || block.status === 'warning');
    assert.ok(block.timestamp);
  });

  it('verbose version handles missing dashboard paths gracefully', () => {
    const r = run('--version --verbose', {
      env: {
        HOME: '/tmp/hdb-cli-missing-home-000',
      },
    });
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.includes('schema_version: 1.0'));
  });
});

// ── Lib Modules ─────────────────────────────────────────────────────────────

describe('lib modules load', () => {
  it('health.js exports all functions', async () => {
    const m = await import('../src/lib/health.js');
    assert.ok(m.checkApiHealth);
    assert.ok(m.checkFrontend);
    assert.ok(m.deepHealthCheck);
    assert.ok(m.checkTunnelReachable);
  });

  it('services.js exports all functions', async () => {
    const m = await import('../src/lib/services.js');
    assert.ok(m.start);
    assert.ok(m.stop);
    assert.ok(m.isActive);
    assert.ok(m.getPid);
    assert.ok(m.writePid);
    assert.ok(m.cleanPid);
    assert.ok(m.startAll);
    assert.ok(m.stopAll);
    assert.ok(m.serviceNames.proxy);
  });

  it('ports.js exports all functions', async () => {
    const m = await import('../src/lib/ports.js');
    assert.ok(m.isPortOpen);
    assert.ok(m.killPort);
    assert.ok(m.waitForPort);
    assert.ok(m.KNOWN_PORTS.api);
  });

  it('config.js exports all functions', async () => {
    const m = await import('../src/lib/config.js');
    assert.ok(m.getDashboardRoot);
    assert.ok(m.getVersion);
    assert.ok(m.getEnvVars);
    assert.ok(m.getPublicTunnelUrlPath);
    assert.ok(m.writePublicTunnelUrl);
  });

  it('tunnel.js exports all functions', async () => {
    const m = await import('../src/lib/tunnel.js');
    assert.ok(m.getTunnelUrl);
    assert.ok(m.isTunnelRunning);
    assert.ok(m.startTunnel);
    assert.ok(m.stopTunnel);
    assert.ok(m.readTunnelLog);
    assert.ok(m.getTunnelLogPath);
  });
});

// ── Doctor ──────────────────────────────────────────────────────────────────

describe('hdb doctor', () => {
  it('exits 0 when all deps OK', () => {
    const r = run('doctor');
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.includes('Node.js'));
    assert.ok(r.stdout.includes('npm'));
  });

  it('outputs JSON', () => {
    const r = runJson('doctor');
    assert.equal(r.exitCode, 0);
    assert.ok(r.data.allOk);
    assert.ok(r.data.checks['Node.js'].ok);
  });
});

// ── Status ──────────────────────────────────────────────────────────────────

describe('hdb status', () => {
  it('shows service table', () => {
    const r = run('status');
    assert.ok(r.stdout.includes('API'));
    assert.ok(r.stdout.includes('Vite Dev'));
  });

  it('supports --plain output mode', () => {
    const r = run('status --plain');
    assert.equal(r.exitCode, 0);
    assert.ok(!/\u001b\[[0-9;]*m/.test(r.stdout), 'plain output should disable ANSI color codes');
  });

  it('outputs valid JSON', () => {
    const r = runJson('status');
    assert.equal(r.exitCode, 0);
    assert.ok(r.data.version);
    assert.ok(r.data.services);
    assert.ok(r.data.ports);
  });
});

describe('hdb stop', () => {
  it('validates conflicting flags with exit code 2', () => {
    const r = run('stop --api-only --web-only');
    assert.equal(r.exitCode, 2, 'Should reject conflicting stop flags');
    const output = `${r.stdout}${r.stderr}`;
    assert.ok(output.includes('Invalid stop option combination'));
    assert.ok(output.includes('Reason:'));
    assert.ok(output.includes('Action:'));
  });
});

// ── Start command (syntax) ────────────────────────────────────────────────

describe('hdb start', () => {
  it('shows start help without starting services', () => {
    const r = run('start --help');
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.includes('--api-only'));
    assert.ok(r.stdout.includes('--web-only'));
    assert.ok(r.stdout.includes('--proxy-only'));
  });

  it('start rejects conflicting mode flags with validation exit code', () => {
    const r = run('start --api-only --web-only --json');
    assert.equal(r.exitCode, 2);
    const output = `${r.stdout}${r.stderr}`.toLowerCase();
    assert.ok(output.includes('api-only') && output.includes('web-only'));
  });

  it('help is still plain when requested', () => {
    const r = run('--help --plain');
    assert.equal(r.exitCode, 0);
    assert.ok(!/\u001b\[[0-9;]*m/.test(r.stdout), 'plain mode should disable ANSI');
  });
});

// ── Audit ─────────────────────────────────────────────────────────────────

describe('hdb audit', () => {
  it('returns valid JSON payload with parseable output', () => {
    const r = run('audit --json');
    const payload = parseJson(r.stdout);
    assert.ok(r.exitCode === 0 || r.exitCode === 1 || r.exitCode === 2, 'audit --json should exit with a parseable status');
    assert.ok('services' in payload);
    assert.ok('ports' in payload);
    assert.ok('backups' in payload);
  });

  it('audit JSON follows command-result schema', () => {
    const r = run('audit --json');
    const payload = parseJson(r.stdout);
    assert.equal(payload.command, 'audit');
    assert.equal(payload.schema_version, '1.0');
    assert.ok('timestamp' in payload);
    assert.ok('environment' in payload);
    assert.ok('ok' in payload);
    assert.ok(payload.status === 'ok' || payload.status === 'warning' || payload.status === 'critical');
  });
});

// ── Health ──────────────────────────────────────────────────────────────────

describe('hdb health', () => {
  it('runs health checks', () => {
    const r = run('health');
    assert.ok(/health/i.test(r.stdout));
  });

  it('outputs valid JSON', () => {
    const r = runJson('health');
    assert.equal(r.exitCode, 0);
    assert.ok(r.data.api);
    assert.ok(r.data.proxy);
    assert.ok(r.data.tunnel);
  });
});

// ── Tunnel ──────────────────────────────────────────────────────────────────

describe('hdb tunnel', () => {
  it('shows tunnel status', () => {
    const r = run('tunnel status');
    assert.ok(/tunnel/i.test(r.stdout));
  });

  it('prints tunnel URL', () => {
    const r = run('tunnel url');
    // May or may not have a URL, but should not crash
    assert.equal(r.exitCode, 0);
  });

  it('outputs valid JSON', () => {
    const r = runJson('tunnel status');
    assert.equal(r.exitCode, 0);
    assert.ok('running' in r.data);
    assert.ok('url' in r.data);
  });

  it('status JSON defaults for empty action', () => {
    const r = run('tunnel --json');
    const payload = JSON.parse(r.stdout || '{}');
    assert.ok(r.exitCode === 0 || r.exitCode === 1, 'tunnel --json should return status payload');
    assert.ok('running' in payload);
  });

  it('tunnel JSON uses standardized command schema', () => {
    const r = run('tunnel status --json');
    const payload = parseJson(r.stdout);
    assert.equal(r.exitCode, 0);
    assert.equal(payload.command, 'tunnel');
    assert.equal(payload.schema_version, '1.0');
    assert.ok(typeof payload.ok === 'boolean');
  });
});

// ── Output policy ───────────────────────────────────────────────────────────

describe('output policy', () => {
  it('supports skin option values in output policy', async () => {
    const { buildOutputPolicy } = await import('../src/lib/output-policy.js');
    const vivid = buildOutputPolicy({ skin: 'vivid' });
    const experimental = buildOutputPolicy({ skin: 'experimental' });
    const fallback = buildOutputPolicy({ skin: 'bogus' });
    assert.equal(vivid.skin, 'vivid');
    assert.equal(experimental.skin, 'experimental');
    assert.equal(fallback.skin, 'standard');
  });

  it('keeps JSON clean with skin flag', () => {
    const r = run('doctor --json --skin vivid');
    const parsed = parseJson(r.stdout);
    assert.equal(r.exitCode, 0);
    assert.equal(parsed.command, 'doctor');
    assert.ok(Object.keys(parsed).length > 0, 'JSON should parse into object');
  });

  it('status supports NO_COLOR', () => {
    const r = run('status', { env: { NO_COLOR: '1' } });
    assert.equal(r.exitCode, 0);
    assert.ok(!/\u001b\[[0-9;]*m/.test(r.stdout), 'NO_COLOR should disable ANSI escapes');
  });

  it('supports FORCE_COLOR in headless contexts', async () => {
    await withEnv({ FORCE_COLOR: '1', NO_COLOR: undefined, TERM: 'dumb', CI: undefined }, async () => {
      await withTtyState(false, false, async () => {
        const { buildOutputPolicy } = await import('../src/lib/output-policy.js');
        const policy = buildOutputPolicy({});
        assert.equal(policy.colorEnabled, true, 'FORCE_COLOR should force color even without TTY');
        assert.equal(policy.plain, false);
      });
    });
  });
});

// ── Env ─────────────────────────────────────────────────────────────────────

describe('hdb env', () => {
  it('shows env vars', () => {
    const r = run('env');
    assert.ok(r.stdout.includes('Variables'));
  });

  it('outputs valid JSON', () => {
    const r = runJson('env');
    assert.equal(r.exitCode, 0);
    assert.ok(r.data.vars);
    assert.ok(Array.isArray(r.data.missing));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPANDED TESTS — Error handling, validation, schemas, edge cases
// ═══════════════════════════════════════════════════════════════════════════

// ── Error Handling ──────────────────────────────────────────────────────────

describe('error handling', () => {
  it('global handler catches unhandled rejection', () => {
    const content = readFileSync(HDB, 'utf-8');
    assert.ok(content.includes('unhandledRejection'), 'Missing global rejection handler');
    assert.ok(content.includes('uncaughtException'), 'Missing global exception handler');
  });

  it('global handler exits with code 1 on rejection', () => {
    const content = readFileSync(HDB, 'utf-8');
    assert.ok(content.includes("process.exit(1)"), 'Global handler should call process.exit(1)');
  });

  it('global handler prints error message in red', () => {
    const content = readFileSync(HDB, 'utf-8');
    assert.ok(content.includes('Unexpected error:'), 'Global handler should include error label');
  });
});

// ── Tunnel Error Cases ─────────────────────────────────────────────────────

describe('hdb tunnel errors', () => {
  it('exits non-zero for unknown action', () => {
    const r = run('tunnel bogus-action');
    assert.notEqual(r.exitCode, 0, 'Should exit non-zero for unknown action');
  });

  it('unknown action exits with code 2 (usage error)', () => {
    const r = run('tunnel bogus-action');
    assert.equal(r.exitCode, 2, 'Should use exit code 2 for usage errors');
  });

  it('shows error message for unknown action', () => {
    const r = run('tunnel bogus-action');
    const output = r.stderr + r.stdout;
    assert.ok(output.includes('Unknown action'), 'Should show error message');
    assert.ok(output.includes('Reason:'));
    assert.ok(output.includes('Action:'));
  });

  it('suggests valid actions on error', () => {
    const r = run('tunnel bogus-action');
    const output = r.stderr + r.stdout;
    assert.ok(output.includes('status'), 'Should mention status');
    assert.ok(output.includes('url'), 'Should mention url');
    assert.ok(output.includes('restart'), 'Should mention restart');
  });

  it('tunnel with no action defaults to status', () => {
    const r = run('tunnel');
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.includes('Tunnel'), 'No action should show tunnel status');
  });
});

// ── Logs Validation ────────────────────────────────────────────────────────

describe('hdb logs validation', () => {
  it('rejects unknown service name', () => {
    const r = run('logs nonexistent-service');
    assert.equal(r.exitCode, 1, 'Should exit 1 for unknown service');
  });

  it('shows error message for unknown service', () => {
    const r = run('logs bogus-svc');
    const output = r.stderr + r.stdout;
    assert.ok(output.includes('Unknown service'), 'Should mention unknown service');
  });

  it('suggests available services on error', () => {
    const r = run('logs bad-service');
    const output = r.stderr + r.stdout;
    assert.ok(output.includes('api'), 'Should mention api');
    assert.ok(output.includes('web'), 'Should mention web');
    assert.ok(output.includes('tunnel'), 'Should mention tunnel');
  });

  it('accepts --lines flag', () => {
    const r = run('logs api --lines=5');
    // Should not crash with the flag
    assert.ok(r.exitCode === 0 || r.exitCode === 1, 'Should accept --lines flag');
  });

  it('accepts -n shorthand for lines', () => {
    const r = run('logs api -n 5');
    assert.ok(r.exitCode === 0 || r.exitCode === 1, 'Should accept -n flag');
  });

  it('no arg defaults to showing all services', () => {
    const r = run('logs');
    const output = r.stderr + r.stdout;
    assert.ok(output.includes('api'), 'Should mention api');
    assert.ok(output.includes('web'), 'Should mention web');
    assert.ok(output.includes('tunnel'), 'Should mention tunnel');
  });

  it('accepts "all" as service name', () => {
    const r = run('logs all');
    assert.equal(r.exitCode, 0, 'Should accept "all" service');
  });

  it('accepts "api" as service name', () => {
    const r = run('logs api');
    assert.ok(r.exitCode === 0 || r.exitCode === 1, 'Should accept "api" service');
  });

  it('accepts "web" as service name', () => {
    const r = run('logs web');
    assert.ok(r.exitCode === 0 || r.exitCode === 1, 'Should accept "web" service');
  });

  it('accepts "tunnel" as service name', () => {
    const r = run('logs tunnel');
    assert.ok(r.exitCode === 0 || r.exitCode === 1, 'Should accept "tunnel" service');
  });
});

// ── withSpinner and jsonOrHuman helpers ─────────────────────────────────────

describe('exec.js helpers', () => {
  it('exports withSpinner and jsonOrHuman', async () => {
    const m = await import('../src/lib/exec.js');
    assert.ok(m.withSpinner, 'withSpinner exported');
    assert.ok(m.jsonOrHuman, 'jsonOrHuman exported');
  });

  it('withSpinner calls fn and returns result', async () => {
    const { withSpinner } = await import('../src/lib/exec.js');
    const result = await withSpinner('Test', { json: true }, () => 42);
    assert.equal(result, 42, 'Should return fn result');
  });

  it('withSpinner suppresses spinner in JSON mode', async () => {
    const { withSpinner } = await import('../src/lib/exec.js');
    // Should not throw or print when json:true
    const result = await withSpinner('Silent', { json: true }, () => 'ok');
    assert.equal(result, 'ok');
  });

  it('withSpinner suppresses spinner in plain mode', async () => {
    const { withSpinner } = await import('../src/lib/exec.js');
    let receivedSpinner = null;
    const result = await withSpinner('Test', { plain: true }, (s) => {
      receivedSpinner = s;
      return 'done';
    });
    assert.equal(result, 'done');
    assert.equal(receivedSpinner, null, 'Spinner should be null in plain mode');
  });

  it('withSpinner suppresses spinner in CI environments', async () => {
    await withEnv({ CI: 'true', FORCE_COLOR: undefined, NO_COLOR: undefined }, async () => {
      const { withSpinner } = await import('../src/lib/exec.js');
      let receivedSpinner = null;
      const result = await withSpinner('Test', { json: false }, (s) => {
        receivedSpinner = s;
        return 'done';
      });
      assert.equal(result, 'done');
      assert.equal(receivedSpinner, null, 'Spinner should be null when CI=true');
    });
  });

  it('withSpinner suppresses spinner in TERM=dumb', async () => {
    await withEnv({ TERM: 'dumb', CI: undefined, FORCE_COLOR: undefined, NO_COLOR: undefined }, async () => {
      const { withSpinner } = await import('../src/lib/exec.js');
      let receivedSpinner = null;
      const result = await withSpinner('Test', { json: false }, (s) => {
        receivedSpinner = s;
        return 'done';
      });
      assert.equal(result, 'done');
      assert.equal(receivedSpinner, null, 'Spinner should be null when TERM=dumb');
    });
  });

  it('withSpinner suppresses spinner when stdout/stderr are non-TTY', async () => {
    await withTtyState(false, false, async () => {
      const { withSpinner } = await import('../src/lib/exec.js');
      let receivedSpinner = null;
      const result = await withSpinner('Test', { json: false }, (s) => {
        receivedSpinner = s;
        return 'done';
      });
      assert.equal(result, 'done');
      assert.equal(receivedSpinner, null, 'Spinner should be null in non-TTY mode');
    });
  });

  it('withSpinner suppresses spinner in combined headless environment', async () => {
    await withEnv({ CI: 'true', TERM: 'dumb' }, async () => {
      await withTtyState(false, false, async () => {
        const { withSpinner } = await import('../src/lib/exec.js');
        let receivedSpinner = null;
        const result = await withSpinner('Test', { json: false }, (s) => {
          receivedSpinner = s;
          return 'done';
        });
        assert.equal(result, 'done');
        assert.equal(receivedSpinner, null, 'Spinner should remain disabled in combined headless mode');
      });
    });
  });

  it('withSpinner re-throws errors from fn', async () => {
    const { withSpinner } = await import('../src/lib/exec.js');
    await assert.rejects(
      () => withSpinner('Fail', { json: true }, () => { throw new Error('boom'); }),
      { message: 'boom' },
      'Should re-throw fn errors'
    );
  });

  it('jsonOrHuman outputs JSON when opts.json', async () => {
    const { jsonOrHuman } = await import('../src/lib/exec.js');
    const data = { test: true };
    // Should not throw
    jsonOrHuman({ json: true }, data);
  });

  it('jsonOrHuman calls humanFn when not json', async () => {
    const { jsonOrHuman } = await import('../src/lib/exec.js');
    let called = false;
    jsonOrHuman({ json: false }, { x: 1 }, () => { called = true; });
    assert.ok(called, 'Should call humanFn in human mode');
  });

  it('jsonOrHuman returns data', async () => {
    const { jsonOrHuman } = await import('../src/lib/exec.js');
    const data = { hello: 'world' };
    const result = jsonOrHuman({ json: true }, data);
    assert.deepEqual(result, data, 'Should return the data');
  });
});

// ── Confirm helper ─────────────────────────────────────────────────────────

describe('confirm helper', () => {
  it('exports confirm function', async () => {
    const m = await import('../src/lib/confirm.js');
    assert.ok(m.confirm, 'confirm exported');
  });

  it('returns true when force=true', async () => {
    const { confirm } = await import('../src/lib/confirm.js');
    const result = await confirm('Test?', { force: true });
    assert.equal(result, true, 'Should auto-confirm with force');
  });

  it('returns true when yes=true', async () => {
    const { confirm } = await import('../src/lib/confirm.js');
    const result = await confirm('Test?', { yes: true });
    assert.equal(result, true, 'Should auto-confirm with yes');
  });

  it('returns true when both force and yes are set', async () => {
    const { confirm } = await import('../src/lib/confirm.js');
    const result = await confirm('Test?', { force: true, yes: true });
    assert.equal(result, true);
  });

  it('is an async function', async () => {
    const { confirm } = await import('../src/lib/confirm.js');
    const result = confirm('Test?', { force: true });
    assert.ok(result instanceof Promise, 'Should return a Promise');
    await result;
  });
});

// ── JSON Output Schemas ────────────────────────────────────────────────────

describe('JSON output schemas', () => {
  it('status JSON has expected shape', () => {
    const r = runJson('status');
    assert.equal(r.exitCode, 0);
    assert.equal(r.data.command, 'status');
    assert.equal(r.data.schema_version, '1.0');
    assert.ok('version' in r.data, 'Should have version');
    assert.ok('services' in r.data, 'Should have services');
    assert.ok('api' in r.data.services, 'Should have api service');
    assert.ok('running' in r.data.services.api, 'api should have running');
    assert.ok('port' in r.data.services.api, 'api should have port');
    assert.ok('pid' in r.data.services.api, 'api should have pid');
    assert.ok('healthy' in r.data.services.api, 'api should have healthy');
    assert.ok('web' in r.data.services, 'Should have web service');
    assert.ok('running' in r.data.services.web, 'web should have running');
    assert.ok('port' in r.data.services.web, 'web should have port');
    assert.ok('tunnel' in r.data.services, 'Should have tunnel service');
    assert.ok('running' in r.data.services.tunnel, 'tunnel should have running');
    assert.ok('ports' in r.data, 'Should have ports');
    assert.ok(5174 in r.data.ports, 'Should track port 5174');
    assert.ok(5175 in r.data.ports, 'Should track port 5175');
    assert.ok('proxy' in r.data, 'Should have proxy field');
  });

  it('status JSON has correct port numbers', () => {
    const r = runJson('status');
    assert.equal(r.data.services.api.port, 5174, 'API port should be 5174');
    assert.equal(r.data.services.web.port, 5175, 'Web port should be 5175');
  });

  it('doctor JSON has expected shape', () => {
    const r = runJson('doctor');
    assert.equal(r.exitCode, 0);
    assert.ok('checks' in r.data, 'Should have checks');
    assert.ok('allOk' in r.data, 'Should have allOk');
    assert.ok('Node.js' in r.data.checks, 'Should check Node.js');
    assert.ok('ok' in r.data.checks['Node.js'], 'Node.js check should have ok field');
    assert.ok('version' in r.data.checks['Node.js'], 'Node.js check should have version');
  });

  it('doctor JSON checks all expected tools', () => {
    const r = runJson('doctor');
    const expected = ['Node.js', 'npm', 'ssh', 'fuser', 'curl', 'git', 'systemctl'];
    for (const tool of expected) {
      assert.ok(tool in r.data.checks, `Should check ${tool}`);
    }
  });

  it('health JSON has expected shape', () => {
    const r = runJson('health');
    assert.equal(r.exitCode, 0);
    assert.equal(r.data.command, 'health');
    assert.equal(r.data.schema_version, '1.0');
    assert.ok('api' in r.data, 'Should have api');
    assert.ok('proxy' in r.data, 'Should have proxy');
    assert.ok('tunnel' in r.data, 'Should have tunnel');
  });

  it('health check results have ok field', () => {
    const r = runJson('health');
    assert.ok('healthy' in r.data.api, 'api should have healthy');
    assert.ok('working' in r.data.proxy, 'proxy should have working');
    assert.ok('reachable' in r.data.tunnel, 'tunnel should have reachable');
  });

  it('tunnel JSON has expected shape', () => {
    const r = runJson('tunnel status');
    assert.equal(r.exitCode, 0);
    assert.ok('running' in r.data, 'Should have running');
    assert.ok('url' in r.data, 'Should have url');
    assert.ok('pid' in r.data, 'Should have pid');
  });

  it('env JSON has expected shape', () => {
    const r = runJson('env');
    assert.equal(r.exitCode, 0);
    assert.ok('vars' in r.data, 'Should have vars');
    assert.ok('missing' in r.data, 'Should have missing');
    assert.ok(Array.isArray(r.data.missing), 'missing should be an array');
  });

  it('logs JSON has expected shape for specific service', () => {
    const r = runJson('logs api');
    // May fail if no log file, but structure should still be correct
    if (r.exitCode === 0) {
      assert.ok('service' in r.data, 'Should have service');
      assert.ok('lines' in r.data, 'Should have lines');
      assert.ok(Array.isArray(r.data.lines), 'lines should be an array');
    }
  });
});

// ── Edge Cases ─────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('status with --json flag outputs valid JSON', () => {
    const r = run('status --json');
    assert.equal(r.exitCode, 0);
    // Should be valid JSON, not tables
    const parsed = JSON.parse(r.stdout);
    assert.ok(parsed.version);
  });

  it('doctor with --json does not show spinner', () => {
    const r = run('doctor --json');
    assert.equal(r.exitCode, 0);
    const payload = parseJson(r.stdout);
    assert.equal(payload.command, 'doctor');
    assert.ok(payload.allOk === true || payload.allOk === false);
  });

  it('health with --json outputs parseable JSON', () => {
    const r = run('health --json');
    assert.equal(r.exitCode, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok(typeof parsed === 'object');
  });

  it('tunnel with --json outputs parseable JSON', () => {
    const r = run('tunnel --json');
    assert.equal(r.exitCode, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok(typeof parsed === 'object');
  });

  it('env with --json outputs parseable JSON', () => {
    const r = run('env --json');
    assert.equal(r.exitCode, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok(typeof parsed === 'object');
  });

  it('help includes all documented commands', () => {
    const r = run('--help');
    const commands = ['start', 'stop', 'restart', 'status', 'dev', 'build',
      'preview', 'test', 'lint', 'format', 'logs', 'health', 'tunnel',
      'env', 'mcp', 'deploy', 'update', 'doctor', 'monitor'];
    for (const cmd of commands) {
      assert.ok(r.stdout.includes(cmd), `Help should list '${cmd}'`);
    }
  });

  it('unknown top-level command shows error', () => {
    const r = run('nonexistent-command');
    assert.notEqual(r.exitCode, 0, 'Unknown command should fail');
  });

  it('tunnel status with --json outputs parseable JSON', () => {
    const r = run('tunnel status --json');
    assert.equal(r.exitCode, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok('running' in parsed);
  });
});

// ── Multi-Environment Support ────────────────────────────────────────────

describe('multi-environment support', () => {
  it('config.js exports getEnvironment and isDev', async () => {
    const m = await import('../src/lib/config.js');
    assert.ok(m.getEnvironment, 'getEnvironment exported');
    assert.ok(m.isDev, 'isDev exported');
  });

  it('getEnvironment returns a string', async () => {
    const { getEnvironment } = await import('../src/lib/config.js');
    const env = getEnvironment();
    assert.ok(typeof env === 'string', 'Should return a string');
  });

  it('isDev returns a boolean', async () => {
    const { isDev } = await import('../src/lib/config.js');
    const result = isDev();
    assert.ok(typeof result === 'boolean', 'Should return a boolean');
  });

  it('status JSON includes environment field', () => {
    const r = runJson('status');
    assert.equal(r.exitCode, 0);
    assert.ok('environment' in r.data, 'Should have environment field');
    assert.ok(typeof r.data.environment === 'string', 'environment should be a string');
  });

  it('status output shows environment in header', () => {
    const r = run('status');
    assert.ok(/hermes dashboard/i.test(r.stdout));
    assert.ok(/development|production/.test(r.stdout.toLowerCase()), 'Should show the active environment');
  });
});

describe('hdb env subcommands', () => {
  it('env show (default) works', () => {
    const r = run('env');
    assert.ok(r.stdout.includes('Variables'));
  });

  it('env show explicit works', () => {
    const r = run('env show');
    assert.ok(r.stdout.includes('Variables'));
  });

  it('env show --json includes environment', () => {
    const r = runJson('env show');
    assert.equal(r.exitCode, 0);
    assert.ok('environment' in r.data, 'Should have environment field');
    assert.ok('vars' in r.data, 'Should have vars field');
  });

  it('env validate works', () => {
    const r = run('env validate');
    assert.ok(r.stdout.includes('Environment Validation') || r.stdout.includes('required'));
  });

  it('env validate --json outputs valid data', () => {
    const r = runJson('env validate');
    assert.equal(r.exitCode, 0);
    assert.ok('valid' in r.data, 'Should have valid field');
    assert.ok('environment' in r.data, 'Should have environment field');
  });

  it('env list shows variable names only', () => {
    const r = run('env list');
    assert.ok(r.stdout.includes('Environment Variables'));
  });

  it('env list --json outputs names array', () => {
    const r = runJson('env list');
    assert.equal(r.exitCode, 0);
    assert.ok('names' in r.data, 'Should have names field');
    assert.ok(Array.isArray(r.data.names), 'names should be an array');
    assert.ok('environment' in r.data, 'Should have environment field');
  });

  it('env unknown action exits with code 2', () => {
    const r = run('env bogus');
    assert.equal(r.exitCode, 2, 'Should exit 2 for unknown action');
    const output = `${r.stdout}${r.stderr}`;
    assert.ok(output.includes('Unknown action'));
    assert.ok(output.includes('Reason:'));
    assert.ok(output.includes('Action:'));
  });
});

// ── MCP Server Awareness ────────────────────────────────────────────────

describe('MCP server awareness', () => {
  it('health.js exports checkMcpStatus', async () => {
    const m = await import('../src/lib/health.js');
    assert.ok(m.checkMcpStatus, 'checkMcpStatus exported');
  });

  it('checkMcpStatus returns object with ok field', async () => {
    const { checkMcpStatus } = await import('../src/lib/health.js');
    const result = await checkMcpStatus();
    assert.ok('ok' in result, 'Should have ok field');
  });

  it('hdb mcp shows status', () => {
    const r = run('mcp');
    assert.ok(r.stdout.includes('MCP Server Status'));
  });

  it('hdb mcp status works', () => {
    const r = run('mcp status');
    assert.ok(r.stdout.includes('MCP Server Status'));
  });

  it('hdb mcp list shows routes', () => {
    const r = run('mcp list');
    assert.ok(r.stdout.includes('MCP Routes'));
  });

  it('hdb mcp --json outputs valid data', () => {
    const r = runJson('mcp');
    assert.equal(r.exitCode, 0);
    assert.ok('running' in r.data, 'Should have running field');
  });

  it('hdb mcp unknown action exits with code 2', () => {
    const r = run('mcp bogus');
    assert.equal(r.exitCode, 2, 'Should exit 2 for unknown action');
  });

  it('health command shows MCP check', () => {
    const r = run('health');
    assert.ok(r.stdout.includes('MCP'), 'Should mention MCP in health output');
  });

  it('health JSON includes mcp field', () => {
    const r = runJson('health');
    assert.equal(r.exitCode, 0);
    assert.ok('mcp' in r.data, 'Should have mcp field');
    assert.ok('ok' in r.data.mcp, 'mcp should have ok field');
  });
});
