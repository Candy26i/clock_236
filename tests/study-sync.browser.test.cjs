'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = new URL(process.env.INTEGRATION_TEST_URL || 'http://127.0.0.1:4189/clock_236/');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error('Use a localhost preview only.');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const deepURL = new URL('deepspace/', base).href;
const artifacts = path.resolve(__dirname, '../artifacts');
const fixedNow = Date.parse('2026-09-29T05:00:00.000Z');
const dayLA = '2026-09-28', dayNY = '2026-09-29';
const fixture = {
  key: '__study_sync_test_firebase__',
  data: { 'milktea-v1': { users: {
    u1: {
      name: 'ljx', tz: 'America/Los_Angeles',
      days: { [dayLA]: { m: { ky: 40, xx: 20, dl: 999 }, todos: { existing: { text: 'Keep this task', done: true } } } },
      economy: { coins: 17, unlockedScenes: { room: true, outdoor: true } },
      stats: { bondXp: 8 }, petLife: { location: 'u1', homeSince: fixedNow, lastTick: fixedNow, lastWanderCheck: fixedNow }
    },
    u2: {
      name: 'Zhai', tz: 'America/New_York', days: { [dayNY]: { m: { ky: 3, xx: 4, dl: 120 } } },
      economy: { coins: 9, unlockedScenes: { room: true, outdoor: true } },
      stats: { bondXp: 2 }, petLife: { location: 'u2', homeSince: fixedNow, lastTick: fixedNow, lastWanderCheck: fixedNow }
    }
  } } }
};

// This compatibility fake is installed before any application script. It never
// constructs a network client. Only the test-specific localStorage key is used.
function installFakeFirebase({ key, data }) {
  if (!/^https?:$/.test(location.protocol)) return;
  const copy = value => value == null ? null : JSON.parse(JSON.stringify(value));
  if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(data));
  const readAll = () => JSON.parse(localStorage.getItem(key));
  const get = (root, path) => path === '.info/connected' ? true : path.split('/').filter(Boolean).reduce((value, part) => value?.[part], root) ?? null;
  const snapshot = value => ({ val: () => copy(value), exists: () => value != null });
  const listeners = new Set();
  const writes = [];
  function put(root, path, value) {
    const parts = path.split('/').filter(Boolean);
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!node[part] || typeof node[part] !== 'object') node[part] = {};
      node = node[part];
    }
    if (value == null) delete node[parts.at(-1)];
    else node[parts.at(-1)] = copy(value);
  }
  function notify(before, after) {
    for (const listener of [...listeners]) {
      const value = get(after, listener.path);
      if (JSON.stringify(get(before, listener.path)) !== JSON.stringify(value)) {
        queueMicrotask(() => { if (listeners.has(listener)) listener.callback(snapshot(value)); });
      }
    }
  }
  function save(before, after, path, kind) {
    writes.push({ path, kind });
    localStorage.setItem(key, JSON.stringify(after));
    notify(before, after);
  }
  addEventListener('storage', event => {
    if (event.key === key && event.newValue) notify(JSON.parse(event.oldValue || '{}'), JSON.parse(event.newValue));
  });
  function ref(path) {
    path = String(path).replace(/^\/+|\/+$/g, '');
    return {
      on(event, callback) {
        if (event !== 'value') throw new Error('Fake only supports value listeners');
        const listener = { path, callback }; listeners.add(listener);
        queueMicrotask(() => { if (listeners.has(listener)) callback(snapshot(get(readAll(), path))); });
        return callback;
      },
      off(event, callback) {
        for (const listener of listeners) if (listener.path === path && (!callback || listener.callback === callback)) listeners.delete(listener);
      },
      once() { return Promise.resolve(snapshot(get(readAll(), path))); },
      set(value) {
        const before = readAll(), after = copy(before); put(after, path, value); save(before, after, path, 'set');
        return Promise.resolve();
      },
      update(values) {
        const before = readAll(), after = copy(before);
        for (const [part, value] of Object.entries(values)) put(after, path + '/' + part, value);
        save(before, after, path, 'update'); return Promise.resolve();
      },
      transaction(reducer, complete) {
        try {
          const before = readAll(), previous = get(before, path), next = reducer(copy(previous));
          let result;
          if (next === undefined) result = { committed: false, snapshot: snapshot(previous) };
          else {
            const after = copy(before); put(after, path, next); save(before, after, path, 'transaction');
            result = { committed: true, snapshot: snapshot(get(after, path)) };
          }
          if (complete) queueMicrotask(() => complete(null, result.committed, result.snapshot));
          return Promise.resolve(result);
        } catch (error) {
          if (complete) queueMicrotask(() => complete(error, false, snapshot(get(readAll(), path))));
          return Promise.reject(error);
        }
      }
    };
  }
  const database = { ref };
  const firebase = {
    apps: [],
    initializeApp(options, name = '[DEFAULT]') {
      if (this.apps.some(app => app.name === name)) throw new Error('Duplicate fake Firebase app');
      const app = { name, options, database: () => database }; this.apps.push(app); return app;
    },
    database: () => database
  };
  Object.defineProperty(window, 'firebase', { value: firebase, writable: false });
  window.__studyTestCloud = { read: path => copy(get(readAll(), path)), writes: () => copy(writes), fake: true };
}

