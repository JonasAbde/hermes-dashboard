const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  
  const errors = [];
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('CONSOLE_ERROR: ' + msg.text());
  });
  
  // Set token BEFORE navigation
  const context = browser.contexts()[0];
  await context.addCookies([{
    name: 'token',
    value: 'hermes2026',
    domain: 'localhost',
    path: '/'
  }]);
  
  await page.goto('http://localhost:5174');
  await page.evaluate(() => localStorage.setItem('hermes_dashboard_token', 'hermes2026'));
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  await page.screenshot({ path: '/tmp/overview_root.png', fullPage: true });
  
  const mainHTML = await page.evaluate(() => {
    const main = document.querySelector('main');
    return main ? main.innerHTML.substring(0, 300) : 'NO MAIN';
  });
  
  console.log('=== MAIN HTML ===');
  console.log(mainHTML);
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(e));
  
  await browser.close();
})();
