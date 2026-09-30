'use strict';

// A fresh browser and an ephemeral loopback server keep this regression away
// from deployed Firebase and the user's normal browser/localStorage profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const prefix = '/clock_236/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const file = path.resolve(root, pathname.slice(prefix.length) + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end(); return;
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(fs.readFileSync(file));
  } catch (_) { response.writeHead(400).end(); }
});
let browser;

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-background-networking', '--disable-sync'] });
  const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
  const errors = [], blocked = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    blocked.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(() => {
    const original = Storage.prototype.setItem;
    window.testSaveWrites = 0;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'deepspace-companion-v1') window.testSaveWrites++;
      return original.call(this, key, value);
    };
  });
  const a = await context.newPage(), b = await context.newPage();
  for (const page of [a, b]) {
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + prefix + 'deepspace/');
    await page.waitForFunction(() => document.querySelector('video[data-player-active="true"]')?.dataset.clipId === 'qiyu-original-gaze');
    assert.equal(await page.evaluate(() => typeof window.firebase), 'undefined');
  }

  async function aligned(page, character, name) {
    await page.waitForFunction(({ character, name }) =>
      CompanionStore.state().selected === character &&
      document.querySelector('#characterName').textContent === name &&
      document.querySelector('#scene').dataset.character === character &&
      document.querySelector('.profile-btn.active')?.dataset.profile === character,
    { character, name });
    await page.waitForFunction(character => document.querySelector('video[data-player-active="true"]')?.dataset.clipId?.startsWith(character + '-'), character);
  }

  // A normal in-page store update must not destroy the user's task form/draft.
  await a.locator('#focusTask').fill('旧角色的未提交草稿');
  await a.locator('[data-action="addTask"]').click();
  await a.locator('#taskTitle').fill('仍在编辑的祁煜任务');
  await a.evaluate(() => {
    window.originalTaskInput = document.getElementById('taskTitle');
    CompanionStore.update(state => { state.settings.romance = false; });
  });
  assert.equal(await a.evaluate(() => document.getElementById('taskTitle') === originalTaskInput), true);
  assert.equal(await a.locator('#taskTitle').inputValue(), '仍在编辑的祁煜任务');
  assert.equal(await a.locator('#focusTask').inputValue(), '旧角色的未提交草稿');
  assert.equal(await a.locator('#dialog').evaluate(dialog => dialog.open), true);
  await b.waitForFunction(() => CompanionStore.state().settings.romance === false);
  console.log('✓ local store updates preserve the task form and unsaved focus input');

  const aWrites = await a.evaluate(() => testSaveWrites);
  await b.locator('[data-profile="xinghui"]').click();
  await aligned(a, 'xinghui', '沈星回');
  assert.equal(await a.locator('#dialog').evaluate(dialog => dialog.open), false);
  assert.equal(await a.locator('#taskTitle').count(), 0, 'Old character form callbacks are removed');
  assert.equal(await a.locator('#focusTask').inputValue(), '');
  assert.equal(await a.evaluate(() => testSaveWrites), aWrites, 'External synchronization must not write back or echo');
  assert.deepEqual(await a.evaluate(() => Object.fromEntries(Object.entries(CompanionStore.state().profiles).map(([id, p]) => [id, p.tasks.length]))), { qiyu: 0, xinghui: 0 });
  console.log('✓ remote character selection aligns name, image, selected tab, and closes the stale dialog without writes');

  await b.locator('.nav-item[data-view="tasks"]').click();
  await a.locator('[data-action="addTask"]').click();
  await a.locator('#taskTitle').fill('沈星回的文献核对');
  await a.locator('#taskCategory').selectOption('学习');
  await a.locator('#taskSteps').fill('读方法\n核对图表');
  await a.locator('#taskForm button[type="submit"]').click();
  await b.waitForFunction(() => document.querySelector('.task-card h3')?.textContent === '沈星回的文献核对');
  await a.locator('.nav-item[data-view="tasks"]').click();
  await a.locator('[data-task-focus]').click();
  await a.locator('#focusStart').click();
  await b.waitForFunction(() => CompanionStore.profile('xinghui').timer !== null);
  const xinghuiTimer = await a.evaluate(() => CompanionStore.profile('xinghui').timer);
  assert.equal(xinghuiTimer.category, '学习');
  assert.deepEqual(await b.evaluate(() => CompanionStore.profile('xinghui').timer), xinghuiTimer);
  assert.equal(await b.locator('#focusTask').inputValue(), '沈星回的文献核对');
  assert.equal(await b.locator('#focusTask').isDisabled(), true);
  assert.equal(await a.evaluate(() => CompanionStore.profile('qiyu').timer), null);
  assert.equal(await a.evaluate(() => CompanionStore.profile('qiyu').tasks.length), 0);

  await b.locator('.nav-item[data-view="home"]').click();
  await b.locator('#focusStart').click();
  await a.waitForFunction(() => CompanionStore.profile('xinghui').timer?.paused === true);
  assert.match(await a.locator('#focusStart').textContent(), /回来/);
  console.log('✓ remote tasks render immediately; the visible character owns the task/timer and pause synchronizes');

  await b.locator('[data-profile="qiyu"]').click();
  await aligned(a, 'qiyu', '祁煜');
  assert.equal(await a.locator('#focusTask').inputValue(), '');
  await a.locator('#focusTask').fill('祁煜的段落初稿');
  await a.locator('[data-category="写作"]').click();
  await a.locator('[data-duration="15"]').click();
  await a.locator('#focusStart').click();
  await b.waitForFunction(() => CompanionStore.profile('qiyu').timer !== null);
  await aligned(b, 'qiyu', '祁煜');
  assert.equal(await b.locator('#focusTask').inputValue(), '祁煜的段落初稿');
  const state = await b.evaluate(() => CompanionStore.state());
  assert.equal(state.profiles.qiyu.timer.durationMs, 15 * 60000);
  assert.equal(state.profiles.qiyu.timer.category, '写作');
  assert.deepEqual(state.profiles.qiyu.tasks.map(task => task.title), ['祁煜的段落初稿']);
  assert.deepEqual(state.profiles.xinghui.tasks.map(task => task.title), ['沈星回的文献核对']);
  assert.equal(state.profiles.xinghui.timer.id, xinghuiTimer.id);
  assert.equal(state.profiles.xinghui.timer.paused, true);
  assert.deepEqual(errors, []);
  assert.ok(blocked.every(url => /^https:\/\/(www\.gstatic\.com\/firebasejs|cdnjs\.cloudflare\.com\/ajax\/libs\/firebase)\/10\.12\.2\/firebase-/.test(url)), 'Only the optional Firebase SDK may be requested; all such requests remain blocked');
  console.log('PASS: both directions retain independent character progress; no page errors or external HTTP/WebSocket access.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});