let browser;
(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [], blocked = new Set();
  async function isolatedContext(mock = true) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === base.origin) return route.continue();
      blocked.add(url.origin); return route.abort('blockedbyclient');
    });
    await context.routeWebSocket('**/*', socket => socket.close());
    context.on('page', page => page.on('pageerror', error => errors.push({ page: page.url(), message: error.message })));
    if (mock) await context.addInitScript(installFakeFirebase, fixture);
    return context;
  }
  async function open(context, url) {
    const page = await context.newPage();
    await page.clock.install({ time: fixedNow });
    await page.goto(url);
    return page;
  }
  async function cloud(page) { return page.evaluate(() => __studyTestCloud.read('milktea-v1/users')); }
  async function total(page, expected) {
    await page.waitForFunction(value => window.CompanionStudy?.summary('qiyu').totalMinutes === value, expected);
    await page.waitForFunction(value => document.getElementById('sharedTotalMinutes')?.textContent === String(value), expected);
    assert.equal(await page.locator('#todayMinutes').textContent(), String(expected));
  }
  async function nativeFocus(page, minutes) {
    await page.locator('#cats [data-c="xx"]').click();
    await page.locator('#durSlider').evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); }, minutes);
    await page.locator('#bStart').click();
    await page.waitForFunction(value => data.u1.session?.durMin === value, minutes);
    await page.clock.fastForward(minutes * 60000 + 1000);
    await page.waitForFunction(() => data.u1.session === null);
  }

  const context = await isolatedContext();
  const deep = await open(context, deepURL);
  await deep.waitForSelector('#studySync');
  await total(deep, 60);
  assert.equal(await deep.evaluate(() => __studyTestCloud.fake), true);
  assert.equal(await deep.evaluate(() => CompanionStudy.timeZone('qiyu')), 'America/Los_Angeles');
  assert.equal(await deep.evaluate(() => CompanionStudy.timeZone('xinghui')), 'America/New_York');
  assert.equal(await deep.locator('#studySyncOwner').textContent(), 'ljx · 共同累计');
  assert.equal(await deep.locator('#fragmentCount').textContent(), '0');
  assert.equal(await deep.evaluate(() => CompanionStore.profile().minutes), 0);
  await deep.locator('.nav-item[data-view="stories"]').click();
  assert.equal(await deep.locator('[data-chapter]:disabled').count(), 3, 'Existing cloud study unlocks the 25/60-minute chapters');
  await deep.locator('.nav-item[data-view="home"]').click();
  await deep.screenshot({ path: path.join(artifacts, 'study-sync-cloud-60.png'), fullPage: true });
  console.log('✓ cloud-only 40+20 minutes show 60, exclude exercise, unlock stories and award no local star fragments');

  // Keep a second page open to verify real subscription updates in both directions.
  const milk = await open(context, base.href);
  await milk.waitForFunction(() => typeof DB !== 'undefined' && DB.demo === false && data.u1.name === 'ljx' && data.u1.days['2026-09-28']?.m?.ky === 40);
  assert.equal(await milk.evaluate(() => __studyTestCloud.fake), true, 'Cloud mode is backed exclusively by the injected fake');
  await deep.locator('[data-category="科研"]').click();
  await deep.locator('[data-duration="25"]').click();
  await deep.locator('#focusStart').click();
  await deep.clock.fastForward(25 * 60000 + 1000);
  await deep.waitForSelector('#saveReflection');
  await deep.clock.runFor(300);
  await total(deep, 85);
  let users = await cloud(deep);
  assert.deepEqual(users.u1.days[dayLA].m, { ky: 65, xx: 20, dl: 999 });
  assert.equal(Object.keys(users.u1.studySync.deepspaceSessions).length, 1);
  assert.equal(users.u1.economy.coins, 17, 'Deep-space synchronization never grants milk-tea coins');
  assert.equal(users.u1.days[dayLA].todos.existing.text, 'Keep this task');
  assert.equal(await deep.evaluate(() => CompanionStore.profile().minutes), 25);
  assert.equal(await deep.locator('#fragmentCount').textContent(), '5');
  await deep.locator('#saveReflection').click();
  await milk.waitForFunction(() => studyMin('u1') === 85);
  assert.match(await milk.locator('#stKy').textContent(), /^1\s*小时\s*5\s*分$/);
  assert.equal(await milk.locator('#stXx').textContent(), '20 分钟');
  console.log('✓ deep-space 25-minute research session reaches the original milk-tea totals once, with all unrelated state preserved');

  await nativeFocus(milk, 25);
  await total(deep, 110);
  users = await cloud(milk);
  assert.deepEqual(users.u1.days[dayLA].m, { ky: 65, xx: 45, dl: 999 });
  assert.equal(users.u1.economy.coins, 17);
  assert.equal(await deep.locator('#fragmentCount').textContent(), '5', 'Native milk-tea minutes do not re-award deep-space fragments');
  await deep.locator('.nav-item[data-view="stories"]').click();
  assert.equal(await deep.locator('[data-chapter]:disabled').count(), 3);
  await deep.locator('[data-chapter]').nth(2).click();
  assert.equal(await deep.locator('[data-choice]').count() > 0, true, 'A 60-minute story is playable with only 25 deep-space minutes');
  await deep.locator('#closeDialog').click();
  await nativeFocus(milk, 10);
  await deep.waitForFunction(() => CompanionStudy.summary('qiyu').totalMinutes === 120);
  await deep.waitForFunction(() => document.querySelectorAll('[data-chapter]:disabled').length === 2);
  console.log('✓ original milk-tea timer adds 25 minutes back to deep-space (110); another 10 minutes unlock the 120-minute chapter live');

  await deep.locator('[data-profile="xinghui"]').click();
  assert.equal(await deep.locator('#studySyncOwner').textContent(), 'zhai · 共同累计');
  assert.equal(await deep.locator('#sharedTotalMinutes').textContent(), '7');
  assert.equal(await deep.locator('#todayMinutes').textContent(), '7', 'New York date is used, not the profile Shanghai default');
  assert.equal(await deep.locator('#fragmentCount').textContent(), '0');
  assert.equal(await deep.evaluate(() => CompanionStore.profile().sessions.length), 0);
  users = await cloud(deep);
  assert.deepEqual(users.u2.days[dayNY].m, { ky: 3, xx: 4, dl: 120 });
  await deep.locator('[data-profile="qiyu"]').click();
  await deep.locator('.nav-item[data-view="home"]').click();
  await total(deep, 120);

  const saved = await deep.evaluate(() => CompanionStore.exportData());
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal(await deep.evaluate(text => CompanionStore.importData(text).ok, saved), true);
    await deep.clock.runFor(300);
    await deep.reload();
    await deep.waitForSelector('#sharedTotalMinutes');
    await total(deep, 120);
  }
  users = await cloud(deep);
  assert.equal(Object.keys(users.u1.studySync.deepspaceSessions).length, 1);
  assert.deepEqual(users.u1.days[dayLA].m, { ky: 65, xx: 55, dl: 999 });
  assert.equal(await deep.evaluate(() => CompanionStudy.summary().pendingCount), 0);
  assert.equal(await deep.evaluate(() => CompanionStore.profile().timer), null);
  await deep.setViewportSize({ width: 390, height: 844 });
  assert.equal(await deep.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await deep.screenshot({ path: path.join(artifacts, 'study-sync-mobile-120.png'), fullPage: true });
  await milk.screenshot({ path: path.join(artifacts, 'study-sync-milk-120.png') });
  console.log('✓ account/date isolation, duplicate save imports and reloads keep one receipt and unchanged totals; mobile layout fits');

  // No other page remains to emit cloud changes. The idle date ticker must reset
  // today's number itself, within its next 60-second check, while keeping totals.
  await milk.close();
  const cloudBeforeMidnight = await cloud(deep);
  const dateBeforeMidnight = await deep.locator('#todayDate').textContent();
  await deep.clock.fastForward(2 * 60 * 60000 + 61000);
  await deep.waitForFunction(() => document.getElementById('todayMinutes')?.textContent === '0');
  assert.equal(await deep.locator('#sharedTotalMinutes').textContent(), '120');
  assert.notEqual(await deep.locator('#todayDate').textContent(), dateBeforeMidnight);
  assert.equal(await deep.evaluate(() => CompanionStudy.summary().cloudToday), 0);
  assert.deepEqual(await cloud(deep), cloudBeforeMidnight, 'Idle midnight refresh cannot alter any cloud record');
  await deep.screenshot({ path: path.join(artifacts, 'study-sync-mobile-new-day.png'), fullPage: true });
  console.log('✓ idle Los Angeles midnight updates today/date without a cloud event, and preserves the 120-minute cumulative total');

  // A separate context has no injected SDK, no fake cloud, and no existing cache.
  const offlineContext = await isolatedContext(false);
  const offline = await open(offlineContext, deepURL);
  await offline.waitForSelector('#focusStart');
  await offline.waitForFunction(() => window.CompanionStudy?.summary().status === 'error');
  assert.equal(await offline.evaluate(() => typeof window.firebase), 'undefined');
  await offline.locator('#customDuration').fill('1');
  await offline.locator('#customDuration').dispatchEvent('change');
  await offline.locator('#focusStart').click();
  await offline.clock.fastForward(61000);
  await offline.waitForSelector('#saveReflection');
  await offline.locator('#saveReflection').click();
  assert.equal(await offline.evaluate(() => CompanionStore.profile().minutes), 1);
  assert.equal(await offline.evaluate(() => CompanionStudy.summary().pendingMinutes), 1);
  const pending = await offline.evaluate(() => JSON.parse(localStorage.getItem('deepspace-study-outbox-v1')));
  assert.equal(Object.keys(pending.profiles.qiyu).length, 1);
  await offline.reload();
  await offline.waitForSelector('#sharedTotalMinutes');
  await offline.waitForFunction(() => CompanionStudy.summary().status === 'error');
  assert.equal(await offline.locator('#sharedTotalMinutes').textContent(), '1');
  assert.equal(await offline.locator('#todayMinutes').textContent(), '1');
  assert.equal(await offline.evaluate(() => CompanionStudy.summary().pendingMinutes), 1);
  await offline.screenshot({ path: path.join(artifacts, 'study-sync-offline-pending.png'), fullPage: true });
  console.log('✓ unavailable SDK leaves local study usable and persists the pending session across reload');

  assert.deepEqual(errors, [], 'No uncaught errors in either compatibility mode');
  console.log(`PASS browser study sync. All cloud data was fake; ${blocked.size} external origins and every WebSocket were blocked.`);
  await context.close(); await offlineContext.close();
})().catch(error => {
  console.error(error); process.exitCode = 1;
}).finally(async () => { await browser?.close(); });
