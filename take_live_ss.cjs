const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('1. Navigating to login screen...');
    await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle' });

    console.log('2. Manually filling token from .env...');
    // Vi ved token er 'test-token-1234' (fra min tidligere test-opsætning)
    // Men vi prøver at finde feltet uanset placeholder
    await page.fill('input[type="password"]', 'test-token-1234');
    
    console.log('3. Clicking Log ind button...');
    await page.click('button[type="submit"]');

    console.log('4. Waiting for redirect to overview...');
    await page.waitForTimeout(6000); 

    console.log('5. Current URL: ' + page.url());
    
    if (page.url().includes('login')) {
      console.log('STILL ON LOGIN. Trying one more click...');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5000);
    }

    console.log('6. Taking the FINAL LIVE screenshot...');
    await page.screenshot({ path: '/home/empir/.hermes/dashboard/qa_screenshots/01_FINAL_REAL_LOGIN.png' });
    
    await browser.close();
  } catch (err) {
    console.error('ERROR:', err);
    await browser.close();
    process.exit(1);
  }
})();
