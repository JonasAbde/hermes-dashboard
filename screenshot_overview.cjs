const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('http://localhost:5174');
  await page.evaluate(() => localStorage.setItem('hermes_dashboard_token', 'hermes2026'));
  await page.goto('http://localhost:5174/overview');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/overview_check.png', fullPage: true });
  console.log('Screenshot saved');
  await browser.close();
})();
