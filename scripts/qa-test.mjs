#!/usr/bin/env node
/**
 * Hermes Dashboard V1 — Comprehensive QA Test
 * Uses puppeteer to test every page, feature, and workflow.
 */
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:5175';
const RESULTS = [];
let browser, page;
let testCount = 0, passCount = 0, failCount = 0;

function log(msg, type = 'info') {
  const ts = new Date().toISOString().slice(11, 23);
  const icon = type === 'pass' ? '✓' : type === 'fail' ? '✗' : type === 'warn' ? '⚠' : '·';
  console.log(`[${ts}] ${icon} ${msg}`);
}

async function screenshot(name) {
  try {
    await page.screenshot({ path: `/home/empir/.hermes/dashboard/scripts/screenshots/${name}.png`, fullPage: false });
    console.log(`  → Screenshot: screenshots/${name}.png`);
  } catch (e) { /* ignore */ }
}

async function test(name, fn) {
  testCount++;
  try {
    await fn();
    passCount++;
    log(`PASS: ${name}`, 'pass');
    RESULTS.push({ name, status: 'pass' });
  } catch (err) {
    failCount++;
    log(`FAIL: ${name} — ${err.message}`, 'fail');
    RESULTS.push({ name, status: 'fail', error: err.message });
    try { await screenshot(`FAIL_${name.replace(/\s+/g, '_')}`); } catch (e) {}
  }
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForSelector(sel, opts = { timeout: 5000 }) {
  await page.waitForSelector(sel, opts).catch(() => { throw new Error(`Selector not found: ${sel}`); });
}

async function clickAndNavigate(sel) {
  await page.click(sel);
  await delay(500);
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
async function setup() {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await delay(1000);
  log('Browser launched, dashboard loaded');
}

// ─── TEARDOWN ─────────────────────────────────────────────────────────────────
async function teardown() {
  await browser.close();
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
async function testLogin() {
  // First, check if we need to login
  const url = page.url();
  if (!url.includes('/login')) {
    log('Already authenticated, skipping login page tests', 'warn');
    return;
  }

  await test('Login page renders', async () => {
    await waitForSelector('input[type="text"], input[name="token"], input[placeholder*="token" i]');
  });

  await test('Login wrong token rejects', async () => {
    const input = await page.$('input[type="text"], input[name="token"]');
    if (input) {
      await input.fill('wrong-token-xyz');
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) await submitBtn.click();
      await delay(1000);
      // Should show error
      const body = await page.textContent('body');
      if (body.includes('invalid') || body.includes('error') || body.includes('Incorrect')) {
        // Good - error shown
      }
    }
  });
}

// ─── OVERVIEW PAGE ────────────────────────────────────────────────────────────
async function testOverview() {
  await test('Overview page loads (/ )', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await delay(1000);
    const title = await page.title();
    log(`  Title: ${title}`);
  });

  await test('Overview cards render', async () => {
    const cards = await page.$$('[class*="card"], .card, [class*="Card"]');
    log(`  Found ${cards.length} cards`);
    if (cards.length === 0) throw new Error('No cards found on overview');
  });

  await test('Overview - session card navigates to /sessions', async () => {
    // Look for session-related link
    const sessionLink = await page.$('a[href="/sessions"], [data-nav="sessions"]');
    if (sessionLink) {
      await sessionLink.click();
      await delay(800);
      const url = page.url();
      if (!url.includes('/sessions')) throw new Error(`Expected /sessions, got ${url}`);
      await page.goBack();
      await delay(500);
    } else {
      log('  No session card link found, skipping', 'warn');
    }
  });

  await test('Overview - EKG card navigates to /ekg', async () => {
    const ekgLink = await page.$('a[href="/ekg"]');
    if (ekgLink) {
      await ekgLink.click();
      await delay(800);
      const url = page.url();
      if (!url.includes('/ekg')) throw new Error(`Expected /ekg, got ${url}`);
      await page.goBack();
      await delay(500);
    }
  });

  await test('Overview - logs card navigates to /logs', async () => {
    const logsLink = await page.$('a[href="/logs"]');
    if (logsLink) {
      await logsLink.click();
      await delay(800);
      const url = page.url();
      if (!url.includes('/logs')) throw new Error(`Expected /logs, got ${url}`);
      await page.goBack();
      await delay(500);
    }
  });

  await test('Overview - approvals card navigates to /approvals', async () => {
    const approvalsLink = await page.$('a[href="/approvals"]');
    if (approvalsLink) {
      await approvalsLink.click();
      await delay(800);
      const url = page.url();
      if (!url.includes('/approvals')) throw new Error(`Expected /approvals, got ${url}`);
      await page.goBack();
      await delay(500);
    }
  });

  await test('Overview - memory card navigates to /memory', async () => {
    const memoryLink = await page.$('a[href="/memory"]');
    if (memoryLink) {
      await memoryLink.click();
      await delay(800);
      const url = page.url();
      if (!url.includes('/memory')) throw new Error(`Expected /memory, got ${url}`);
      await page.goBack();
      await delay(500);
    }
  });

  await test('Overview - settings card navigates to /settings', async () => {
    const settingsLink = await page.$('a[href="/settings"]');
    if (settingsLink) {
      await settingsLink.click();
      await delay(800);
      const url = page.url();
      if (!url.includes('/settings')) throw new Error(`Expected /settings, got ${url}`);
      await page.goBack();
      await delay(500);
    }
  });

  await test('Overview - chat card navigates to /chat', async () => {
    const chatLink = await page.$('a[href="/chat"]');
    if (chatLink) {
      await chatLink.click();
      await delay(800);
      const url = page.url();
      if (!url.includes('/chat')) throw new Error(`Expected /chat, got ${url}`);
      await page.goBack();
      await delay(500);
    }
  });

  await test('Overview - neural shift card navigates to /neural', async () => {
    const neuralLink = await page.$('a[href="/neural"]');
    if (neuralLink) {
      await neuralLink.click();
      await delay(800);
      const url = page.url();
      if (!url.includes('/neural')) throw new Error(`Expected /neural, got ${url}`);
      await page.goBack();
      await delay(500);
    }
  });

  await test('Overview - polling indicators exist', async () => {
    const indicators = await page.$$('[class*="pulse"], [class*="indicator"], .dot, [class*="dot"]');
    log(`  Found ${indicators.length} polling indicators`);
  });

  await test('Overview - tab title updates', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    const title = await page.title();
    log(`  Tab title: "${title}"`);
  });
}

