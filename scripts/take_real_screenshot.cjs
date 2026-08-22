const path = require('path');
const puppeteer = require(path.join(__dirname, '../frontend/node_modules/puppeteer'));

(async () => {
  console.log('🚀 Launching Puppeteer browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 2 });

  console.log('🌐 Navigating to Pinslim editor at http://localhost:5175/editor ...');
  await page.goto('http://localhost:5175/editor', { waitUntil: 'networkidle0' });

  await new Promise(r => setTimeout(r, 1500));

  // Dismiss initial announcement modal if any
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const gotIt = btns.find(b => b.textContent && b.textContent.trim() === 'Got it');
    if (gotIt) gotIt.click();
  });

  await new Promise(r => setTimeout(r, 1000));

  // Click "+ Add" button
  console.log('Clicking "+ Add" button...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find(b => b.textContent && b.textContent.includes('Add'));
    if (addBtn) addBtn.click();
  });

  await new Promise(r => setTimeout(r, 1500));

  console.log('📸 Capturing real Pinslim Component Picker & VELXIO.DEV EXKLUSIV badges screenshot...');
  await page.screenshot({ path: path.join(__dirname, '../docs/assets/pinslim-components-preview.png') });

  // Click Arduino Uno in component picker
  console.log('Clicking Arduino Uno component...');
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('div, span, button, p, h4, h3'));
    const uno = items.find(i => i.textContent && i.textContent.trim() === 'Arduino Uno');
    if (uno) uno.click();
  });

  await new Promise(r => setTimeout(r, 1000));

  // Close modal with Escape key
  console.log('Closing modal to unveil canvas workspace...');
  await page.keyboard.press('Escape');

  await new Promise(r => setTimeout(r, 3000));

  console.log('📸 Capturing real Pinslim Editor workspace canvas screenshot...');
  await page.screenshot({ path: path.join(__dirname, '../docs/assets/pinslim-hero-preview.png') });

  console.log('✅ Screenshots saved successfully!');
  await browser.close();
})();
