import ora from 'ora';
import chalk from 'chalk';
import { buildOutputPolicy, getUiTokens, getFrameStyle, getColorProfile } from './output-policy.js';
import { statusToken } from './output-policy.js';

let activePolicy = buildOutputPolicy();

function normalizePolicy(opts) {
  if (!opts) return activePolicy;
  const { skin: _skin, ...policy } = opts;
  return buildOutputPolicy({ ...activePolicy, ...policy });
}

function formatLine(level, message, policy) {
  const tokens = getUiTokens(policy);
  const token = tokens[level] || '';
  return `${token}${message ? ` ${message}` : ''}`;
}

function paint(level, text, policy) {
  if (!policy.colorEnabled || level === 'raw') return text;
  const profile = getColorProfile(policy);
  const map = {
    blue: chalk.blue,
    blueBright: chalk.blueBright,
    cyan: chalk.cyan,
    cyanBright: chalk.cyanBright,
    dim: chalk.dim,
    green: chalk.green,
    greenBright: chalk.greenBright,
    magentaBright: chalk.magentaBright,
    red: chalk.red,
    white: chalk.white,
    yellow: chalk.yellow,
    yellowBright: chalk.yellowBright,
  };
  const fn = map[profile[level]] || ((v) => v);
  return fn(text);
}

function repeat(str, length) {
  return str.repeat(Math.max(0, length));
}

function frameLine(label, policy, opts = {}) {
  const frame = getFrameStyle(policy).header;
  const width = Math.max(44, Number(opts.width) || frame.headerWidth || 52);
  const content = ` ${label} `;
  const available = Math.max(4, width - 2);
  const leftPad = Math.max(0, Math.floor((available - content.length) / 2));
  const rightPad = Math.max(0, available - content.length - leftPad);
  const top = `${frame.topLeft}${repeat(frame.horizontal, available)}${frame.topRight}`;
  const mid = `${frame.vertical}${repeat(' ', leftPad)}${content}${repeat(' ', rightPad)}${frame.vertical}`;
  return [top, mid, `${frame.bottomLeft}${repeat(frame.horizontal, available)}${frame.bottomRight}`];
}

function writeLine(level, message, opts) {
  const policy = normalizePolicy(opts);
  const line = formatLine(level, message, policy);
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (!policy.colorEnabled) {
    stream.write(`${line}\n`);
    return;
  }
  stream.write(`${paint(level, line, policy)}\n`);
}

export function setOutputPolicy(opts = {}) {
  activePolicy = buildOutputPolicy(opts);
  return activePolicy;
}

export function getOutputPolicy() {
  return activePolicy;
}

export const log = {
  info: (msg, opts) => writeLine('info', msg, opts),
  success: (msg, opts) => writeLine('success', msg, opts),
  warn: (msg, opts) => writeLine('warn', msg, opts),
  error: (msg, opts) => writeLine('error', msg, opts),
  dim: (msg, opts) => writeLine('dim', msg, opts),
  raw: (msg, opts) => writeLine('raw', msg, opts),
};

export function spinner(text, opts) {
  const policy = normalizePolicy(opts);
  if (!policy.spinner) return null;
  return ora({ text, color: policy.colorEnabled ? 'cyan' : undefined });
}

export function json(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function header(title) {
  const policy = activePolicy;
  if (policy.machineMode) return;
  const frame = getFrameStyle(policy).header;
  const [top, mid, bottom] = frameLine(`${title}`, policy, { width: frame.headerWidth });
  const mascotLine = frameLine((frame.mascot || 'HDB').trim(), policy, { width: frame.headerWidth })[1];
  log.raw(paint('header', top, policy), policy);
  log.raw(paint('accent', mascotLine, policy), policy);
  log.raw(paint('header', mid, policy), policy);
  log.raw(paint('header', bottom, policy), policy);
}

export function section(title, opts = {}) {
  const policy = normalizePolicy(opts);
  if (policy.machineMode) return;
  const frame = getFrameStyle(policy).header;
  const titleLine = ` ${title} `;
  const width = Math.max(32, titleLine.length + 4);
  const pad = Math.max(0, width - titleLine.length - 2);
  const leftPad = Math.floor(pad / 2);
  const rightPad = pad - leftPad;
  const fill = frame.sectionFill || '─';
  const line = `${frame.sectionLeft}${repeat(fill, leftPad)}${titleLine}${repeat(fill, rightPad)}${frame.sectionRight}`;
  writeLine('header', `\n  ${title}`, policy);
  log.raw(paint('accent', line, policy), policy);
}

export function statusLine(label, state, detail = '', opts = {}) {
  const policy = normalizePolicy(opts);
  const status = typeof state === 'boolean' ? statusToken(policy, state) : String(state ?? '');
  const detailText = detail ? ` (${detail})` : '';
  const message = `${label}: ${status}${detailText}`;
  if (state === true) {
    writeLine('success', message, policy);
    return;
  }
  if (state === false) {
    writeLine('warn', message, policy);
    return;
  }
  writeLine('info', message, policy);
}

export function outputResult(payload, opts, humanTextFormatter) {
  const policy = normalizePolicy(opts);
  if (policy.json) {
    json(payload);
    return payload;
  }
  if (typeof humanTextFormatter === 'function') {
    humanTextFormatter();
  }
  return payload;
}