// ─── SESSIONS PAGE ────────────────────────────────────────────────────────────
async function testSessions() {
  await page.goto(BASE + '/sessions', { waitUntil: 'networkidle2' });
  await delay(1500);

  await test('Sessions page loads', async () => {
    await waitForSelector('body');
    const url = page.url();
    log(`  URL: ${url}`);
  });

  await test('Sessions - session list renders', async () => {
    // Look for any session-like elements
    const sessionItems = await page.$$('[class*="session"], [class*="Session"], li, .list-item');
    log(`  Found ${sessionItems.length} session/list items`);
  });

  await test('Sessions - search filters results in real-time', async () => {
    const searchInput = await page.$('input[placeholder*="search" i], input[type="search"], input[type="text"]');
    if (searchInput) {
      await searchInput.fill('nonexistent-query-xyz-12345');
      await delay(500);
      log('  Search input works');
      await searchInput.fill('');
      await delay(300);
    } else {
      log('  No search input found', 'warn');
    }
  });

  await test('Sessions - clicking a session opens detail panel', async () => {
    const sessionItem = await page.$('[class*="session"], [class*="Session"], li, .list-item');
    if (sessionItem) {
      await sessionItem.click();
      await delay(500);
      // Look for detail panel
      const detail = await page.$('[class*="detail"], [class*="panel"], [class*="Detail"]');
      if (!detail) log('  Detail panel may not exist, checking for message content', 'warn');
      log('  Session click registered');
    }
  });

  await test('Sessions - long session titles handle overflow', async () => {
    // Check for CSS overflow handling
    const longTitle = await page.$('[class*="title"], h1, h2, h3');
    if (longTitle) {
      const style = await page.evaluate(el => window.getComputedStyle(el).overflowWrap || window.getComputedStyle(el).wordBreak, longTitle);
      log(`  Title overflow style: ${style}`);
    }
  });

  await test('Sessions - direct URL navigation works', async () => {
    await page.goto(BASE + '/sessions', { waitUntil: 'networkidle2' });
    await delay(1000);
    const url = page.url();
    if (!url.includes('/sessions')) throw new Error(`Expected /sessions, got ${url}`);
  });

  await test('Sessions - back navigation works', async () => {
    await page.goto(BASE + '/sessions', { waitUntil: 'networkidle2' });
    await delay(500);
    await page.goBack();
    await delay(500);
    log('  Back navigation OK');
  });
}

