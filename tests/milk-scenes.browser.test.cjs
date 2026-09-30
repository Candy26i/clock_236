'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

// Intentionally local-only: the legacy page writes through its data adapter.
// Fresh contexts + a blocked Firebase SDK force that adapter into demo mode.
const origin = 'http://127.0.0.1:4189';
const base = process.env.MILK_SCENES_TEST_URL || `${origin}/clock_236/`;
assert.equal(new URL(base).origin, origin, 'Never run the milk-scene fixtures against the live Firebase-backed site.');
const artifacts = path.resolve(__dirname, '../artifacts/milk-scenes-v66');
const requestedModes = process.env.MILK_SCENE_MODES?.split(',').map(value => value.trim()).filter(Boolean);
const capture = process.env.MILK_SCENE_CAPTURE !== '0';
const viewports = [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 }
];

function point(value) {
  return Array.isArray(value) ? { x: Number(value[0]), y: Number(value[1]) } : { x: Number(value.x), y: Number(value.y) };
}

function nearSegment(p, a, b, tolerance = 2) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) <= tolerance;
}

function onSurface(value, polygon) {
  const p = point(value), vertices = polygon.map(point);
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[j], b = vertices[i];
    if (nearSegment(p, a, b)) return true;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

async function demoContext(browser) {
  const context = await browser.newContext({ viewport: { width: viewports[0].width, height: viewports[0].height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.routeWebSocket('**/*', socket => socket.close());
  return context;
}

async function initializeFixture(page) {
  await page.goto(base);
  await page.waitForFunction(() => typeof DB !== 'undefined' && DB.demo === true && document.querySelector('#petScene'));
  await page.waitForFunction(() => window.MilkSceneLayout?.refresh && window.MilkSceneLayout?.snapshot);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
  return page.evaluate(() => {
    if (!DB.demo) throw Error('Demo adapter required before seeding any fixture.');
    const originalScene = petSceneOf;
    window.__milkVariant = null;
    petSceneOf = function (uid) {
      const scene = originalScene(uid), selection = window.__milkVariant;
      if (!selection || selection.mode !== scene.mode) return scene;
      const variant = PET_SCENE_MODES[scene.mode].variants.find(item => item.id === selection.id);
      return { ...scene, ...variant, daypart: selection.daypart, daypartLabel: sceneDaypartLabel(selection.daypart) };
    };
    // Set each timezone before constructing its day key. The two calendar dates
    // can differ, so never reuse one user's date for the other's drink/snack.
    for (const [uid, tz] of [['u1', 'America/Los_Angeles'], ['u2', 'America/New_York']]) DB.set(`users/${uid}/tz`, tz);
    for (const uid of ['u1', 'u2']) {
      const today = todayKeyFor(uid);
      DB.set(`users/${uid}/economy`, { ...economyDefault(), unlockedScenes: Object.fromEntries(Object.keys(PET_SCENE_MODES).map(mode => [mode, true])) });
      DB.set(`users/${uid}/session`, null);
      DB.set(`users/${uid}/days`, { [today]: { m: { ky: 0, xx: 0, dl: 0 }, drink: { base: 'hong', tops: ['zhenzhu'], cup: 'plastic', fill: 1 } } });
      DB.set(`users/${uid}/petLife`, { ...petLifeDefault(uid), location: 'u1', lastSnack: uid === 'u1' ? 'pudding' : 'berry', lastSnackDay: today, homeSince: Date.now(), lastAffectionAt: Date.now() });
    }
    view = 'u1';
    renderAll();
    return Object.entries(PET_SCENE_MODES).flatMap(([mode, config]) => config.variants.map((variant, index) => ({
      mode, id: variant.id, first: index === 0,
      daypart: SCENE_STATIC_DAYPART[variant.id] || (variant.id.includes('night') ? 'night' : variant.id.includes('evening') ? 'evening' : 'day')
    })));
  });
}

async function refreshLayout(page) {
  await page.evaluate(async () => {
    if (!DB.demo) throw Error('Demo adapter was replaced.');
    const stage = document.getElementById('petScene');
    window.MilkCharacters?.refresh(stage);
    await Promise.all(Array.from(stage.querySelectorAll('img')).map(image => image.decode?.().catch(() => {}) || Promise.resolve()));
    // The characters are CSS atlas sprites, so HTMLImageElement readiness alone
    // does not prove their visible background has finished decoding.
    const backgrounds = new Set(Array.from(stage.querySelectorAll('.pet-2d-sprite')).map(sprite => {
      const match = getComputedStyle(sprite).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
      return match?.[1];
    }).filter(Boolean));
    await Promise.all(Array.from(backgrounds).map(async src => { const image = new Image(); image.src = src; await image.decode(); }));
    MilkSceneLayout.refresh(stage);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function setScene(page, scene, cast = 'pair') {
  await page.evaluate(({ scene, cast }) => {
    if (!DB.demo) throw Error('Demo adapter required.');
    window.__milkVariant = scene;
    const host = cast === 'xinghui' ? 'u2' : 'u1';
    view = host;
    for (const uid of ['u1', 'u2']) {
      delete companionInteractionState[uid];
      for (const mode of Object.keys(PET_SCENE_MODES)) delete scenePosePreferences[`${uid}|${mode}`];
      DB.update(`users/${uid}/petLife`, { sceneMode: scene.mode, location: cast === 'pair' ? host : uid, lastAffectionAt: Date.now(), homeSince: Date.now() });
    }
    closeModal();
    renderPet();
  }, { scene, cast });
  await refreshLayout(page);
}

async function readScene(page) {
  return page.evaluate(() => {
    const stage = document.getElementById('petScene'), bounds = stage.getBoundingClientRect();
    const rect = element => {
      const b = element.getBoundingClientRect();
      return { x: b.x - bounds.x, y: b.y - bounds.y, width: b.width, height: b.height, right: b.right - bounds.x, bottom: b.bottom - bounds.y };
    };
    const visible = element => {
      const css = getComputedStyle(element);
      return element.getClientRects().length > 0 && css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) > 0.01;
    };
    const actors = Array.from(stage.querySelectorAll('.pet-3d-wrap')).filter(visible).map(wrapper => {
      const sprite = wrapper.querySelector('.pet-2d-sprite');
      const pseudo = getComputedStyle(wrapper, '::after');
      return {
        uid: wrapper.dataset.scene3d, posture: wrapper.dataset.posture, interaction: wrapper.dataset.interaction || null,
        sprite: sprite ? { ...rect(sprite), visible: visible(sprite), background: getComputedStyle(sprite).backgroundImage, aspect: getComputedStyle(sprite).getPropertyValue('--sprite-aspect') } : null,
        visibleOldImages: Array.from(wrapper.querySelectorAll('img.pet-3d-character')).filter(visible).map(image => image.src),
        cushion: { content: pseudo.content, display: pseudo.display, opacity: Number(pseudo.opacity), height: parseFloat(pseudo.height) || 0 }
      };
    });
    const cast = stage.querySelector('.pet-cast');
    const layer = selector => {
      const element = stage.querySelector(selector);
      return element ? { visible: visible(element), zIndex: Number(getComputedStyle(element).zIndex) || 0, clipPath: getComputedStyle(element).clipPath } : null;
    };
    return {
      demo: DB.demo, mode: stage.dataset.sceneMode, className: stage.className, width: bounds.width, height: bounds.height,
      actors, geometry: MilkSceneLayout.snapshot(stage),
      plateCount: stage.querySelectorAll('.scene-snack-item:not(.empty)').length,
      cupCount: stage.querySelectorAll('.scene-cup').length,
      oldVisibleFigures: Array.from(stage.querySelectorAll('.pet-cast img.pet-3d-character')).filter(visible).length,
      oldMeetingForeground: Array.from(stage.querySelectorAll('.meeting-foreground')).filter(visible).map(rect),
      layers: { cast: { zIndex: Number(getComputedStyle(cast).zIndex) || 0, transform: getComputedStyle(cast).transform },
        depth: layer('.scene-depth-foreground'), cafe: layer('.cafe-table-foreground'), picnic: layer('.scene-furniture-layer.is-picnic'), food: layer('.scene-snack-surface') },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      minutes: USERS.map(user => ({ uid: user.id, ky: mins(user.id, 'ky'), xx: mins(user.id, 'xx') }))
    };
  });
}

function validateScene(record, expectedActors, { surface = true } = {}) {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  check(record.demo === true, 'real database adapter is active');
  check(!record.horizontalOverflow, 'page overflows the viewport horizontally');
  check(record.actors.length === expectedActors, `expected ${expectedActors} visible actors, got ${record.actors.length}`);
  check(record.oldVisibleFigures === 0, 'legacy 3D figure remains visible');
  check(record.layers.cast.transform === 'none', 'legacy cast translation still shifts the new scene anchors');
  if (record.geometry?.foregroundPolygon?.length) {
    check(record.layers.depth?.visible && record.layers.depth.clipPath !== 'none', 'traced desk foreground is absent');
    check(record.layers.depth?.zIndex > record.layers.cast.zIndex, 'desk foreground does not occlude figures behind it');
    check(record.layers.food?.zIndex > record.layers.depth?.zIndex, 'desk foreground hides the food layer');
  }
  if (record.mode === 'meeting') check(record.oldMeetingForeground.length === 0, 'old stepped meeting-room leg mask is still visible');
  if (record.mode === 'cafe') check(record.layers.cafe?.visible && record.layers.cafe.zIndex > record.layers.cast.zIndex, 'round table does not sit in front of seated characters');
  if (record.mode === 'outdoor') check(record.layers.picnic?.zIndex < record.layers.cast.zIndex, 'picnic blanket covers the people sitting on it');
  for (const actor of record.actors) {
    check(!!actor.sprite?.visible, `${actor.uid}: no visible 2D sprite`);
    check(actor.visibleOldImages.length === 0, `${actor.uid}: legacy image visible after pose/interaction`);
    if (actor.sprite) {
      check(actor.sprite.background !== 'none', `${actor.uid}: atlas background missing`);
      check(actor.sprite.width > 25 && actor.sprite.height > 25, `${actor.uid}: sprite collapsed`);
      check(actor.sprite.y >= -2, `${actor.uid}: top of figure clipped above scene`);
    }
    if (record.mode === 'room') {
      const cushion = actor.cushion;
      check(cushion.content === 'none' || cushion.content === 'normal' || cushion.display === 'none' || cushion.opacity <= 0.01 || cushion.height <= 0,
        `${actor.uid}: old CSS cushion is still visible`);
    }
  }
  check(record.minutes.every(value => value.ky === 0 && value.xx === 0), 'visual fixture unexpectedly created study minutes');
  if (surface) {
    const geometry = record.geometry || {};
    const polygons = (geometry.surfacePolygons || []).map(polygon => Array.isArray(polygon) ? polygon : polygon.points);
    check(polygons.length > 0 && polygons.every(polygon => polygon?.length >= 3), 'missing actual tabletop/picnic surface polygon');
    check((geometry.contacts || []).length >= record.plateCount + record.cupCount, 'missing rendered food/drink contact points');
    if (polygons.length && polygons.every(polygon => polygon?.length >= 3)) {
      for (const contact of geometry.contacts || []) {
        const samples = [contact, ...(contact.samples || contact.footprint || [])];
        for (const sample of samples) {
          const p = point(sample);
          check(Number.isFinite(p.x) && Number.isFinite(p.y), `${contact.kind}: invalid contact coordinate`);
          check(p.x >= -1 && p.x <= record.width + 1 && p.y >= -1 && p.y <= record.height + 1, `${contact.kind}: serving footprint is clipped by the scene edge`);
          check(polygons.some(polygon => onSurface(p, polygon)), `${contact.kind}: contact (${p.x.toFixed(1)},${p.y.toFixed(1)}) lies outside real tabletop/picnic surface`);
        }
      }
    }
  }
  return failures;
}

async function saveCase(page, name, expectedActors, report, options) {
  const record = await readScene(page);
  const failures = validateScene(record, expectedActors, options);
  if (!name.startsWith('interaction-')) {
    const variant = name.replace(/-(?:qiyu|xinghui|pair)$/, '');
    const previous = report.cases.find(item => item.name.replace(/-(?:qiyu|xinghui|pair)$/, '') === variant);
    if (previous && Math.abs(previous.height - record.height) > 1) failures.push('scene height changed between solo and visiting states');
  }
  if (capture) await page.locator('#petScene').screenshot({ path: path.join(artifacts, `${name}.png`), animations: 'disabled' });
  report.cases.push({ name, ...record, failures });
  if (failures.length) console.log(`FAIL ${name}: ${failures.join('; ')}`);
  return record;
}

async function checkPoseMenus(page, scenes, report) {
  for (const scene of scenes.filter(item => item.first)) {
    await setScene(page, scene, 'pair');
    await page.locator('[data-open-poses]').click();
    const choices = await page.locator('[data-pose-choice]').evaluateAll(buttons => buttons.map(button => ({ uid: button.dataset.poseUid, pose: button.dataset.poseChoice })));
    for (const choice of choices) {
      await page.locator(`[data-pose-uid="${choice.uid}"][data-pose-choice="${choice.pose}"]`).click();
      await refreshLayout(page);
      const record = await readScene(page);
      const failures = validateScene(record, 2);
      report.poses.push({ mode: scene.mode, ...choice, actors: record.actors, failures });
      if (failures.length) console.log(`FAIL pose ${scene.mode}/${choice.uid}/${choice.pose}: ${failures.join('; ')}`);
    }
    await page.locator('#closePose').click();
  }
  console.log(`✓ exercised ${report.poses.length} real pose-menu selections`);
}

async function checkInteractions(page, scenes, report) {
  const scene = scenes.find(item => item.mode === 'room') || scenes[0];
  await setScene(page, scene, 'pair');
  for (const uid of ['u1', 'u2']) {
    for (const type of ['pat', 'hug', 'blank', 'note']) {
      await page.evaluate(uid => { if (!DB.demo) throw Error('Demo adapter required.'); petPlayModal(uid); }, uid);
      await page.locator(`[data-p="${type}"]`).click();
      await page.waitForFunction(({ uid, type }) => activeCompanionInteraction(uid)?.type === type, { uid, type });
      await refreshLayout(page);
      await saveCase(page, `interaction-${uid}-${type}`, 2, report);
      await page.evaluate(uid => { delete companionInteractionState[uid]; updateCompanionPoses(); }, uid);
      await refreshLayout(page);
      const restored = await readScene(page);
      report.interactions.push({ uid, type, restored: restored.actors, failures: validateScene(restored, 2) });
    }
  }
  // Normal pointer interaction also used to swap the legacy image source.
  await page.locator('#petMainSlot .pet-2d-sprite').dispatchEvent('pointerdown');
  await page.locator('#petGuestSlot .pet-2d-sprite').dispatchEvent('pointerdown');
  await refreshLayout(page);
  const poked = await readScene(page);
  report.interactions.push({ type: 'pointerdown-both', actors: poked.actors, failures: validateScene(poked, 2) });
  console.log('✓ all four interaction types and character pointer interactions retain the 2D style');
}

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const report = { startedAt: new Date().toISOString(), origin, viewports, cases: [], poses: [], interactions: [], pageErrors: [] };
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-background-networking', '--disable-sync'] });
  let context;
  try {
    context = await demoContext(browser);
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(error.message));
    const allScenes = await initializeFixture(page);
    const scenes = requestedModes ? allScenes.filter(scene => requestedModes.includes(scene.mode)) : allScenes;
    assert.ok(scenes.length, 'No scene modes matched.');
    if (!requestedModes) {
      assert.equal(new Set(scenes.map(scene => scene.mode)).size, 12);
      assert.equal(scenes.length, 20);
    }
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const scene of scenes) {
        // Every variant has solo and visiting states. Main variants additionally
        // inspect Shen Xinghui on his own page, where legacy sizing differed.
        for (const cast of scene.first ? ['qiyu', 'pair', 'xinghui'] : ['qiyu', 'pair']) {
          await setScene(page, scene, cast);
          await saveCase(page, `${viewport.name}-${scene.id}-${cast}`, cast === 'pair' ? 2 : 1, report);
        }
      }
      console.log(`✓ captured ${viewport.name} scene matrix (${scenes.length} variants)`);
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await checkPoseMenus(page, scenes, report);
    await checkInteractions(page, scenes, report);
    assert.deepEqual(report.pageErrors, [], 'page script errors');
    const failures = [...report.cases, ...report.poses, ...report.interactions].flatMap(item => item.failures.map(message => `${item.name || `${item.mode || 'interaction'}/${item.uid || ''}/${item.pose || item.type || ''}`}: ${message}`));
    report.finishedAt = new Date().toISOString();
    report.failures = failures;
    fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(failures, [], `${failures.length} scene/pose/interaction failures; see artifacts/milk-scenes-v66/report.json`);
    console.log(`All milk-scene checks passed: ${report.cases.length} captures, ${report.poses.length} pose choices, ${report.interactions.length} interaction checks. All external HTTP/WebSockets were blocked; DB.demo stayed true.`);
  } finally {
    if (!report.finishedAt) fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
    await context?.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
