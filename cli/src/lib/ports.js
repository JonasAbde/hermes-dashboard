import { execSync } from 'child_process';

const KNOWN_PORTS = {
  api: { port: 5174, desc: 'Express API' },
  web: { port: 5175, desc: 'Vite dev' },
  gateway: { port: 8642, desc: 'Gateway API' },
};

export function isPortOpen(port) {
  try {
    execSync(`fuser ${port}/tcp`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function killPort(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function getPidOnPort(port) {
  try {
    const out = execSync(`fuser ${port}/tcp 2>/dev/null`, { encoding: 'utf-8' }).trim();
    return out || null;
  } catch {
    return null;
  }
}

export async function waitForPort(port, timeoutSec = 15) {
  for (let i = 0; i < timeoutSec * 2; i++) {
    if (isPortOpen(port)) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

export { KNOWN_PORTS };
