const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  
  const allLogs = [];
  page.on('console', msg => {
    allLogs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', err => {
    allLogs.push({ type: 'PAGEERROR', text: err.message });
  });
  page.on('response', res => {
    if (res.status() >= 400) {
      allLogs.push({ type: 'HTTP_ERROR', text: `${res.status()} ${res.url()}` });
    }
  });
  
  await page.goto('http://localhost:5174');
  await page.evaluate(() => localStorage.setItem('hermes_dashboard_token', 'hermes2026'));
  await page.goto('http://localhost:5174/overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  // Check what React rendered
  const mainContent = await page.evaluate(() => {
    const main = document.querySelector('main') || document.querySelector('[class*="main"]') || document.querySelector('#root');
    return main ? main.innerHTML.substring(0, 500) : 'NO MAIN FOUND';
  });
  
  console.log('=== MAIN CONTENT HTML ===');
  console.log(mainContent);
  console.log('\n=== ALL LOGS ===');
  allLogs.forEach(l => console.log(`[${l.type}] ${l.text}`));
  
  await browser.close();
})();