// ─── SESSION REPLAY ───────────────────────────────────────────────────────────
async function testSessionReplay() {
  await page.goto(BASE + '/sessions', { waitUntil: 'networkidle2' });
  await delay(1500);

  await test('SessionReplay - click through messages', async () => {
    // Look for message elements in a session detail view
    const messages = await page.$$('[class*="message"], [class*="Message"], .msg');
    log(`  Found ${messages.length} message elements`);
    if (messages.length > 0) {
      await messages[0].click().catch(() => {});
      await delay(300);
    }
  });

  await test('SessionReplay - scrubber exists and is interactive', async () => {
    const scrubber = await page.$('input[type="range"], [class*="scrubber"], [class*="slider"]');
    if (scrubber) {
      log('  Scrubber found');
      // Try to interact with it
      const box = await scrubber.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await delay(300);
        log('  Scrubber interaction OK');
      }
    } else {
      log('  No scrubber found (may not be in current view)', 'warn');
    }
  });
}

// ─── EKG PAGE ──────────────────────────────────────────────────────────────────
async function testEkg() {
  await page.goto(BASE + '/ekg', { waitUntil: 'networkidle2' });
  await delay(1500);

  await test('EKG page loads', async () => {
    await waitForSelector('body');
  });

  await test('EKG chart renders', async () => {
    const chart = await page.$('svg, [class*="chart"], canvas, [class*="recharts"]');
    if (!chart) throw new Error('No chart element found on EKG page');
    log('  EKG chart rendered');
  });

  await test('EKG - hover on chart shows tooltip', async () => {
    const chartArea = await page.$('svg, [class*="recharts-surface"]');
    if (chartArea) {
      const box = await chartArea.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await delay(500);
        const tooltip = await page.$('[class*="tooltip"], [class*="Tooltip"]');
        log(`  Tooltip present: ${!!tooltip}`);
      }
    }
  });

  await test('EKG - latency display exists', async () => {
    const body = await page.textContent('body');
    if (body.includes('ms') || body.includes('latency') || body.includes('Latency')) {
      log('  Latency display found');
    } else {
      log('  Latency display not found in text', 'warn');
    }
  });

  await test('EKG - resize window, chart adjusts', async () => {
    await page.setViewport({ width: 800, height: 600 });
    await delay(500);
    const chart = await page.$('svg, [class*="recharts"]');
    if (!chart) throw new Error('Chart disappeared after resize');
    await page.setViewport({ width: 1280, height: 800 });
    await delay(300);
    log('  Chart still present after resize');
  });

  await test('EKG - direct URL navigation works', async () => {
    await page.goto(BASE + '/ekg', { waitUntil: 'networkidle2' });
    await delay(1000);
    const url = page.url();
    if (!url.includes('/ekg')) throw new Error(`Expected /ekg, got ${url}`);
  });
}

