'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.COMPANION_TEST_URL || 'http://127.0.0.1:4189/clock_236/deepspace/';
const allowedOrigin = new URL(base).origin;
const fixture = {
  qiyu: [
    { id: 'qiyu-original-gaze', label: '抬眼 · 轻轻眨眼', src: 'assets/clips/qiyu-original-gaze.mp4', dwellSeconds: 7 },
    { id: 'qiyu-brush-pause', label: '提笔 · 片刻思索', src: 'assets/clips/qiyu-brush-pause.mp4', dwellSeconds: 7 }
  ],
  xinghui: [
    { id: 'xinghui-original-gaze', label: '暖光 · 看向你', src: 'assets/clips/xinghui-original-gaze.mp4', dwellSeconds: 7 },
    { id: 'xinghui-choose-record', label: '日常 · 挑选唱片', src: 'assets/clips/xinghui-choose-record.mp4', dwellSeconds: 7 }
  ]
};

async function isolatedContext(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block', ...options });
  await context.route('**/*', route => new URL(route.request().url()).origin === allowedOrigin ? route.continue() : route.abort());
  if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(() => {
    let Player;
    Object.defineProperty(window, 'CompanionScenePlayer', {
      configurable: true,
      get: () => Player,
      set: Original => { Player = class extends Original { constructor(options) { super(options); window.__player = this; } }; }
    });
    window.__seams = { visibleSeeks: [], samples: [], commits: [], lastActive: null };
    document.addEventListener('seeking', event => {
      const video = event.target;
      if (video.tagName === 'VIDEO' && video.dataset.playerActive === 'true' && Number(getComputedStyle(video).opacity) > 0.9) {
        window.__seams.visibleSeeks.push({ clip: video.dataset.clipId, time: video.currentTime });
      }
    }, true);
    const observe = () => {
      const active = document.querySelector('video[data-player-active="true"]');
      const incoming = document.querySelector('video[data-player-transition="true"]');
      const log = window.__seams;
      if (active && active !== log.lastActive) {
        log.commits.push({ clip: active.dataset.clipId, time: active.currentTime, watched: window.__player?.getCurrent().watchedSeconds || 0 });
        log.lastActive = active;
      }
      if (active && incoming) {
        const opacity = Number(getComputedStyle(incoming).opacity);
        if (opacity > 0.08 && opacity < 0.92) log.samples.push({ oldTime: active.currentTime, oldOpacity: Number(getComputedStyle(active).opacity), oldPaused: active.paused, incomingPaused: incoming.paused, incomingReady: incoming.readyState, incomingSeeking: incoming.seeking });
      }
      requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  });
  return context;
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-background-networking', '--disable-sync'] });
  try {
    const context = await isolatedContext(browser);
    await context.route('**/assets/clips/manifest.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const active = () => page.locator('video[data-player-active="true"]');
    const currentIs = id => page.waitForFunction(value => document.querySelector('video[data-player-active="true"]')?.dataset.clipId === value, id);
    await page.goto(base);
    await currentIs('qiyu-original-gaze');
    assert.equal(await page.locator('.character-video').count(), 2);
    assert.equal(await page.locator('#characterVideo').count(), 1);
    assert.match(await page.locator('#sceneClipName').textContent(), /抬眼/);
    assert.equal(await page.locator('#sceneLoop').isDisabled(), true);
    assert.equal(await page.locator('#sceneNext').isDisabled(), false);
    assert.equal(await page.locator('.character-video').evaluateAll(videos => videos.every(video => video.paused)), true);
    await page.locator('#sceneNext').click();
    await currentIs('qiyu-brush-pause');
    assert.match(await page.locator('#sceneClipName').textContent(), /提笔/);
    assert.equal(await active().evaluate(video => video.paused), true);
    console.log('✓ local manifest, two slots, reduced-motion still previews, no autoplay');

    await page.locator('[data-profile="xinghui"]').click();
    await page.locator('[data-profile="qiyu"]').click();
    await page.locator('[data-profile="xinghui"]').click();
    await currentIs('xinghui-original-gaze');
    assert.equal(await active().getAttribute('data-character'), 'xinghui');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => window.__player?.getCurrent().state === 'playing');
    await page.locator('.nav-item[data-view="tasks"]').click();
    assert.equal(await page.locator('.character-video').evaluateAll(videos => videos.every(video => video.paused)), true);
    const watchedAtPause = await page.evaluate(() => __player.getCurrent().watchedSeconds);
    await page.waitForTimeout(350);
    assert.ok(Math.abs(await page.evaluate(() => __player.getCurrent().watchedSeconds) - watchedAtPause) < 0.03);
    await page.locator('.nav-item[data-view="home"]').click();
    await page.waitForFunction(() => window.__player?.getCurrent().state === 'playing');
    console.log('✓ rapid character changes; navigation pauses both slots and watch accounting');

    // A late manifest refresh retains the element, token and playing timeline.
    const preservation = await page.evaluate(() => {
      const player = __player, slot = player._active, time = slot.video.currentTime, token = slot.token;
      player.updateClips(player.clips.map(clip => ({ ...clip, label: clip.label + ' ' })));
      return { element: slot === player._active, token: token === slot.token, delta: Math.abs(slot.video.currentTime - time), paused: slot.video.paused };
    });
    assert.deepEqual({ element: preservation.element, token: preservation.token, paused: preservation.paused }, { element: true, token: true, paused: false });
    assert.ok(preservation.delta < 0.1);

    // A same-source pass really hands over to the other slot, while preserving
    // the cumulative dwell clock and keeping the outgoing picture moving.
    await page.evaluate(() => { __player.setMode('loop'); __seams.samples = []; __seams.commits = []; });
    await page.waitForFunction(() => __seams.commits.filter(item => item.clip === 'xinghui-original-gaze').length >= 2, null, { timeout: 12000 });
    const seams = await page.evaluate(() => ({ samples: __seams.samples, commits: __seams.commits, visibleSeeks: __seams.visibleSeeks, watched: __player.getCurrent().watchedSeconds }));
    assert.ok(seams.samples.length > 8, 'observe a real crossfade');
    assert.ok(seams.samples.every(sample => sample.oldOpacity === 1 && !sample.oldPaused && !sample.incomingPaused && sample.incomingReady >= 2 && !sample.incomingSeeking), 'both videos move and old video stays opaque during fade');
    assert.ok(seams.samples.some((sample, index, list) => index > 0 && sample.oldTime > list[index - 1].oldTime + 0.005), 'outgoing time advances during overlap');
    assert.deepEqual(seams.visibleSeeks, [], 'never rewind a visible slot');
    assert.ok(seams.watched > 4, 'same-clip loops do not reset watched time');
    assert.equal(await active().getAttribute('data-clip-id'), 'xinghui-original-gaze');
    console.log('✓ decoded-frame crossfades, moving opaque outgoing frames, invisible seeks, continuous dwell');

    // Manual next does not wait for the automatic dwell: the next seam suffices,
    // even in stay mode. No fake currentTime or artificial study progress.
    const nextAt = Date.now();
    await page.locator('#sceneNext').click();
    assert.equal(await page.locator('#sceneNext').isDisabled(), true);
    await currentIs('xinghui-choose-record');
    assert.ok(Date.now() - nextAt < 6000, 'next switches at the next short-clip boundary');
    assert.equal(await page.locator('#sceneNext').isDisabled(), false);
    assert.equal(await page.locator('#sceneLoop').getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(8500);
    assert.equal(await active().getAttribute('data-clip-id'), 'xinghui-choose-record', 'stay mode survives repeated loops beyond dwell');
    await page.locator('#sceneLoop').click();
    await currentIs('xinghui-original-gaze');
    console.log('✓ manual next at the next loop, stay beyond dwell, automatic rotation resumes');

    // Pause in the middle of an actual fade; neither slot may later resume from
    // a stale play promise or fade timer. Paused next is an immediate still.
    await page.waitForFunction(() => !!document.querySelector('video[data-player-transition="true"]'), null, { timeout: 6000 });
    await page.evaluate(() => __player.pause());
    const stopped = await page.evaluate(() => ({ watched: __player.getCurrent().watchedSeconds, activeIndex: Array.from(document.querySelectorAll('.character-video')).indexOf(__player._active.video), times: Array.from(document.querySelectorAll('.character-video'), video => video.currentTime) }));
    await page.waitForTimeout(650);
    const paused = await page.evaluate(() => ({ watched: __player.getCurrent().watchedSeconds, paused: Array.from(document.querySelectorAll('.character-video'), video => video.paused), times: Array.from(document.querySelectorAll('.character-video'), video => video.currentTime) }));
    assert.ok(paused.paused.every(Boolean));
    assert.ok(Math.abs(paused.watched - stopped.watched) < 0.03);
    assert.ok(Math.abs(paused.times[stopped.activeIndex] - stopped.times[stopped.activeIndex]) < 0.03);
    await page.evaluate(() => __player.next());
    await currentIs('xinghui-choose-record');
    assert.equal(await page.locator('.character-video').evaluateAll(videos => videos.every(video => video.paused)), true);
    assert.equal(await page.evaluate(() => CompanionStore.profile().minutes), 0);
    console.log('✓ pause during fade, paused next, stale callback protection, no invented study progress');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => __player.play());
    await page.waitForFunction(() => !!__player._transitioning && __player._slots.every(slot => !slot.video.paused), null, { timeout: 6000 });
    const mobileMask = await page.evaluate(() => {
      const film = document.querySelector('.character-film');
      const videos = Array.from(document.querySelectorAll('.character-video'));
      return { wrappers: document.querySelectorAll('.character-film').length, sharedParent: videos.every(video => video.parentElement === film), mask: getComputedStyle(film).maskImage, individualMasks: videos.map(video => getComputedStyle(video).maskImage), bothPlaying: videos.every(video => !video.paused) };
    });
    assert.equal(mobileMask.wrappers, 1);
    assert.equal(mobileMask.sharedParent, true);
    assert.notEqual(mobileMask.mask, 'none');
    assert.deepEqual(mobileMask.individualMasks, ['none', 'none']);
    assert.equal(mobileMask.bothPlaying, true);
    console.log('✓ mobile crossfade uses one shared wrapper mask while both videos play');
    await page.locator('[data-action="settings"]').click();
    await page.locator('#motionSetting').uncheck();
    await page.locator('#closeDialog').click();
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

    const fallbackContext = await isolatedContext(browser, { reducedMotion: 'no-preference' });
    await fallbackContext.route('**/assets/clips/manifest.json*', route => route.fulfill({ status: 404, body: '{}' }));
    const fallback = await fallbackContext.newPage();
    await fallback.goto(base);
    await fallback.waitForFunction(() => __player?.getCurrent().state === 'playing');
    assert.equal(await fallback.locator('#sceneNext').isDisabled(), true);
    assert.equal(await fallback.evaluate(() => __player.clips[0].dwellSeconds), 54);
    // Cover the requestVideoFrameCallback-free path and loop trimming/rate.
    await fallback.evaluate(() => {
      __player.pause();
      document.querySelectorAll('.character-video').forEach(video => { video.requestVideoFrameCallback = undefined; });
      const clip = { ...__player.clips[0], seamless: false, loopStart: 0.3, loopEnd: 2.5, playbackRate: 0.8, transitionSeconds: 0.3 };
      __player.setCharacter('qiyu', [clip]);
      __player.play();
      __seams.commits = [];
      __seams.visibleSeeks = [];
    });
    await fallback.waitForFunction(() => __seams.commits.length >= 3, null, { timeout: 10000 });
    const single = await fallback.evaluate(() => ({ seeks: __seams.visibleSeeks, samples: __seams.samples.length, watched: __player.getCurrent().watchedSeconds, count: document.querySelectorAll('.character-video').length }));
    assert.deepEqual(single.seeks, []);
    assert.ok(single.watched > 3);
    assert.equal(single.count, 2);
    await fallback.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await fallback.waitForTimeout(200);
    assert.equal(await fallback.locator('.character-video').evaluateAll(videos => videos.every(video => video.paused)), true);
    await fallback.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await fallback.waitForFunction(() => __player.getCurrent().state === 'playing');
    await fallback.emulateMedia({ reducedMotion: 'reduce' });
    await fallback.waitForFunction(() => __player.getCurrent().reducedMotion);
    assert.equal(await fallback.locator('.character-video').evaluateAll(videos => videos.every(video => video.paused)), true);
    const destroy = await fallback.evaluate(() => { __player.destroy(); return { state: __player.getCurrent().state, count: document.querySelectorAll('.character-video').length, paused: document.querySelector('#characterVideo').paused }; });
    assert.deepEqual(destroy, { state: 'destroyed', count: 1, paused: true });
    await fallbackContext.close();
    console.log('✓ single-clip fallback, trimmed/rate-adjusted loops without rVFC, visibility/reduced-motion pause, destroy');

    const failureContext = await isolatedContext(browser, { reducedMotion: 'no-preference' });
    let brokenRequests = 0;
    await failureContext.route('**/assets/clips/missing-test.mp4', route => { brokenRequests += 1; return route.fulfill({ status: 404, body: '' }); });
    const brokenClip = { id: 'missing', src: 'assets/clips/missing-test.mp4' };
    await failureContext.route('**/assets/clips/manifest.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ qiyu: [brokenClip, ...fixture.qiyu], xinghui: fixture.xinghui }) }));
    const failure = await failureContext.newPage();
    await failure.goto(base);
    await failure.waitForFunction(() => __player?.clips.length === 3);
    await failure.evaluate(() => __player.setCharacter('qiyu', __player.clips));
    await failure.waitForFunction(() => __player?.getCurrent().state === 'playing' && __player.getCurrent().clip.id === 'qiyu-original-gaze');
    await failure.waitForFunction(() => __player._slots.find(slot => slot !== __player._active)?.ready);
    const failedLoadCount = brokenRequests;
    assert.ok(failedLoadCount >= 1 && failedLoadCount <= 2, 'one failed request per explicit character load');
    // Simulate a decoder error on the duplicate hidden copy while its matching
    // visible copy still plays. The failed source must never win re-preloading.
    await failure.evaluate(() => {
      const spare = __player._slots.find(slot => slot !== __player._active);
      spare.video.dispatchEvent(new Event('error'));
      __seams.commits = [];
    });
    await failure.waitForFunction(() => __player.getCurrent().clip.id === 'qiyu-brush-pause' && __player.getCurrent().state === 'playing', null, { timeout: 6000 });
    await failure.waitForFunction(() => __seams.commits.filter(item => item.clip === 'qiyu-brush-pause').length >= 2, null, { timeout: 7000 });
    assert.equal(brokenRequests, failedLoadCount, 'failed files are not retried every frame');
    assert.equal(await failure.evaluate(() => __player._failed.size), 2);

    // Reproduce an outgoing decoder failure before an incoming play() promise
    // settles. Releasing that old promise must never resurrect the failed clip.
    await failure.evaluate(clips => __player.setCharacter('qiyu', clips), fixture.qiyu);
    await failure.waitForFunction(() => __player._active && __player._slots.every(slot => slot.ready));
    const recovery = await failure.evaluate(async () => {
      const player = __player;
      const incoming = player._slots.find(slot => slot !== player._active);
      const originalPlay = incoming.video.play;
      let release;
      incoming.video.play = function () {
        const native = originalPlay.call(this);
        return new Promise(resolve => { release = () => Promise.resolve(native).then(resolve); });
      };
      player._handoff();
      await new Promise(resolve => setTimeout(resolve, 70));
      const outgoing = player._active;
      outgoing.video.dispatchEvent(new Event('error'));
      const cancelled = player._warming === null && incoming.video.paused;
      incoming.video.play = originalPlay;
      await new Promise(resolve => setTimeout(resolve, 400));
      const before = player.getCurrent().clip.id;
      release();
      await new Promise(resolve => setTimeout(resolve, 850));
      return { cancelled, before, after: player.getCurrent().clip.id, state: player.getCurrent().state, paused: player._active.video.paused, warming: !!player._warming };
    });
    assert.deepEqual(recovery, { cancelled: true, before: 'qiyu-brush-pause', after: 'qiyu-brush-pause', state: 'playing', paused: false, warming: false });
    console.log('✓ outgoing failure cancels pending handoff; late play fulfillment cannot revive stale media');
    await failure.evaluate(clip => __player.setCharacter('qiyu', [clip]), brokenClip);
    await failure.waitForFunction(() => __player.getCurrent().state === 'unavailable');
    assert.equal(await failure.locator('.character-video').evaluateAll(videos => videos.every(video => video.paused)), true);
    await failureContext.close();
    console.log('✓ broken media skips once, hidden-copy decoder failure rotates safely, all-broken still fallback');
    console.log('All player browser tests passed. External HTTP/WebSockets were blocked; fresh local saves only.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
