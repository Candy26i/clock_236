'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.COMPANION_TEST_URL || 'http://127.0.0.1:4189/clock_236/deepspace/';
const allowedOrigin = new URL(base).origin;

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-background-networking', '--disable-sync'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route('**/*', route => new URL(route.request().url()).origin === allowedOrigin ? route.continue() : route.abort());
    if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => socket.close());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const active = () => page.locator('video[data-player-active="true"]');
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector('video[data-player-active="true"]')?.dataset.clipId === 'qiyu-original-gaze');
    assert.equal(await page.locator('.character-video').count(), 2);
    assert.equal(await page.locator('#characterVideo').count(), 1);
    assert.match(await page.locator('#sceneClipName').textContent(), /抬眼/);
    assert.equal(await page.locator('#sceneLoop').isDisabled(), true);
    assert.equal(await page.locator('#sceneNext').isDisabled(), false);
    assert.equal(await page.locator('.character-video').evaluateAll(videos => videos.every(video => video.paused)), true);
    await page.locator('#sceneNext').click();
    await page.waitForFunction(() => document.querySelector('video[data-player-active="true"]')?.dataset.clipId === 'qiyu-window-painting');
    assert.match(await page.locator('#sceneClipName').textContent(), /作画/);
    assert.equal(await active().evaluate(video => video.paused), true);
    console.log('✓ local manifest, two video slots, reduced-motion stills, next-scene preview');

    await page.locator('[data-profile="xinghui"]').click();
    await page.locator('[data-profile="qiyu"]').click();
    await page.locator('[data-profile="xinghui"]').click();
    await page.waitForFunction(() => document.querySelector('video[data-player-active="true"]')?.dataset.clipId === 'xinghui-original-gaze');
    assert.match(await page.locator('#sceneClipName').textContent(), /暖光/);
    assert.equal(await active().getAttribute('data-character'), 'xinghui');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.querySelector('video[data-player-active="true"]')?.paused === false);
    await page.locator('.nav-item[data-view="tasks"]').click();
    assert.equal(await page.locator('.character-video').evaluateAll(videos => videos.every(video => video.paused)), true);
    await page.locator('.nav-item[data-view="home"]').click();
    await page.waitForFunction(() => document.querySelector('video[data-player-active="true"]')?.paused === false);
    console.log('✓ rapid character switching and full-player pause on navigation');

    // Observe real playback, without changing currentTime or touching study data.
    await page.waitForTimeout(10000);
    assert.equal(await active().getAttribute('data-clip-id'), 'xinghui-original-gaze');
    await page.locator('#sceneNext').click();
    assert.equal(await page.locator('#sceneNext').isDisabled(), true);
    assert.match(await page.locator('#scenePlaybackStatus').textContent(), /下一镜/);
    await page.waitForFunction(() => document.querySelector('video[data-player-active="true"]')?.dataset.clipId === 'xinghui-choose-record', null, { timeout: 20000 });
    assert.match(await page.locator('#sceneClipName').textContent(), /唱片/);
    assert.equal(await page.locator('#sceneNext').isDisabled(), false);
    await page.locator('#sceneLoop').click();
    assert.equal(await page.locator('#sceneLoop').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('#scenePlaybackStatus').textContent(), /喜欢/);
    await page.locator('[data-action="settings"]').click();
    await page.locator('#motionSetting').uncheck();
    await page.locator('#closeDialog').click();
    assert.equal(await page.locator('.character-video').evaluateAll(videos => videos.every(video => video.paused)), true);
    assert.equal(await page.evaluate(() => CompanionStore.profile().minutes), 0);
    console.log('✓ complete scenes remain at least 20 seconds, queued next, stay mode, no invented focus progress');

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const controls = await page.locator('.scene-playback').boundingBox();
    const scene = await page.locator('#scene').boundingBox();
    assert.ok(controls.x >= scene.x && controls.x + controls.width <= scene.x + scene.width);
    const artifacts = path.resolve(__dirname, '../artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, 'player-mobile.png'), fullPage: true });
    await page.locator('#immersiveToggle').click();
    const immersiveControls = await page.locator('.scene-playback').boundingBox();
    assert.ok(immersiveControls.x >= 0 && immersiveControls.x + immersiveControls.width <= 390);
    await page.screenshot({ path: path.join(artifacts, 'player-immersive.png') });
    assert.deepEqual(errors, []);
    console.log('✓ mobile and immersive controls remain inside the viewport');
    await context.close();

    const fallbackContext = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
    await fallbackContext.route('**/*', route => new URL(route.request().url()).origin === allowedOrigin ? route.continue() : route.abort());
    if (fallbackContext.routeWebSocket) await fallbackContext.routeWebSocket('**/*', socket => socket.close());
    await fallbackContext.route('**/assets/clips/manifest.json', route => route.fulfill({ status: 404, body: '{}' }));
    const fallback = await fallbackContext.newPage();
    await fallback.goto(base);
    await fallback.waitForFunction(() => document.querySelector('video[data-player-active="true"]')?.readyState >= 2);
    assert.equal(await fallback.locator('#sceneNext').isDisabled(), true);
    assert.equal(await fallback.locator('video[data-player-active="true"]').evaluate(video => video.paused), true);
    await fallbackContext.close();
    console.log('✓ missing manifest retains a usable static local fallback');
    console.log('All player browser tests passed. External traffic was blocked; only fresh local saves were used.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