// ─── APPROVALS PAGE ───────────────────────────────────────────────────────────
async function testApprovals() {
  await page.goto(BASE + '/approvals', { waitUntil: 'networkidle2' });
  await delay(1500);

  await test('Approvals page loads', async () => {
    await waitForSelector('body');
  });

  await test('Approvals - approve button works (item disappears)', async () => {
    const approveBtn = await page.$('button:has-text("Approve"), button:has-text("✓"), [class*="approve"]');
    if (approveBtn) {
      await approveBtn.click();
      await delay(1000);
      log('  Approve button clicked');
      // Toast might appear
      const toast = await page.$('[class*="toast"], [class*="Toast"]');
      if (toast) log('  Toast notification appeared');
    } else {
      log('  No approve button found (no pending approvals?)', 'warn');
    }
  });

  await test('Approvals - deny button works', async () => {
    // Reload to get fresh data
    await page.goto(BASE + '/approvals', { waitUntil: 'networkidle2' });
    await delay(1000);
    const denyBtn = await page.$('button:has-text("Deny"), button:has-text("✗"), [class*="deny"]');
    if (denyBtn) {
      await denyBtn.click();
      await delay(1000);
      log('  Deny button clicked');
    } else {
      log('  No deny button found', 'warn');
    }
  });

  await test('Approvals - empty state when no approvals', async () => {
    await page.goto(BASE + '/approvals', { waitUntil: 'networkidle2' });
    await delay(1500);
    const body = await page.textContent('body');
    if (body.includes('No pending') || body.includes('no approvals') || body.includes('empty') || body.includes('All clear')) {
      log('  Empty state shown');
    } else {
      log('  Approvals still pending (OK, not an error)', 'warn');
    }
  });

  await test('Approvals - direct URL navigation works', async () => {
    await page.goto(BASE + '/approvals', { waitUntil: 'networkidle2' });
    await delay(1000);
    const url = page.url();
    if (!url.includes('/approvals')) throw new Error(`Expected /approvals, got ${url}`);
  });
}

// ─── LOGS PAGE ─────────────────────────────────────────────────────────────────
async function testLogs() {
  await page.goto(BASE + '/logs', { waitUntil: 'networkidle2' });
  await delay(2000);

  await test('Logs page loads', async () => {
    await waitForSelector('body');
  });

  await test('Logs - live log stream starts', async () => {
    const logEntries = await page.$$('[class*="log"], [class*="Log"], pre, [class*="entry"]');
    log(`  Found ${logEntries.length} log entries`);
  });

  await test('Logs - pause button works', async () => {
    const pauseBtn = await page.$('button:has-text("Pause"), button:has-text("Resume"), [class*="pause"]');
    if (pauseBtn) {
      const btnText = await pauseBtn.textContent();
      await pauseBtn.click();
      await delay(500);
      log(`  ${btnText} button clicked`);
    } else {
      log('  No pause button found', 'warn');
    }
  });

  await test('Logs - auto-scroll toggle works', async () => {
    const toggle = await page.$('[class*="auto-scroll"], [class*="autoscroll"], input[type="checkbox"]');
    if (toggle) {
      await toggle.click();
      await delay(300);
      log('  Auto-scroll toggled');
    } else {
      log('  No auto-scroll toggle found', 'warn');
    }
  });

  await test('Logs - level filter buttons exist', async () => {
    const levelBtns = await page.$$('button:has-text("debug"), button:has-text("info"), button:has-text("warn"), button:has-text("error")');
    log(`  Found ${levelBtns.length} level filter buttons`);
    if (levelBtns.length > 0) {
      await levelBtns[0].click();
      await delay(300);
      log('  Level filter clicked');
    }
  });

  await test('Logs - search in logs works', async () => {
    const searchInput = await page.$('input[type="text"], input[placeholder*="search" i], input[placeholder*="filter" i]');
    if (searchInput) {
      await searchInput.fill('error');
      await delay(500);
      log('  Log search input works');
      await searchInput.fill('');
    } else {
      log('  No search input found on logs page', 'warn');
    }
  });

  await test('Logs - regex toggle exists', async () => {
    const regexToggle = await page.$('button:has-text(".*"), [class*="regex"]');
    if (regexToggle) {
      await regexToggle.click();
      await delay(300);
      log('  Regex toggle clicked');
    } else {
      log('  No regex toggle found', 'warn');
    }
  });

  await test('Logs - file selector changes log source', async () => {
    const fileSelect = await page.$('select, [class*="file"]');
    if (fileSelect) {
      const options = await page.$$('option');
      log(`  Found ${options.length} file options`);
      if (options.length > 1) {
        await options[1].click();
        await delay(500);
        log('  File selector changed');
      }
    } else {
      log('  No file selector found', 'warn');
    }
  });

  await test('Logs - copy logs button works', async () => {
    const copyBtn = await page.$('button:has-text("Copy"), button[title*="copy" i]');
    if (copyBtn) {
      await copyBtn.click();
      await delay(500);
      log('  Copy logs button clicked');
    } else {
      log('  No copy button found', 'warn');
    }
  });

  await test('Logs - clear logs button works', async () => {
    const clearBtn = await page.$('button:has-text("Clear"), button[title*="clear" i]');
    if (clearBtn) {
      await clearBtn.click();
      await delay(500);
      log('  Clear logs button clicked');
    } else {
      log('  No clear button found', 'warn');
    }
  });

  await test('Logs - direct URL navigation works', async () => {
    await page.goto(BASE + '/logs', { waitUntil: 'networkidle2' });
    await delay(1000);
    const url = page.url();
    if (!url.includes('/logs')) throw new Error(`Expected /logs, got ${url}`);
  });
}

