const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const outDir = 'C:/Users/Rodol/Documents/Hub/04 Activites/Web Application/Orienta/mobile_screenshots';
fs.mkdirSync(outDir, { recursive: true });

const viewport = { width: 375, height: 812 };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ 
    viewport, 
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  const page = await context.newPage();

  const routes = [
    { name: 'login', path: '/login' },
    { name: 'hub', path: '/' },
    { name: 'create', path: '/create' },
    { name: 'play', path: '/play' },
    { name: 'result', path: '/result' },
    { name: 'classement', path: '/classement' },
    { name: 'tutoriel', path: '/tutoriel' },
  ];

  for (const route of routes) {
    try {
      await page.goto(`http://localhost:5173${route.path}`, { waitUntil: 'networkidle', timeout: 10000 });
      await page.waitForTimeout(1500);
      const screenshotPath = path.join(outDir, `${route.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`✅ ${route.name}: ${screenshotPath}`);
    } catch (e) {
      console.log(`❌ ${route.name}: ${e.message}`);
    }
  }

  await browser.close();
  console.log('Done');
})();
