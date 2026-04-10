import { execSync } from 'child_process';

async function httpCheck(url, timeoutMs = 5000) {
  try {
    const out = execSync(
      `curl -sf --max-time ${Math.ceil(timeoutMs / 1000)} "${url}" 2>/dev/null`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    if (!out) return { ok: false, data: null };
    try {
      return { ok: true, data: JSON.parse(out) };
    } catch {
      return { ok: true, data: out.slice(0, 200) };
    }
  } catch {
    return { ok: false, data: null };
  }
}

export async function checkApiHealth() {
  return httpCheck('http://localhost:5174/api/health');
}

export async function checkApiReady() {
  return httpCheck('http://localhost:5174/api/ready');
}

export async function checkApiStats() {
  return httpCheck('http://localhost:5174/api/stats');
}

export async function checkViteProxy() {
  return httpCheck('http://localhost:5175/api/health');
}

export async function checkFrontend() {
  return httpCheck('http://localhost:5175/');
}

export async function checkGateway() {
  return httpCheck('http://localhost:8642/health');
}

export async function checkTunnel(url) {
  if (!url) return { ok: false, data: null };
  return httpCheck(url);
}

export async function deepHealthCheck() {
  const results = {};
  const checks = [
    ['api_health', checkApiHealth],
    ['api_ready', checkApiReady],
    ['frontend', checkFrontend],
    ['vite_proxy', checkViteProxy],
    ['gateway', checkGateway],
  ];

  for (const [name, fn] of checks) {
    results[name] = await fn();
  }

  try {
    const { readFileSync } = await import('fs');
    const { homedir } = await import('os');
    const tunnelUrl = readFileSync(
      `${homedir()}/.hermes/dashboard/scripts/.pids/tunnel.url`,
      'utf-8'
    ).trim();
    results.tunnel = { url: tunnelUrl, ...(await checkTunnel(tunnelUrl)) };
  } catch {
    results.tunnel = { url: null, ok: false, data: null };
  }

  return results;
}