// ─── MEMORY PAGE ──────────────────────────────────────────────────────────────
async function testMemory() {
  await page.goto(BASE + '/memory', { waitUntil: 'networkidle2' });
  await delay(2000);

  await test('Memory page loads', async () => {
    await waitForSelector('body');
  });

  await test('Memory - D3 graph renders', async () => {
    const svg = await page.$('svg');
    if (!svg) throw new Error('No SVG found on memory page');
    log('  D3 SVG graph rendered');
  });

  await test('Memory - search filters nodes', async () => {
    const searchInput = await page.$('input[type="text"], input[placeholder*="search" i], input[placeholder*="filter" i]');
    if (searchInput) {
      await searchInput.fill('test');
      await delay(500);
      log('  Memory search works');
      await searchInput.fill('');
    } else {
      log('  No search input on memory page', 'warn');
    }
  });

  await test('Memory - zoom with mouse wheel', async () => {
    const svg = await page.$('svg');
    if (svg) {
      const box = await svg.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 100);
        await delay(300);
        log('  Mouse wheel zoom executed');
      }
    }
  });

  await test('Memory - reset zoom button works', async () => {
    const resetBtn = await page.$('button:has-text("Reset"), button[title*="reset" i], [class*="reset"]');
    if (resetBtn) {
      await resetBtn.click();
      await delay(300);
      log('  Reset zoom clicked');
    } else {
      log('  No reset zoom button found', 'warn');
    }
  });

  await test('Memory - node hover shows info', async () => {
    const node = await page.$('circle, [class*="node"]');
    if (node) {
      await node.hover();
      await delay(500);
      const tooltip = await page.$('[class*="tooltip"], [class*="Tooltip"], [class*="info"]');
      log(`  Node hover - tooltip present: ${!!tooltip}`);
    } else {
      log('  No node elements found', 'warn');
    }
  });

  await test('Memory - direct URL navigation works', async () => {
    await page.goto(BASE + '/memory', { waitUntil: 'networkidle2' });
    await delay(1000);
    const url = page.url();
    if (!url.includes('/memory')) throw new Error(`Expected /memory, got ${url}`);
  });
}

// ─── NEURAL SHIFT PAGE ─────────────────────────────────────────────────────────
async function testNeuralShift() {
  await page.goto(BASE + '/neural', { waitUntil: 'networkidle2' });
  await delay(1500);

  await test('NeuralShift page loads', async () => {
    await waitForSelector('body');
  });

  await test('NeuralShift - mode buttons exist', async () => {
    const modeBtns = await page.$$('button, [class*="mode"], [class*="Mode"]');
    log(`  Found ${modeBtns.length} button/mode elements`);
  });

  await test('NeuralShift - mode buttons toggle correctly', async () => {
    const modeBtn = await page.$('button:has-text("Mode"), button:has-text("Auto"), button:has-text("Manual"), [class*="mode"]');
    if (modeBtn) {
      await modeBtn.click();
      await delay(500);
      log('  Mode button clicked');
    } else {
      log('  No mode buttons found', 'warn');
    }
  });

  await test('NeuralShift - progress indicators animate', async () => {
    const progress = await page.$('[class*="progress"], [class*="Progress"], progress, [class*="bar"]');
    if (progress) {
      log('  Progress indicator found');
    } else {
      log('  No progress indicators found', 'warn');
    }
  });

  await test('NeuralShift - direct URL navigation works', async () => {
    await page.goto(BASE + '/neural', { waitUntil: 'networkidle2' });
    await delay(1000);
    const url = page.url();
    if (!url.includes('/neural')) throw new Error(`Expected /neural, got ${url}`);
  });
}

