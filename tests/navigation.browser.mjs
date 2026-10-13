// Run with Node and Playwright installed (or PLAYWRIGHT_MODULE pointing to it).
// Synthetic authentication; no Firebase, remote requests or personal data.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(import.meta.dirname, '..');
const script = await readFile(join(root, 'js/script.js'), 'utf8');
const fixtureScript = script.slice(0, script.indexOf('initNavWhenReady();')) +
  script.slice(script.indexOf('function atualizarInterface('), script.indexOf('export function isCurrentUserFilipa')) + `
  document.documentElement.classList.remove('app-access-pending');
  window.rebuildNav = (uid = 'navigation-test', label = 'Utilizador de teste') => {
    currentUser = uid ? { uid, displayName: label } : null;
    buildGlobalNav(currentUser);
  };
  window.rebuildNav();`;
const html = `<!doctype html><html lang="pt"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/css/styles.pcolor.css"><link rel="stylesheet" href="/css/mobile.css"><link rel="stylesheet" href="/css/theme-dark.css"></head><body data-theme="dark"><main style="min-height:200vh"><h1>Ginásio</h1><p>Pré-visualização local da navegação.</p><button id="content-action">Ação da página</button></main><script type="module" src="/js/script.js"></script></body></html>`;
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.endsWith('.html')) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
  if (pathname === '/js/script.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(fixtureScript); return; }
  const path = resolve(root, '.' + pathname);
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const content = await readFile(path);
    res.setHeader('Content-Type', ({ '.css': 'text/css', '.js': 'text/javascript' })[extname(path)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/modules/ginasio.html`);
  await page.waitForFunction(() => document.querySelector('.app-navigation'));
  const layout = () => page.locator('.app-navigation').getAttribute('data-layout');
  const state = () => page.evaluate(() => ({
    expanded: document.querySelector('#menu-icon').getAttribute('aria-expanded'),
    inert: document.querySelector('main').inert,
    overflow: document.body.style.overflow,
    focused: document.activeElement.id,
    panelInert: document.querySelector('#nav-panel').inert
  }));
  const closed = async () => {
    const value = await state();
    assert.equal(value.expanded, 'false');
    assert.equal(value.inert, false);
    assert.equal(value.overflow, '');
  };
  const shots = join(tmpdir(), 'finance-navigation-preview');
  await mkdir(shots, { recursive: true });
  for (const width of [320, 360, 412, 690, 768, 900, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForFunction(() => document.querySelector('.app-navigation').dataset.layout === 'drawer');
    assert.equal(await layout(), 'drawer');
    await page.locator('#menu-icon').click();
    assert.equal((await state()).inert, true);
    assert.equal((await state()).overflow, 'hidden');
    assert.equal(await page.locator('.is-current > button').getAttribute('aria-expanded'), 'true');
    const geometry = await page.evaluate(() => ({
      panel: document.querySelector('#nav-panel').getBoundingClientRect().width,
      overflow: document.documentElement.scrollWidth > innerWidth,
      activeHeight: document.querySelector('[aria-current]').getBoundingClientRect().height
    }));
    assert.ok(geometry.panel <= width - 32);
    assert.equal(geometry.overflow, false);
    assert.ok(geometry.activeHeight >= 44);
    if ([360, 768].includes(width)) await page.screenshot({ path: join(shots, `drawer-${width}.png`) });
    await page.keyboard.press('Escape');
    await closed();
    assert.equal((await state()).focused, 'menu-icon');
  }
  // Fold/unfold while the drawer is open: preserve it and its current section.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('#menu-icon').click();
  for (const width of [768, 360]) {
    await page.setViewportSize({ width, height: 800 });
    assert.equal((await state()).expanded, 'true');
    assert.equal((await state()).inert, true);
  }
  // Keyboard focus cycles inside the panel, and tapping the backdrop closes it.
  await page.locator('.nav-close').focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.querySelector('#nav-panel').contains(document.activeElement)), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.nav-close').evaluate(el => el === document.activeElement), true);
  await page.mouse.click(350, 400);
  await closed();
  await page.locator('#menu-icon').click();
  await page.locator('.nav-close').click();
  await closed();
  // Switch to desktop with a modal open: no stale backdrop, inert content or scroll lock.
  await page.locator('#menu-icon').click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(100);
  await page.waitForFunction(() => document.querySelector('.app-navigation').dataset.layout === 'bar');
  await closed();
  assert.equal((await state()).panelInert, false);
  await page.locator('.is-current > button').click();
  assert.equal(await page.locator('[aria-current]').isVisible(), true);
  await page.screenshot({ path: join(shots, 'desktop-1440.png') });
  await page.locator('[aria-current]').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.is-current > button').evaluate(el => el === document.activeElement), true);
  assert.equal(await page.locator('.is-current > button').getAttribute('aria-expanded'), 'false');
  // Measure fit, not device category; the account cannot overlap navigation.
  for (const width of [1100, 1200, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(50);
    if (await layout() === 'bar') {
      assert.equal(await page.evaluate(() => {
        const links = document.querySelector('.nav-links').getBoundingClientRect();
        const account = document.querySelector('.login-block').getBoundingClientRect();
        return links.right <= account.left && account.right <= innerWidth;
      }), true);
    }
  }
  // Rebuilding on auth changes cleans up modal state and old document listeners.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('#menu-icon').click();
  await page.evaluate(() => window.rebuildNav('Fg8GKPt6fNb1vXIZf3Eg0xsHQID3'));
  await closed();
  assert.equal(await page.locator('.nav-group').count(), 1);
  await page.locator('#menu-icon').click();
  await page.keyboard.press('Escape');
  await closed();
  await page.evaluate(() => window.rebuildNav(null));
  await page.locator('#menu-icon').click();
  assert.equal(await page.locator('#login-btn').isVisible(), true);
  assert.equal(await page.locator('.nav-group').count(), 0);
  await page.keyboard.press('Escape');
  // Landscape and normal motion: the close control remains reachable when scrolling.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.rebuildNav());
  await page.setViewportSize({ width: 768, height: 360 });
  await page.locator('#menu-icon').click();
  await page.locator('#nav-panel').evaluate(el => { el.scrollTop = el.scrollHeight; });
  const closeRect = await page.locator('.nav-close').boundingBox();
  assert.ok(closeRect.y >= 0 && closeRect.y + closeRect.height <= 360);
  await page.locator('.nav-close').click();
  await closed();
  // Desktop can also be used with touch; a long account name must not cover groups.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.rebuildNav('navigation-test', 'Nome de utilizador muito comprido para testar o espaço da conta'));
  await page.waitForFunction(() => document.querySelector('.app-navigation').dataset.layout === 'bar');
  await page.locator('.is-current > button').tap();
  assert.equal(await page.locator('[aria-current]').isVisible(), true);
  await page.locator('#content-action').click();
  assert.equal(await page.locator('.is-current > button').getAttribute('aria-expanded'), 'false');
  assert.deepEqual(errors, []);
  console.log(`PASS: responsive widths, fold transitions, focus, backdrop, Escape, desktop fit, authentication cleanup. Screenshots: ${shots}`);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
