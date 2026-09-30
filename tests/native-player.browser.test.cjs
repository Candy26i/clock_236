'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.COMPANION_TEST_URL || 'http://127.0.0.1:4189/clock_236/deepspace/';
const allowedOrigin = 'http://127.0.0.1:4189';
assert.equal(new URL(base).origin, allowedOrigin, 'This test only runs against the isolated local preview.');

async function isolatedContext(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference', serviceWorkers: 'block'
  });
  await context.route('**/*', route => new URL(route.request().url()).origin === allowedOrigin ? route.continue() : route.abort());
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(() => {
    let Player;
    Object.defineProperty(window, 'CompanionScenePlayer', {
      configurable: true,
      get: () => Player,
      set: Original => { Player = class extends Original { constructor(options) { super(options); window.__player = this; } }; }
    });
  });
  return context;
}

async function waitForNative(page, character) {
  await page.waitForFunction(id => {
    const player = window.__player;
    const current = player?.getCurrent();
    return current?.character === id && current.clip?.id === `${id}-official-companion` &&
      current.clip.seamless === true && current.state === 'playing' && player._active?.video.loop &&
      player._active.video.readyState >= 2 && !player._active.video.paused;
  }, character);
}

async function observeWholeLoop(page, character) {
  await waitForNative(page, character);
  assert.equal(await page.evaluate(() => __player.getCurrent().mode), 'loop', 'native companionship starts in stay mode');

  // A late manifest refresh must retain the decoded video and its timeline.
  // Lowering dwell proves that even auto mode cannot rotate native footage.
  const refresh = await page.evaluate(() => {
    const player = __player, slot = player._active, token = slot.token, time = slot.video.currentTime;
    let loads = 0;
    slot.video.addEventListener('loadstart', () => { loads += 1; });
    player.updateClips(player.clips.map(clip => ({ ...clip, dwellSeconds: 1 })));
    player.setMode('auto');
    window.__nativeRefreshLoads = () => loads;
    return { sameSlot: player._active === slot, sameToken: slot.token === token, delta: Math.abs(slot.video.currentTime - time), paused: slot.video.paused };
  });
  assert.equal(refresh.sameSlot, true);
  assert.equal(refresh.sameToken, true);
  assert.equal(refresh.paused, false);
  assert.ok(refresh.delta < 0.1, 'manifest refresh does not rewind the native video');

  const duration = await page.evaluate(() => {
    const player = __player, video = player._active.video;
    const canvas = document.createElement('canvas');
    canvas.width = 96; canvas.height = 54;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const probe = window.__nativeProbe = {
      running: true, video, frames: 0, wraps: 0, lastMedia: null, lastWall: null,
      maxGap: 0, maxGapAtMedia: null, loopGap: 0, slotChanges: 0, transitions: 0, opacityChanges: 0,
      emptyFrames: 0, decodedSamples: 0, watchedDrops: 0,
      startWatched: player.getCurrent().watchedSeconds, lastWatched: player.getCurrent().watchedSeconds,
      afterWrapTime: null, callback: null
    };
    const frame = (now, metadata) => {
      if (!probe.running) return;
      const gap = probe.lastWall === null ? 0 : now - probe.lastWall;
      const wrapped = probe.lastMedia !== null && metadata.mediaTime < probe.lastMedia - video.duration / 2;
      if (gap > probe.maxGap) { probe.maxGap = gap; probe.maxGapAtMedia = metadata.mediaTime; }
      if (wrapped) { probe.wraps += 1; probe.loopGap = Math.max(probe.loopGap, gap); }
      if (probe.wraps && metadata.mediaTime > 0.3) probe.afterWrapTime = metadata.mediaTime;
      if (player._active?.video !== video) probe.slotChanges += 1;
      if (document.querySelector('video[data-player-transition="true"]')) probe.transitions += 1;
      if (Math.abs(Number(getComputedStyle(video).opacity) - 1) > 0.001) probe.opacityChanges += 1;
      const watched = player.getCurrent().watchedSeconds;
      if (watched < probe.lastWatched - 0.05) probe.watchedDrops += 1;
      probe.lastWatched = watched;
      // Sample decoded images, including both sides of the natural wrap. A
      // readyState assertion alone would miss a black/blank decoded frame.
      if (probe.frames % 30 === 0 || wrapped || (probe.wraps && metadata.mediaTime < 0.4)) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let sum = 0, squares = 0;
        for (let i = 0; i < data.length; i += 4) {
          const value = (data[i] + data[i + 1] + data[i + 2]) / 3;
          sum += value; squares += value * value;
        }
        const count = data.length / 4, mean = sum / count, variance = squares / count - mean * mean;
        if (mean < 5 || variance < 5) probe.emptyFrames += 1;
        probe.decodedSamples += 1;
      }
      probe.frames += 1; probe.lastMedia = metadata.mediaTime; probe.lastWall = now;
      probe.callback = video.requestVideoFrameCallback(frame);
    };
    probe.callback = video.requestVideoFrameCallback(frame);
    return video.duration;
  });
  assert.ok(duration > 20, 'the source is a complete native companionship scene');
  // Real elapsed playback only: never seek or accelerate the video to pass.
  await page.waitForFunction(() => __nativeProbe.wraps >= 1 && __nativeProbe.afterWrapTime !== null, null, { timeout: Math.ceil((duration + 12) * 1000) });
  const result = await page.evaluate(() => {
    const probe = __nativeProbe;
    probe.running = false;
    probe.video.cancelVideoFrameCallback(probe.callback);
    const { video, callback, ...numbers } = probe;
    return { ...numbers, clip: __player.getCurrent().clip.id, watched: __player.getCurrent().watchedSeconds,
      currentTime: video.currentTime, playing: !video.paused, nativeLoop: video.loop,
      refreshLoads: __nativeRefreshLoads(), localMinutes: CompanionStore.profile().minutes };
  });
  console.log(`${character} native metrics: ${JSON.stringify({ frames: result.frames, wraps: result.wraps, duration, maxGap: result.maxGap, maxGapAtMedia: result.maxGapAtMedia, loopGap: result.loopGap, watched: result.watched })}`);
  assert.equal(result.clip, `${character}-official-companion`);
  assert.equal(result.nativeLoop, true);
  assert.equal(result.playing, true);
  assert.equal(result.slotChanges, 0, 'the native loop retains the same DOM video slot');
  assert.equal(result.transitions, 0, 'native looping never starts the crossfade path');
  assert.equal(result.opacityChanges, 0, 'native video remains fully visible');
  assert.equal(result.emptyFrames, 0, 'decoded frames remain nonblank through the seam');
  assert.equal(result.watchedDrops, 0, 'watch accounting remains monotonic across the native rewind');
  assert.equal(result.refreshLoads, 0, 'manifest refresh does not reload active media');
  assert.equal(result.localMinutes, 0, 'watching media never creates study minutes');
  assert.ok(result.frames > duration * 12, `actual frames continue throughout the scene (${result.frames})`);
  assert.ok(result.decodedSamples > 10);
  assert.ok(result.maxGap < 750, `no large presentation stalls: ${result.maxGap.toFixed(1)} ms`);
  assert.ok(result.loopGap < 500, `natural seam continues promptly: ${result.loopGap.toFixed(1)} ms`);
  assert.ok(result.watched >= duration - 0.8, `watched time accumulates across native looping (${result.watched})`);
  console.log(`✓ ${character}: real ${duration.toFixed(3)} s loop, same slot, no fade/blank; seam ${result.loopGap.toFixed(1)} ms, maximum frame gap ${result.maxGap.toFixed(1)} ms`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-background-networking', '--disable-sync'] });
  const contexts = [];
  try {
    const errors = [];
    const runs = await Promise.all(['qiyu', 'xinghui'].map(async character => {
      const context = await isolatedContext(browser);
      contexts.push(context);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(`${character}: ${error.message}`));
      await page.goto(base);
      if (character !== 'qiyu') await page.locator(`[data-profile="${character}"]`).click();
      await observeWholeLoop(page, character);
      return { character, page, context };
    }));

    const page = runs.find(run => run.character === 'qiyu').page;
    await page.locator('[data-profile="xinghui"]').click();
    await page.locator('[data-profile="qiyu"]').click();
    await page.locator('[data-profile="xinghui"]').click();
    await waitForNative(page, 'xinghui');
    assert.equal(await page.locator('video[data-player-active="true"]').getAttribute('data-character'), 'xinghui');
    assert.equal(await page.locator('video[data-player-transition="true"]').count(), 0);

    await page.locator('.nav-item[data-view="tasks"]').click();
    const stopped = await page.evaluate(() => ({ time: __player._active.video.currentTime, watched: __player.getCurrent().watchedSeconds }));
    await page.waitForTimeout(500);
    const paused = await page.evaluate(() => ({ time: __player._active.video.currentTime, watched: __player.getCurrent().watchedSeconds, allPaused: Array.from(document.querySelectorAll('.character-video')).every(video => video.paused) }));
    assert.equal(paused.allPaused, true);
    assert.ok(Math.abs(paused.time - stopped.time) < 0.05);
    assert.ok(Math.abs(paused.watched - stopped.watched) < 0.05);
    await page.locator('.nav-item[data-view="home"]').click();
    await waitForNative(page, 'xinghui');
    await page.waitForFunction(time => __player._active.video.currentTime > time + 0.2, paused.time);
    console.log('✓ rapid character changes and navigation pause/resume preserve correct native playback');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => __player.getCurrent().reducedMotion && Array.from(document.querySelectorAll('.character-video')).every(video => video.paused));
    const reducedAt = await page.evaluate(() => __player._active.video.currentTime);
    await page.waitForTimeout(400);
    assert.ok(Math.abs(await page.evaluate(() => __player._active.video.currentTime) - reducedAt) < 0.05);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await waitForNative(page, 'xinghui');

    const nextAt = Date.now();
    await page.locator('#sceneNext').click();
    await page.waitForFunction(() => {
      const info = __player.getCurrent();
      return info.character === 'xinghui' && info.clip && !info.clip.seamless && info.state === 'playing';
    }, null, { timeout: 3000 });
    assert.ok(Date.now() - nextAt < 3000, 'explicit next does not wait for the 26-second native loop to finish');
    assert.equal(await page.evaluate(() => __player._active.video.loop), false, 'retained PVs do not inherit native loop mode');
    assert.equal(await page.locator('#sceneLoop').isDisabled(), false, 'retained PV offers a way back to complete companionship');
    await page.locator('#sceneLoop').click();
    await waitForNative(page, 'xinghui');
    assert.equal(await page.locator('#sceneLoop').isDisabled(), true, 'complete native companionship stays in continuous mode');
    assert.equal(await page.evaluate(() => CompanionStore.profile().minutes), 0);
    assert.deepEqual(errors, []);
    console.log('✓ reduced motion stops/resumes native media; explicit next opens a PV with loop=false; return-to-companionship restores native looping');
    console.log('All native player checks passed. Both complete loops used real-time decoding; external HTTP/WebSockets were blocked and no study sessions were created.');
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