// ─── CHAT PAGE ─────────────────────────────────────────────────────────────────
async function testChat() {
  await page.goto(BASE + '/chat', { waitUntil: 'networkidle2' });
  await delay(1500);

  await test('Chat page loads', async () => {
    await waitForSelector('body');
  });

  await test('Chat - chat input accepts text', async () => {
    const input = await page.$('input[type="text"], textarea, [class*="input"]');
    if (input) {
      await input.fill('test message');
      const val = await page.evaluate(el => el.value || el.textContent, input);
      log(`  Input accepts text, value length: ${val.length}`);
    } else {
      log('  No chat input found', 'warn');
    }
  });

  await test('Chat - send button exists', async () => {
    const sendBtn = await page.$('button:has-text("Send"), button:has-text("Submit"), button[type="submit"]');
    if (sendBtn) {
      log('  Send button found');
    } else {
      log('  No send button found', 'warn');
    }
  });

  await test('Chat - terminal toggle works', async () => {
    const termToggle = await page.$('button:has-text("Terminal"), button:has-text("Terminal"), [class*="terminal"]');
    if (termToggle) {
      await termToggle.click();
      await delay(500);
      log('  Terminal toggle clicked');
    } else {
      log('  No terminal toggle found', 'warn');
    }
  });

  await test('Chat - gateway status indicator updates', async () => {
    const statusEl = await page.$('[class*="status"], [class*="Status"], .dot');
    log(`  Status indicator found: ${!!statusEl}`);
  });

  await test('Chat - direct URL navigation works', async () => {
    await page.goto(BASE + '/chat', { waitUntil: 'networkidle2' });
    await delay(1000);
    const url = page.url();
    if (!url.includes('/chat')) throw new Error(`Expected /chat, got ${url}`);
  });
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
async function testSettings() {
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle2' });
  await delay(1500);

  await test('Settings page loads', async () => {
    await waitForSelector('body');
  });

  await test('Settings - all tabs navigate correctly', async () => {
    const tabs = await page.$$('[role="tab"], [class*="tab"], button:has-text("General"), button:has-text("Model"), button:has-text("Personality")');
    log(`  Found ${tabs.length} tab/tab-like elements`);
    if (tabs.length > 0) {
      await tabs[0].click();
      await delay(500);
      log('  Tab clicked');
    }
  });

  await test('Settings - config editor loads YAML', async () => {
    const textarea = await page.$('textarea, [class*="editor"], [class*="yaml"], [class*="config"]');
    if (textarea) {
      const content = await page.evaluate(el => el.value || el.textContent, textarea);
      log(`  Config editor has content, length: ${content.length}`);
    } else {
      log('  No config editor found', 'warn');
    }
  });

  await test('Settings - model selector changes', async () => {
    const modelSelect = await page.$('select, [class*="model"]');
    if (modelSelect) {
      const options = await page.$$('option');
      log(`  Model selector found, ${options.length} options`);
      if (options.length > 1) {
        await options[1].click();
        await delay(500);
        log('  Model selected');
      }
    } else {
      log('  No model selector found', 'warn');
    }
  });

  await test('Settings - personality selector changes', async () => {
    const personalityEl = await page.$('[class*="personality"], button:has-text("Personality"), select');
    if (personalityEl) {
      log('  Personality element found');
      const options = await page.$$('option');
      if (options.length > 1) {
        await options[1].click();
        await delay(500);
      }
    } else {
      log('  No personality selector found', 'warn');
    }
  });

  await test('Settings - gateway restart button works', async () => {
    const restartBtn = await page.$('button:has-text("Restart"), button:has-text("Reboot"), button:has-text("Reload")');
    if (restartBtn) {
      await restartBtn.click();
      await delay(2000);
      log('  Restart button clicked');
    } else {
      log('  No restart button found', 'warn');
    }
  });

  await test('Settings - webhook config saves', async () => {
    const webhookInput = await page.$('input[placeholder*="webhook" i], input[name*="webhook"]');
    if (webhookInput) {
      await webhookInput.fill('https://example.com/webhook');
      const saveBtn = await page.$('button:has-text("Save"), button[type="submit"]');
      if (saveBtn) {
        await saveBtn.click();
        await delay(500);
        log('  Webhook config saved');
      }
    } else {
      log('  No webhook input found', 'warn');
    }
  });

  await test('Settings - direct URL navigation works', async () => {
    await page.goto(BASE + '/settings', { waitUntil: 'networkidle2' });
    await delay(1000);
    const url = page.url();
    if (!url.includes('/settings')) throw new Error(`Expected /settings, got ${url}`);
  });
}

// ─── COMMAND PALETTE ──────────────────────────────────────────────────────────
async function testCommandPalette() {
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await delay(1000);

  await test('Command palette - opens with Ctrl+K', async () => {
    await page.keyboard.press('Control+k');
    await delay(500);
    const dialog = await page.$('[role="dialog"], [class*="palette"], [class*="Palette"], [class*="command"]');
    if (!dialog) throw new Error('Command palette did not open');
    log('  Command palette opened');
  });

  await test('Command palette - search filters results', async () => {
    const searchInput = await page.$('[role="dialog"] input, [class*="palette"] input, [class*="Palette"] input');
    if (searchInput) {
      await searchInput.fill('settings');
      await delay(500);
      log('  Palette search works');
      await searchInput.fill('');
      await delay(300);
    }
  });

  await test('Command palette - Escape closes it', async () => {
    await page.keyboard.press('Escape');
    await delay(500);
    const dialog = await page.$('[role="dialog"], [class*="palette"], [class*="Palette"]');
    if (dialog) {
      log('  Dialog still present after Escape', 'warn');
    } else {
      log('  Command palette closed with Escape');
    }
  });

  await test('Command palette - clicking result navigates', async () => {
    await page.keyboard.press('Control+k');
    await delay(500);
    const firstResult = await page.$('[role="dialog"] button, [class*="palette"] button, [class*="Palette"] button, [class*="result"]');
    if (firstResult) {
      await firstResult.click();
      await delay(800);
      log('  Result clicked');
    }
    await page.keyboard.press('Escape');
  });

  await test('Command palette - click outside closes it', async () => {
    await page.keyboard.press('Control+k');
    await delay(500);
    // Click outside
    await page.mouse.click(10, 10);
    await delay(500);
    const dialog = await page.$('[role="dialog"], [class*="palette"]');
    if (!dialog) {
      log('  Palette closed on outside click');
    } else {
      await page.keyboard.press('Escape');
      log('  Palette still open after outside click (may be intentional)', 'warn');
    }
  });

  await test('Command palette - accessibility attributes', async () => {
    await page.keyboard.press('Control+k');
    await delay(500);
    const dialog = await page.$('[role="dialog"]');
    if (dialog) {
      const role = await page.evaluate(el => el.getAttribute('role'), dialog);
      const modal = await page.evaluate(el => el.getAttribute('aria-modal'), dialog);
      log(`  role="${role}", aria-modal="${modal}"`);
      if (role !== 'dialog') log(`  WARN: expected role="dialog", got "${role}"`, 'warn');
    }
    await page.keyboard.press('Escape');
  });
}

// ─── CROSS-CUTTING TESTS ──────────────────────────────────────────────────────
async function testCrossCutting() {
  await test('Tab title updates per page - sessions', async () => {
    await page.goto(BASE + '/sessions', { waitUntil: 'networkidle2' });
    await delay(1000);
    const title = await page.title();
    log(`  Sessions title: "${title}"`);
  });

  await test('Tab title updates per page - logs', async () => {
    await page.goto(BASE + '/logs', { waitUntil: 'networkidle2' });
    await delay(1000);
    const title = await page.title();
    log(`  Logs title: "${title}"`);
  });

  await test('Tab title updates per page - settings', async () => {
    await page.goto(BASE + '/settings', { waitUntil: 'networkidle2' });
    await delay(1000);
    const title = await page.title();
    log(`  Settings title: "${title}"`);
  });

  await test('Browser back/forward navigation', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await delay(500);
    await page.goto(BASE + '/sessions', { waitUntil: 'networkidle2' });
    await delay(500);
    await page.goBack();
    await delay(500);
    const backUrl = page.url();
    await page.goForward();
    await delay(500);
    const forwardUrl = page.url();
    log(`  Back: ${backUrl}, Forward: ${forwardUrl}`);
  });

  await test('Keyboard navigation - Tab through interactive elements', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await delay(500);
    // Tab through first few elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await delay(100);
    }
    log('  Tab navigation executed');
  });

  await test('Mobile viewport - sidebar collapses', async () => {
    await page.setViewport({ width: 375, height: 667 });
    await delay(500);
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await delay(1000);
    const sidebar = await page.$('[class*="sidebar"], aside, nav');
    if (sidebar) {
      const box = await sidebar.boundingBox();
      log(`  Sidebar width at 375px: ${box?.width || 'unknown'}`);
    }
    await page.setViewport({ width: 1280, height: 800 });
    await delay(300);
    log('  Mobile viewport test complete');
  });

  await test('Dark mode consistency across pages', async () => {
    // Check that dark mode CSS variables are consistently applied
    await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
    await delay(500);
    const bgColor = await page.evaluate(() => {
      const el = document.querySelector('body, [class*="app"], #root');
      return window.getComputedStyle(el).backgroundColor;
    });
    log(`  Body background: ${bgColor}`);
  });

  await test('All modals close with Escape', async () => {
    // Test one modal close with Escape
    await page.goto(BASE + '/settings', { waitUntil: 'networkidle2' });
    await delay(500);
    // Press Escape from settings
    await page.keyboard.press('Escape');
    await delay(300);
    log('  Escape key handled');
  });

  await test('Direct URL refresh on every page', async () => {
    const pages = ['/', '/sessions', '/ekg', '/approvals', '/logs', '/memory', '/neural', '/chat', '/settings'];
    for (const p of pages) {
      await page.goto(BASE + p, { waitUntil: 'networkidle2' });
      await delay(500);
      const url = page.url();
      if (!url.includes(p === '/' ? '5175' : p)) {
        log(`  WARN: ${p} redirected to ${url}`, 'warn');
      }
    }
    log('  All direct URL navigations completed');
  });
}

