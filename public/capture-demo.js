const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  // Create screenshots directory if it doesn't exist
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport to a good size for the demo
  await page.setViewport({
    width: 1200,
    height: 800,
    deviceScaleFactor: 1,
  });

  // Load the demo page
  await page.goto('file://' + path.join(__dirname, 'demo.html'));
  
  // Wait for animations to start
  await page.waitForTimeout(2000);
  
  // Take a screenshot of the full page
  await page.screenshot({
    path: path.join(screenshotsDir, 'demo-full.png'),
    fullPage: true
  });
  
  // Take a screenshot of just the stats section
  const statsElement = await page.$('.stats-container');
  if (statsElement) {
    await statsElement.screenshot({
      path: path.join(screenshotsDir, 'demo-stats.png')
    });
  }
  
  // Take a screenshot of the game section
  const gameElement = await page.$('.counter-game');
  if (gameElement) {
    await gameElement.screenshot({
      path: path.join(screenshotsDir, 'demo-game.png')
    });
  }
  
  // Take a screenshot of the tokenomics section
  const tokenomicsElement = await page.$('.tokenomics');
  if (tokenomicsElement) {
    await tokenomicsElement.screenshot({
      path: path.join(screenshotsDir, 'demo-tokenomics.png')
    });
  }

  console.log('Screenshots saved to', screenshotsDir);
  await browser.close();
})();
