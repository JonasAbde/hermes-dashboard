import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';

const HDB = '/home/empir/.hermes/dashboard/cli/bin/hdb.js';

function run(args) {
  try {
    return {
      stdout: execSync(`node ${HDB} ${args}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }),
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

function runJson(args) {
  const result = run(`${args} --json`);
  if (result.exitCode === 0) {
    result.data = JSON.parse(result.stdout);
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

  it('outputs valid JSON', () => {
    const r = runJson('status');
    assert.equal(r.exitCode, 0);
    assert.ok(r.data.version);
    assert.ok(r.data.services);
    assert.ok(r.data.ports);
  });
});

// ── Health ──────────────────────────────────────────────────────────────────

describe('hdb health', () => {
  it('runs health checks', () => {
    const r = run('health');
    assert.ok(r.stdout.includes('API Health'));
  });

  it('outputs valid JSON', () => {
    const r = runJson('health');
    assert.equal(r.exitCode, 0);
    assert.ok(r.data.api_health);
    assert.ok(r.data.frontend);
  });
});

// ── Tunnel ──────────────────────────────────────────────────────────────────

describe('hdb tunnel', () => {
  it('shows tunnel status', () => {
    const r = run('tunnel status');
    assert.ok(r.stdout.includes('Running'));
    assert.ok(r.stdout.includes('URL'));
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
