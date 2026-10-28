// touch-check.mjs — browser check of the tablet (touch) UI against a running Pinslim.
//
//   BASE_URL=http://192.168.178.199:3082 node scripts/touch-check.mjs
//
// Needs `playwright` resolvable from the working directory (e.g. run it from a
// folder where `npm i playwright` was done). Exits 1 when a check fails.
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

async function open(browser, profile, path) {
  const ctx = await browser.newContext({ ...devices[profile] });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('velxio-whats-new-seen', 'true');
    } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  return { ctx, page };
}

const browser = await chromium.launch();

// ── Landscape tablet ─────────────────────────────────────────────────────────
{
  const { ctx, page: p } = await open(browser, 'iPad (gen 7) landscape', '/de/example/schule-taster');

  const small = await p.evaluate(
    () =>
      [...document.querySelectorAll('button, [role=button], select, a')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width && r.height && (r.width < 40 || r.height < 40)).length,
  );
  check('tap targets: at most 2 controls below 40 px', small <= 2, `${small} found`);
  check('thumb bar is shown', (await p.locator('.canvas-touch-bar:visible').count()) === 1);
  check('no SPICE statistics pill', (await p.getByText(/SPICE \d+ nets/).count()) === 0);

  // tap a part: selects, no dialog, bar offers the four actions
  const btn = await p.locator('wokwi-pushbutton').first().boundingBox();
  await p.touchscreen.tap(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await p.waitForTimeout(600);
  check('tap on a part opens no dialog', (await p.locator('[role=dialog]').count()) === 0);
  const barText = await p.locator('.selection-action-bar').innerText().catch(() => '');
  check(
    'selection bar: Verbinden / Eigenschaften / Drehen / Löschen',
    ['Verbinden', 'Eigenschaften', 'Drehen', 'Löschen'].every((w) => barText.includes(w)),
    barText.replace(/\n/g, ' | '),
  );

  // wire: Verbinden → pick a pin → drag the wire next to the LED anode
  const wires = () => p.evaluate(() => document.querySelectorAll('.wire-layer path').length);
  const before = await wires();
  await p.locator('.selection-action-bar button', { hasText: 'Verbinden' }).tap();
  await p.waitForTimeout(500);
  await p.locator('[role=dialog] button').filter({ hasText: '→' }).nth(1).tap();
  await p.waitForTimeout(700);
  const target = await p.evaluate(() => {
    const el = document.querySelector('[data-pin-overlay][data-pin-name="A"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  check('pin overlays exist while wiring', target !== null);
  if (target) {
    const cdp = await ctx.newCDPSession(p);
    const touch = (type, x, y) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const sx = target.x - 160;
    const sy = target.y + 120;
    await touch('touchStart', sx, sy);
    for (let i = 1; i <= 10; i++) {
      await touch('touchMove', sx + ((target.x + 12 - sx) * i) / 10, sy + ((target.y - sy) * i) / 10);
      await p.waitForTimeout(30);
    }
    await p.waitForTimeout(250);
    const hint = await p.locator('.pin-touch-hint').innerText().catch(() => '');
    check('pin name shown above the finger', /A$/.test(hint), hint);
    await touch('touchEnd', 0, 0);
    await p.waitForTimeout(800);
    check('releasing beside the pin connects it', (await wires()) > before, `${before} → ${await wires()}`);
  }

  // code editor: symbol bar above the keyboard
  await p.locator('.monaco-editor .view-lines').first().tap();
  await p.waitForTimeout(600);
  check('symbol bar appears on editor focus', (await p.locator('.code-symbol-bar').count()) === 1);
  await ctx.close();
}

// ── Portrait tablet ──────────────────────────────────────────────────────────
{
  const { ctx, page: p } = await open(browser, 'iPad (gen 7)', '/de/example/schule-ampel');
  check('portrait: Code | Schaltung tabs', (await p.locator('.mobile-tab-btn:visible').count()) === 2);
  check('portrait: menu bar kept', (await p.locator('.emb-trigger:visible').count()) >= 4);
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall touch checks passed');
