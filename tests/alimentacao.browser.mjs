// Local-only browser checks: Firebase is stubbed; no account data or network writes.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(import.meta.dirname, '..');
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const path = resolve(root, '.' + pathname);
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    let content = await readFile(path);
    if (pathname === '/js/script.js') content = 'export const db = {};';
    if (pathname === '/js/alimentacao.js') content = content.toString()
      .replace(/import \{\s*doc,[\s\S]*?firebase-firestore\.js';/, 'const doc = () => ({}), getDoc = async () => ({exists: () => false}), serverTimestamp = () => 0, setDoc = async () => {};')
      .replace(/import \{\s*getAuth,[\s\S]*?firebase-auth\.js';/, 'const getAuth = () => ({}), onAuthStateChanged = (auth, fn) => fn(null);');
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' })[extname(path)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const url = `http://127.0.0.1:${server.address().port}/modules/alimentacao.html`;
  await page.goto(url);
  await page.waitForSelector('.food-recipe-card--compact');
  const profile = () => page.evaluate(() => JSON.parse(localStorage.getItem('alimentacao-profile-v1')));
  const jump = meal => page.locator(`[data-food-meal-jump="${meal}"]`).click();
  assert.equal(await page.locator('#food-recipe-grid .food-recipe-card').count(), 4);
  assert.equal(await page.locator('#food-recipe-grid [data-choose-recipe]').first().isVisible(), true);
  assert.equal(await page.locator('#food-restaurants').getAttribute('open'), null);
  await page.locator('[data-choose-recipe="breakfast-overnight-oats"]').click();
  assert.equal(await page.locator('#food-lunch-grid .food-recipe-card').count(), 8);
  await page.locator('[data-choose-lunch="main-tofu-rice-edamame"]').click();
  await page.locator('[data-food-consumed="lunch"]').click();
  const frozen = (await profile()).consumedMeals.lunch;
  await page.locator('[data-choose-dinner="main-egg-potato-frittata"]').click();
  await page.locator('[data-add-snack-recipe="snack-post-workout-shake"][data-snack-variant="base"]').click();
  await page.locator('[data-add-snack-recipe="snack-skyr-banana-cereal"][data-snack-variant="base"]').click();
  assert.deepEqual((await profile()).consumedMeals.lunch, frozen);
  assert.match(await page.locator('#food-consumed-meals').innerText(), /Almoço · Consumido/);
  await page.reload();
  await page.waitForSelector('.food-recipe-card--compact');
  assert.deepEqual((await profile()).consumedMeals.lunch, frozen);
  await jump('lunch');
  assert.equal(await page.locator('[data-choose-lunch]').first().isDisabled(), true);
  await page.locator('[data-food-settings-open]').click();
  await page.locator('#food-settings-calories').fill('2200');
  await page.locator('#food-settings-form [type="submit"]').click();
  assert.deepEqual((await profile()).consumedMeals.lunch, frozen);
  assert.match(await page.locator('#food-summary-calories').innerText(), /2.?200/);
  // A title-only edit must preserve cooking steps and adjustment metadata.
  const card = page.locator('#food-lunch-grid [data-recipe-id="main-tofu-rice-edamame"]');
  await card.locator('summary').click();
  await card.locator('[data-edit-recipe]').click();
  assert.ok((await page.locator('[name="recipeInstructions"]').inputValue()).length > 20);
  await page.locator('[name="recipeName"]').fill('Tofu pessoal');
  await page.locator('#food-recipe-form [type="submit"]').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alimentacao-recipes-v1')).find(r => r.id === 'main-tofu-rice-edamame'));
  assert.ok(saved.calorieAdjustment);
  assert.ok(saved.instructions.length >= 3);
  assert.deepEqual((await profile()).consumedMeals.lunch, frozen);
  // Manual kcal remain partial, including after persistence/reload.
  await jump('dinner');
  await page.locator('#food-dinner-stage .food-meal-calorie-entry > summary').click();
  await page.locator('[data-meal-calorie-form="dinner"] [name="mealCalories"]').fill('650');
  await page.locator('[data-meal-calorie-form="dinner"] [type="submit"]').click();
  assert.match(await page.locator('#food-summary-protein').innerText(), /parcial/);
  await page.reload();
  await page.waitForSelector('.food-recipe-card--compact');
  assert.match(await page.locator('#food-summary-note').innerText(), /parcialmente conhecidos/);
  await page.locator('[data-food-consumed="lunch"]').click();
  assert.equal((await profile()).consumedMeals.lunch, undefined);
  await jump('lunch');
  assert.equal(await page.locator('[data-choose-lunch]').first().isEnabled(), true);
  // Repeating a prepared recipe is allowed, and daily reset preserves the library.
  await page.locator('[data-choose-lunch="main-soy-bolognese"]').click();
  await page.locator('[data-choose-dinner="main-soy-bolognese"]').click();
  assert.equal((await profile()).selectedLunchId, (await profile()).selectedDinnerId);
  await page.locator('[data-food-consumed="lunch"]').click();
  const shots = join(tmpdir(), 'finance-alimentacao-preview');
  await mkdir(shots, { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const meal of ['breakfast', 'lunch', 'dinner', 'snacks']) {
      await jump(meal);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
        console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].map(el => ({ tag: el.tagName, id: el.id, cls: el.className, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })).filter(el => el.right > innerWidth + 1).slice(0, 20)));
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${meal}: overflow at ${width}`);
      assert.equal(await page.locator('#food-macro-summary-title').isVisible(), true);
      assert.equal(await page.locator('[data-food-settings-open]').isVisible(), true);
    }
    await jump('lunch');
    await page.evaluate(() => scrollTo(0, 0));
    if ([390, 1440].includes(width)) await page.screenshot({ path: join(shots, `lunch-${width}.png`), fullPage: true });
  }
  await page.evaluate(() => {
    const key = 'alimentacao-profile-v1';
    const stored = JSON.parse(localStorage.getItem(key));
    stored.planDate = '2000-01-01';
    localStorage.setItem(key, JSON.stringify(stored));
  });
  await page.reload();
  await page.waitForSelector('.food-recipe-card--compact');
  const reset = await profile();
  assert.deepEqual(reset.consumedMeals, {});
  assert.equal(reset.selectedLunchId, '');
  assert.deepEqual(reset.snacks, []);
  assert.equal(reset.manualCalories, 2200);
  await jump('lunch');
  assert.match(await page.locator('#food-lunch-grid').innerText(), /Tofu pessoal/);
  assert.deepEqual(errors, []);
  console.log(`Alimentação: snapshots, editing, manual kcal, reload and responsive checks passed. Screenshots: ${shots}`);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
