const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
  
  await page.goto('http://localhost:5174');
  await page.evaluate(() => localStorage.setItem('hermes_dashboard_token', 'hermes2026'));
  await page.goto('http://localhost:5174/overview');
  await page.waitForTimeout(6000);
  
  console.log(JSON.stringify(errors, null, 2));
  await browser.close();
})();
