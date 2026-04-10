// hermes-profile-test.cjs
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const TOKEN = 'hermes2026';
  const BASE_URL = 'http://localhost:5174';

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate((token) => {
    localStorage.setItem('hermes_dashboard_token', token);
    localStorage.setItem('hermes_dashboard_csrf_token', 'fake-csrf-token');
  }, TOKEN);

  await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/home/empir/Downloads/hermes_profile_fixed.png', fullPage: true });
  console.log('Screenshot saved: /home/empir/Downloads/hermes_profile_fixed.png');
  await browser.close();
  process.exit(0);
})();
