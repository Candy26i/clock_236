'use strict';

// Run against a local parent-directory mount, matching GitHub Pages /clock_236/.
// Every browser context is new; external HTTP and all WebSockets are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = new URL(process.env.INTEGRATION_TEST_URL || 'http://127.0.0.1:4189/clock_236/');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
  throw new Error('Integration tests must use a localhost preview, never a deployed site.');
}
if (!base.pathname.endsWith('/')) base.pathname += '/';
const deep = new URL('deepspace/', base);
const artifacts = path.resolve(__dirname, '../artifacts');
const saveKey = 'deepspace-companion-v1';
let browser;

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', serviceWorkers: 'block'
  });
  const blocked = new Set(), pageErrors = [], missingDeepAssets = new Set();
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === base.origin) return route.continue();
    blocked.add(url.origin);
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  context.on('page', page => {
    page.on('pageerror', error => pageErrors.push({ page: page.url(), message: error.message }));
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.origin === base.origin && url.pathname.startsWith(deep.pathname) && response.status() >= 400) {
        missingDeepAssets.add(`${response.status()} ${url.pathname}`);
      }
    });
  });

  async function navigateLink(page, link) {
    const viewport = page.viewportSize();
    if (await link.getAttribute('target') === '_blank') {
      const [next] = await Promise.all([page.waitForEvent('popup'), link.click()]);
      await next.waitForLoadState('domcontentloaded');
      if (viewport) await next.setViewportSize(viewport);
      return next;
    }
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), link.click()]);
    return page;
  }

  async function milkReady(page) {
    await page.waitForFunction(() => typeof DB !== 'undefined' && DB.demo === true && document.querySelector('#bStart'));
    assert.equal(await page.evaluate(() => DB.demo), true, 'Legacy controls must run only in isolated demo memory');
    assert.equal(await page.locator('#tabs .tab[data-u]').count(), 2, 'Both original user tabs remain');
    assert.equal(await page.locator('#clock').count(), 1, 'Only the original legacy clock exists');
    const url = new URL(page.url());
    assert.ok([base.pathname, base.pathname + 'index.html'].includes(url.pathname), 'Return stays at the milk-tea homepage');
  }

  async function deepReady(page) {
    await page.waitForSelector('.focus-panel');
    await page.waitForFunction(() => window.CompanionStore && document.getElementById('characterName')?.textContent);
    const url = new URL(page.url());
    assert.equal(url.origin, base.origin);
    assert.ok([deep.pathname, deep.pathname + 'index.html'].includes(url.pathname), 'Deep-space entry preserves the repository subpath');
    assert.equal(await page.evaluate(() => typeof window.firebase), 'undefined', 'Deep-space page does not initialize the legacy Firebase SDK');
  }

  async function noOverflow(page, label) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, label);
  }

  async function goDeep(page) {
    const link = page.locator('header a[href*="deepspace"]').first();
    await link.waitFor();
    const destination = new URL(await link.getAttribute('href'), page.url());
    assert.equal(destination.origin, base.origin);
    assert.ok([deep.pathname, deep.pathname + 'index.html'].includes(destination.pathname));
    const next = await navigateLink(page, link);
    await deepReady(next);
    return next;
  }

  async function goMilk(page) {
    const link = page.locator('a.nav-item').filter({ hasText: '奶茶小铺' }).first();
    const destination = new URL(await link.getAttribute('href'), page.url());
    assert.equal(destination.origin, base.origin);
    assert.ok([base.pathname, base.pathname + 'index.html'].includes(destination.pathname), 'Return link must not lead to the old prototype classic.html');
    const next = await navigateLink(page, link);
    await milkReady(next);
    return next;
  }

  let milk = await context.newPage();
  await milk.goto(base.href);
  await milkReady(milk);
  assert.equal(await milk.locator('#clock').textContent(), '25:00');
  await noOverflow(milk, 'Desktop milk-tea page fits the viewport');
  await milk.locator('#cats [data-c="ky"]').click();
  await milk.locator('#bStart').click();
  await milk.waitForFunction(() => data.u1.session?.cat === 'ky');
  await milk.locator('#bPause').click();
  await milk.waitForFunction(() => !!data.u1.session?.pauseTs);
  const milkPaused = await milk.evaluate(() => data.u1.session);
  await milk.locator('#tabs .tab[data-u="u2"]').click();
  assert.equal(await milk.evaluate(() => view), 'u2');
  assert.equal(await milk.locator('#bStart').count(), 1);
  assert.deepEqual(await milk.evaluate(() => data.u1.session), milkPaused);
  await milk.locator('#tabs .tab[data-u="u1"]').click();
  assert.equal(await milk.locator('#bPause').textContent(), '继续 ▶');
  await milk.screenshot({ path: path.join(artifacts, 'integration-milk-desktop.png') });
  console.log('✓ latest milk-tea homepage: original clock, start/pause, categories and independent tabs');

  let page = await goDeep(milk);
  assert.equal(await page.locator('#characterName').textContent(), '祁煜');
  assert.equal(await page.locator('#todayMinutes').textContent(), '0');
  assert.equal(await page.locator('#fragmentCount').textContent(), '0');
  assert.equal(await page.evaluate(() => CompanionStore.profile().timer), null, 'Legacy timer does not become a second deep-space session');
  await noOverflow(page, 'Desktop deep-space page fits the viewport');
  await page.screenshot({ path: path.join(artifacts, 'integration-deepspace-desktop.png'), fullPage: true });

  await page.locator('[data-action="addTask"]').click();
  await page.locator('[data-template="0"]').click();
  await page.locator('#taskTitle').fill('核对论文的关键证据 <研究>');
  await page.locator('#taskForm button[type="submit"]').click();
  await page.locator('.nav-item[data-view="tasks"]').click();
  assert.equal(await page.locator('.task-card').count(), 1);
  await page.locator('[data-task-step]').first().check();
  assert.equal(await page.evaluate(() => CompanionStore.profile().tasks[0].steps[0].done), true);
  await page.locator('[data-task-focus]').click();
  assert.equal(await page.locator('#focusTask').inputValue(), '核对论文的关键证据 <研究>');
  await page.locator('#focusStart').click();
  await page.waitForFunction(() => !!CompanionStore.profile().timer);
  await page.locator('#focusStart').click();
  await page.waitForFunction(() => CompanionStore.profile().timer?.paused === true);
  const deepPaused = await page.evaluate(() => CompanionStore.profile().timer);
  await page.reload();
  await deepReady(page);
  assert.deepEqual(await page.evaluate(() => CompanionStore.profile().timer), deepPaused);
  assert.equal(await page.locator('#focusTask').inputValue(), '核对论文的关键证据 <研究>');
  await page.locator('[data-profile="xinghui"]').click();
  assert.equal(await page.locator('#characterName').textContent(), '沈星回');
  assert.equal(await page.evaluate(() => CompanionStore.profile().tasks.length), 0);
  assert.equal(await page.locator('#timerDigits').textContent(), '25:00');
  assert.deepEqual(await page.evaluate(() => CompanionStore.profile('qiyu').timer), deepPaused);
  await page.locator('[data-profile="qiyu"]').click();
  await page.locator('#finishEarly').click();
  await page.locator('#confirmFinish').click();
  await page.locator('#closeDialog').click();
  assert.equal(await page.evaluate(() => CompanionStore.profile().minutes), 0);
  assert.equal(await page.evaluate(() => CompanionStore.profile().fragments), 0);
  console.log('✓ deep-space task template/substep, actual timer pause/reload, character isolation and no unearned rewards');

  await page.locator('.nav-item[data-view="stories"]').click();
  assert.equal(await page.locator('[data-chapter]:disabled').count(), 5);
  await page.locator('[data-chapter]').first().click();
  await page.locator('[data-choice="1"]').click();
  const reply = await page.locator('.story-reply').textContent();
  await page.locator('#closeDialog').click();
  await page.reload();
  await deepReady(page);
  await page.locator('#openNextStory').click();
  assert.equal(await page.locator('.story-reply').textContent(), reply);
  await page.locator('#storyNext').click();
  await page.locator('[data-choice="0"]').click();
  await page.locator('#storyNext').click();
  await page.locator('[data-choice="1"]').click();
  await page.locator('#storyNext').click();
  assert.equal(await page.evaluate(() => CompanionStore.profile().storyRead.length), 1);
  assert.equal(await page.evaluate(() => CompanionStore.profile().memories.filter(m => m.type === 'story').length), 1);

  // Time advances only inside this isolated page; no study records leave the browser.
  await page.clock.install();
  await page.locator('[data-duration="25"]').click();
  await page.locator('#focusStart').click();
  await page.clock.fastForward(25 * 60000 + 1000);
  await page.waitForSelector('#saveReflection');
  assert.equal(await page.evaluate(() => CompanionStore.profile().minutes), 25);
  assert.equal(await page.evaluate(() => CompanionStore.profile().fragments), 5);
  await page.locator('#reflection').fill('已核对方法和证据；下一步检查图二。');
  await page.locator('#saveReflection').click();
  await page.clock.fastForward(5000);
  assert.equal(await page.evaluate(() => CompanionStore.profile().minutes), 25);
  await page.locator('.nav-item[data-view="stories"]').click();
  assert.equal(await page.locator('[data-chapter]:disabled').count(), 4);
  console.log('✓ branching story survives reload; timed completion credits once, saves reflection and unlocks a chapter');

  // Preserve the deep-space save through both navigation directions.
  const saved = await page.evaluate(key => localStorage.getItem(key), saveKey);
  milk = await goMilk(page);
  assert.equal(await milk.evaluate(key => localStorage.getItem(key), saveKey), saved);
  await milk.setViewportSize({ width: 390, height: 844 });
  await noOverflow(milk, '390px milk-tea page fits the viewport');
  const entry = milk.locator('header a[href*="deepspace"]').first();
  await entry.scrollIntoViewIfNeeded();
  await milk.screenshot({ path: path.join(artifacts, 'integration-milk-mobile.png') });
  page = await goDeep(milk);
  await noOverflow(page, '390px deep-space home fits the viewport');
  assert.equal(await page.evaluate(() => CompanionStore.profile().minutes), 25);
  assert.equal(await page.evaluate(() => CompanionStore.profile().tasks.length), 1);
  assert.equal(await page.evaluate(() => CompanionStore.profile().storyRead.length), 1);
  await page.screenshot({ path: path.join(artifacts, 'integration-deepspace-mobile.png'), fullPage: true });
  await page.locator('.nav-item[data-view="tasks"]').click();
  await noOverflow(page, '390px tasks fit the viewport');
  assert.equal(await page.locator('.task-card').count(), 1);
  await page.screenshot({ path: path.join(artifacts, 'integration-tasks-mobile.png'), fullPage: true });
  await page.locator('.nav-item[data-view="stories"]').click();
  await noOverflow(page, '390px stories fit the viewport');
  await page.locator('[data-profile="xinghui"]').click();
  assert.equal(await page.locator('#characterName').textContent(), '沈星回');
  assert.equal(await page.evaluate(() => CompanionStore.profile().storyRead.length), 0);
  assert.equal(await page.locator('[data-chapter]:disabled').count(), 5);
  await page.locator('.nav-item[data-view="home"]').click();
  await page.screenshot({ path: path.join(artifacts, 'integration-xinghui-mobile.png'), fullPage: true });
  milk = await goMilk(page);
  await noOverflow(milk, 'Mobile return preserves the milk-tea layout');
  console.log('✓ both navigation directions work at /clock_236/; saves remain intact on desktop and 390px mobile');

  assert.deepEqual([...missingDeepAssets], [], 'Every requested deep-space asset resolves below the repository subpath');
  assert.deepEqual(pageErrors, [], 'No uncaught errors on either page');
  console.log(`PASS integration. Blocked ${blocked.size} external origins; no external HTTP or WebSocket traffic was allowed.`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
});