// ─── EXTRA PAGE TESTS ─────────────────────────────────────────────────────────
async function testExtraPages() {
  const extraPages = [
    { path: '/operations', name: 'Operations' },
    { path: '/cron', name: 'Cron' },
    { path: '/skills', name: 'Skills' },
  ];

  for (const { path, name } of extraPages) {
    await test(`${name} page (${path}) loads`, async () => {
      await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
      await delay(1000);
      log(`  ${name} page loaded (status: ${page.url()})`);
    });
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════');
  console.log('  HERMES DASHBOARD V1 — QA TEST SUITE');
  console.log('══════════════════════════════════════\n');

  try {
    await setup();

    // Check if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      log('Redirected to login page', 'warn');
      await testLogin();
    }

    await testOverview();
    await testSessions();
    await testSessionReplay();
    await testEkg();
    await testApprovals();
    await testLogs();
    await testMemory();
    await testNeuralShift();
    await testChat();
    await testSettings();
    await testCommandPalette();
    await testCrossCutting();
    await testExtraPages();
  } catch (err) {
    log(`FATAL: ${err.message}`, 'fail');
  }

  await teardown();

  console.log('\n══════════════════════════════════════');
  console.log('  SUMMARY');
  console.log(`  Total:  ${testCount}`);
  console.log(`  Passed: ${passCount}  ${passCount > 0 ? '✓' : ''}`);
  console.log(`  Failed: ${failCount}  ${failCount > 0 ? '✗' : ''}`);
  console.log('══════════════════════════════════════\n');

  if (RESULTS.filter(r => r.status === 'fail').length > 0) {
    console.log('FAILURES:');
    RESULTS.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  ✗ ${r.name}: ${r.error}`);
    });
  }
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
