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

  // Dismiss initial announcement modal if present
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const gotIt = btns.find(b => b.textContent && b.textContent.trim() === 'Got it');
    if (gotIt) gotIt.click();
  });

  await new Promise(r => setTimeout(r, 1000));

  // 1. Capture Component Picker preview first (with VELXIO.DEV EXKLUSIV tags)
  console.log('Opening Add Component modal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find(b => b.textContent && b.textContent.includes('Add'));
    if (addBtn) addBtn.click();
  });

  await new Promise(r => setTimeout(r, 1500));

  console.log('📸 Capturing Component Picker preview...');
  await page.screenshot({ path: path.join(__dirname, '../docs/assets/pinslim-components-preview.png') });

  // Close component modal
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 1000));

  // 2. Open Examples modal and load a rich circuit (e.g. SSD1306 OLED or KY-040 Encoder)
  console.log('Opening Examples modal via File menu...');
  await page.evaluate(() => {
    const menuSpans = Array.from(document.querySelectorAll('span, button, div'));
    const fileMenu = menuSpans.find(s => s.textContent && s.textContent.trim() === 'File');
    if (fileMenu) fileMenu.click();
  });

  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    const menuItems = Array.from(document.querySelectorAll('div, span, button, li'));
    const examplesBtn = menuItems.find(i => i.textContent && (i.textContent.includes('Beispiele') || i.textContent.includes('Examples')));
    if (examplesBtn) examplesBtn.click();
  });

  await new Promise(r => setTimeout(r, 2000));

  // Click the first example in the gallery (e.g., OLED or Rotary Encoder)
  console.log('Selecting example circuit...');
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.example-card, div[class*="card"], div[class*="Example"]'));
    if (cards.length > 0) {
      cards[0].click();
    } else {
      // Fallback: search for OLED or Uno text
      const items = Array.from(document.querySelectorAll('h3, h4, div, span'));
      const card = items.find(i => i.textContent && i.textContent.includes('OLED'));
      if (card) card.click();
    }
  });

  await new Promise(r => setTimeout(r, 3500));

  console.log('📸 Capturing real Pinslim Hero Workspace screenshot with circuit & code...');
  await page.screenshot({ path: path.join(__dirname, '../docs/assets/pinslim-hero-preview.png') });

  console.log('✅ Screenshots generated successfully!');
  await browser.close();
})();
