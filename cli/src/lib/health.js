async function httpCheck(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    if (!text) return { ok: false, data: null };
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: true, data: text.slice(0, 200) };
    }
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(timer);
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

export async function checkTunnelReachable(url) {
  if (!url) return false;
  const res = await httpCheck(url, 5000);
  return res.ok;
}

export async function checkMcpStatus() {
  return httpCheck('http://localhost:5174/api/mcp/status');
}

export async function deepHealthCheck() {
  const results = {};
  const checks = [
    ['api_health', checkApiHealth],
    ['api_ready', checkApiReady],
    ['frontend', checkFrontend],
    ['vite_proxy', checkViteProxy],
    ['gateway', checkGateway],
    ['mcp', checkMcpStatus],
  ];

  const entries = await Promise.all(
    checks.map(async ([name, fn]) => [name, await fn()])
  );
  for (const [name, result] of entries) {
    results[name] = result;
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
