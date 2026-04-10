import Table from 'cli-table3';
import chalk from 'chalk';
import { log, header, json } from '../lib/logger.js';
import { isActive, getPid } from '../lib/services.js';
import { isPortOpen, KNOWN_PORTS } from '../lib/ports.js';
import { getTunnelUrl, isTunnelRunning } from '../lib/tunnel.js';
import { checkApiHealth, checkViteProxy, checkTunnelReachable } from '../lib/health.js';
import { getVersion, getEnvironment } from '../lib/config.js';

function fmt(status) {
  return status ? chalk.green('● RUNNING') : chalk.red('○ STOPPED');
}

function portFmt(port) {
  return isPortOpen(port) ? chalk.green('OPEN') : chalk.red('CLOSED');
}

export default async function status(opts) {
  const version = getVersion();
  const environment = getEnvironment();

  const apiUp = isActive('api');
  const webUp = isActive('web');
  const proxyUp = isActive('proxy');
  const gatewayUp = isActive('gateway');
  const tunnelUp = isTunnelRunning();
  const tunnelUrl = getTunnelUrl();
  const apiHealth = await checkApiHealth();
  const proxyOk = await checkViteProxy();
  const tunnelReachable = tunnelUrl ? await checkTunnelReachable(tunnelUrl) : false;

  if (opts.json) {
    json({
      version,
      environment,
      services: {
        api: { running: apiUp, pid: getPid('api'), port: 5174, healthy: apiHealth.ok },
        web: { running: webUp, pid: getPid('web'), port: 5175 },
        proxy: { running: proxyUp, pid: getPid('proxy'), port: 5176 },
        gateway: { running: gatewayUp, pid: getPid('gateway'), port: 8642 },
        tunnel: { running: tunnelUp, url: tunnelUrl },
      },
      ports: { 5174: isPortOpen(5174), 5175: isPortOpen(5175), 5176: isPortOpen(5176), 8642: isPortOpen(8642) },
      proxy: proxyOk.ok,
    });
    return;
  }

  header(`Hermes Dashboard v${version || '?'} [${environment}]`);

  const svcTable = new Table({
    head: ['Service', 'Status', 'PID', 'Port'].map((h) => chalk.cyan(h)),
    style: { head: [], border: [] },
  });
  svcTable.push(
    ['API', fmt(apiUp), getPid('api') || '—', '5174'],
    ['CORS Proxy', fmt(proxyUp), getPid('proxy') || '—', '5176'],
    ['Vite Dev', fmt(webUp), getPid('web') || '—', '5175'],
    ['Gateway', fmt(gatewayUp), getPid('gateway') || '—', '8642'],
    ['Tunnel', fmt(tunnelUp), '—', '—']
  );
  console.log(svcTable.toString());

  const portTable = new Table({
    head: ['Port', 'Service', 'Status'].map((h) => chalk.cyan(h)),
    style: { head: [], border: [] },
  });
  for (const [key, info] of Object.entries(KNOWN_PORTS)) {
    portTable.push([info.port, info.desc, portFmt(info.port)]);
  }
  console.log(portTable.toString());

  console.log();
  if (apiHealth.ok) {
    log.success(`API health: ${JSON.stringify(apiHealth.data)}`);
  } else {
    log.error('API health: NOT RESPONDING');
  }
  if (proxyOk.ok) {
    log.success('Vite proxy: WORKING (/api → 5174)');
  } else {
    log.error('Vite proxy: NOT WORKING');
  }
  if (tunnelUrl) {
    const reachLabel = tunnelReachable ? chalk.green('REACHABLE') : chalk.yellow('UNREACHABLE');
    log.info(`Tunnel: ${tunnelUrl} [${reachLabel}]`);
  } else {
    log.warn('Tunnel: No URL');
  }
}
