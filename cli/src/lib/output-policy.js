const FORCE_COLOR_VALUES = new Set(['1', '2', '3', 'true', 'yes', 'on']);
const NO_COLOR_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);
const TTY_ENV_INCOMPATIBLE = new Set(['', 'dumb']);
const VALID_SKINS = new Set(['minimal', 'standard', 'vivid', 'experimental']);
const DEFAULT_SKIN = 'standard';

function parseBooleanEnv(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  if (NO_COLOR_VALUES.has(normalized)) return true;
  return DISABLED_VALUES.has(normalized) ? false : normalized.length > 0;
}

function parseForceColor(value) {
  if (value === undefined || value === null) return false;
  return FORCE_COLOR_VALUES.has(String(value).trim().toLowerCase());
}

function parseSkin(value) {
  const candidate = String(value || DEFAULT_SKIN).trim().toLowerCase();
  return VALID_SKINS.has(candidate) ? candidate : DEFAULT_SKIN;
}

function isHeadlessTerminal() {
  const term = process.env.TERM || '';
  return TTY_ENV_INCOMPATIBLE.has(term.toLowerCase()) || process.env.CI === 'true';
}

function isTty() {
  return Boolean(process.stdout && process.stderr && process.stdout.isTTY && process.stderr.isTTY);
}

export function buildOutputPolicy(opts = {}) {
  const tty = isTty();
  const noColor = parseBooleanEnv(process.env.NO_COLOR);
  const forceColor = parseForceColor(process.env.FORCE_COLOR);
  const isJson = Boolean(opts.json);
  const isPlain = Boolean(opts.plain);
  const skin = parseSkin(opts.skin);
  const colorEnabled = !isJson && !isPlain && (forceColor || (tty && !noColor));
  const spinnerEnabled = !isJson && !isPlain && tty && !isHeadlessTerminal();

  return {
    json: isJson,
    plain: isPlain,
    tty,
    colorEnabled,
    noColor,
    forceColor,
    spinner: spinnerEnabled,
    machineMode: isJson || isPlain,
    skin,
  };
}

const FRAME_STYLES = {
  minimal: {
    header: {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
      sectionLeft: '┝',
      sectionRight: '┤',
      mascot: ' HDB:SIGIL ',
      sectionFill: '─',
      labelPadding: 1,
      headerWidth: 58,
    },
  },
  standard: {
    header: {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│',
      sectionLeft: '├',
      sectionRight: '┤',
      mascot: ' ◈ HDB SIGIL ◈ ',
      sectionFill: '─',
      labelPadding: 1,
      headerWidth: 58,
    },
  },
  vivid: {
    header: {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '═',
      vertical: '║',
      sectionLeft: '╠',
      sectionRight: '╣',
      mascot: ' ⟡ LIVING SIGIL ⟡ ',
      sectionFill: '═',
      labelPadding: 1,
      headerWidth: 58,
    },
  },
  experimental: {
    header: {
      topLeft: '▛',
      topRight: '▜',
      bottomLeft: '▙',
      bottomRight: '▟',
      horizontal: '▀',
      vertical: '▌',
      sectionLeft: '╺',
      sectionRight: '╸',
      mascot: ' // relay:warden // ',
      sectionFill: '━',
      labelPadding: 1,
      headerWidth: 62,
    },
  },
};

export function getFrameStyle(policy = buildOutputPolicy()) {
  return FRAME_STYLES[policy.skin] || FRAME_STYLES[DEFAULT_SKIN];
}

const COLOR_PROFILES = {
  minimal: {
    info: 'blue',
    success: 'green',
    warn: 'yellow',
    error: 'red',
    dim: 'dim',
    header: 'white',
    accent: 'dim',
  },
  standard: {
    info: 'blue',
    success: 'green',
    warn: 'yellow',
    error: 'red',
    dim: 'dim',
    header: 'cyan',
    accent: 'blueBright',
  },
  vivid: {
    info: 'cyanBright',
    success: 'greenBright',
    warn: 'yellowBright',
    error: 'magentaBright',
    dim: 'blue',
    header: 'magentaBright',
    accent: 'cyanBright',
  },
  experimental: {
    info: 'cyanBright',
    success: 'greenBright',
    warn: 'yellowBright',
    error: 'red',
    dim: 'dim',
    header: 'blueBright',
    accent: 'magentaBright',
  },
};

export function getColorProfile(policy = buildOutputPolicy()) {
  return COLOR_PROFILES[policy.skin] || COLOR_PROFILES[DEFAULT_SKIN];
}

const UI = {
  human: {
    minimal: {
      info: '[i]',
      success: '[+]',
      warn: '[!]',
      error: '[-]',
      dim: '-',
      running: 'RUNNING',
      stopped: 'STOPPED',
      unknown: 'UNKNOWN',
    },
    standard: {
      info: '🜁',
      success: '✓',
      warn: '⚠',
      error: '✗',
      dim: '·',
      running: '● RUNNING',
      stopped: '◌ STOPPED',
      unknown: '◍ UNKNOWN',
    },
    vivid: {
      info: '◉',
      success: '✅',
      warn: '⚠',
      error: '⨯',
      dim: '•',
      running: 'RUNNING',
      stopped: 'STOPPED',
      unknown: 'UNKNOWN',
    },
    experimental: {
      info: '»',
      success: '++',
      warn: '!!',
      error: 'xx',
      dim: '//',
      running: 'SYNCED',
      stopped: 'BROKEN',
      unknown: 'DRIFT',
    },
  },
  plain: {
    info: '[INFO]',
    success: '[OK]',
    warn: '[WARN]',
    error: '[ERR]',
    dim: '-',
    running: 'RUNNING',
    stopped: 'STOPPED',
    unknown: 'UNKNOWN',
  },
};

export function getUiTokens(policy = buildOutputPolicy()) {
  if (policy.plain || policy.json || !policy.colorEnabled) return UI.plain;
  return UI.human[policy.skin] || UI.human[DEFAULT_SKIN];
}

export function statusToken(policy, isOk) {
  const tokens = getUiTokens(policy);
  if (isOk === true) return tokens.running;
  if (isOk === false) return tokens.stopped;
  return tokens.unknown;
}
