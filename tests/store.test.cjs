'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '..', 'deepspace', 'companion-store.js'), 'utf8');
const KEY = 'deepspace-companion-v1';
const clock = { now: Date.parse('2026-09-19T15:00:00Z') };

function createStore(storage = new Map(), options = {}) {
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  const events = [];
  const listeners = {};
  const window = {
    localStorage: {
      getItem(key) { if (options.failRead) throw new Error('Storage unavailable'); return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { if (options.failWrite) throw new Error('Quota exceeded'); storage.set(key, String(value)); }
    },
    CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data && data.detail; } },
    dispatchEvent(event) { events.push(event); },
    addEventListener(name, callback) { listeners[name] = callback; }
  };
  const context = vm.createContext({ window, Date: FakeDate, Intl, console });
  vm.runInContext(script, context, { filename: 'companion-store.js' });
  return { store: window.CompanionStore, storage, events, listeners };
}

function advance(ms) { clock.now += ms; }
function test(name, run) {
  clock.now = Date.parse('2026-09-19T15:00:00Z');
  run();
  process.stdout.write('✓ ' + name + '\n');
}

test('active and paused timer survive refresh; only actual running time is credited', () => {
  let { store, storage } = createStore();
  assert.ok(store.start({ minutes: 25, category: 'research', taskId: 'paper-1' }));
  advance(2 * 60000 + 1200);
  store = createStore(storage).store;
  assert.equal(store.elapsed(), 121200);
  store.pause();
  advance(20 * 60000);
  store = createStore(storage).store;
  assert.equal(store.elapsed(), 121200);
  assert.equal(store.profile().timer.paused, true);
  store.resume();
  advance(3 * 60000);
  const result = store.finish();
  assert.equal(result.minutes, 5);
  assert.equal(result.completed, false);
  assert.equal(result.fragments, 1);
  assert.equal(result.bond, 5);
  assert.equal(result.taskId, 'paper-1');
  assert.equal(store.todayMinutes(), 5);
});

test('finish is idempotent, including replayed session ids', () => {
  const { store, storage } = createStore();
  const original = store.start({ minutes: 10, category: 'study' });
  advance(10 * 60000);
  const first = store.finish();
  assert.equal(first.minutes, 10);
  assert.equal(store.finish(), null);
  let refreshed = createStore(storage).store;
  assert.equal(refreshed.finish(), null);
  refreshed.update(state => { state.profiles.qiyu.timer = original; });
  assert.equal(refreshed.finish(), null);
  assert.equal(refreshed.profile().minutes, 10);
  assert.equal(refreshed.profile().fragments, 2);
  assert.equal(refreshed.profile().sessions.length, 1);
});

test('automatic completion credits planned duration even after a long closed tab', () => {
  const { store } = createStore();
  store.start({ minutes: 25, category: 'study' });
  advance(24 * 60000);
  assert.equal(store.tick(), null);
  advance(8 * 60 * 60000);
  const result = store.tick();
  assert.equal(result.minutes, 25);
  assert.equal(result.completed, true);
  assert.equal(result.fragments, 5);
  assert.equal(store.tick(), null);
  assert.equal(store.profile().minutes, 25);
});

test('under one minute and paused waiting award no invented progress', () => {
  const { store } = createStore();
  store.start({ minutes: 1, category: 'research' });
  advance(59999);
  store.pause();
  advance(60 * 60000);
  assert.equal(store.tick(), null);
  const result = store.finish();
  assert.equal(result.minutes, 0);
  assert.equal(result.bond, 0);
  assert.equal(result.fragments, 0);
  assert.equal(store.profile().minutes, 0);
});

test('profiles, tasks, rewards and running timers remain isolated', () => {
  const { store } = createStore();
  store.update(state => { state.profiles.qiyu.tasks.push({ id: 'a', title: 'Read paper', category: 'research', done: false, steps: [{ text: 'Abstract', done: false }] }); });
  store.start({ minutes: 10, category: 'research', taskId: 'a' });
  store.rewardInteraction('hug');
  store.select('xinghui');
  assert.equal(store.profile().tasks.length, 0);
  assert.equal(store.profile().bond, 0);
  store.start({ minutes: 5, category: 'study' });
  advance(5 * 60000);
  assert.equal(store.tick().minutes, 5);
  assert.equal(store.profile().minutes, 5);
  assert.equal(store.profile('qiyu').minutes, 0);
  assert.equal(store.elapsed('qiyu'), 5 * 60000);
  store.select('qiyu');
  assert.equal(store.finish().minutes, 5);
  assert.equal(store.profile().bond, 7);
  assert.equal(store.profile('xinghui').bond, 5);
});

test('daily totals and interaction limits use each profile timezone', () => {
  const { store } = createStore();
  clock.now = Date.parse('2026-09-20T01:30:00Z');
  assert.equal(store.dateKey('qiyu'), '2026-09-19');
  assert.equal(store.dateKey('xinghui'), '2026-09-20');
  assert.equal(store.rewardInteraction('chat').rewarded, true);
  assert.equal(store.rewardInteraction('chat').rewarded, false);
  assert.equal(store.rewardInteraction('hug').rewarded, true);
  assert.equal(store.profile().fragments, 0);
  store.start({ minutes: 1, category: 'study' });
  advance(60000);
  store.tick();
  assert.equal(store.todayMinutes(), 1);
  assert.equal(store.profile().sessions[0].date, '2026-09-19');
  clock.now = Date.parse('2026-09-20T05:30:00Z');
  assert.equal(store.todayMinutes(), 0);
  assert.equal(store.rewardInteraction('chat').rewarded, true);
});

test('invalid imports leave memory and persisted save byte-for-byte unchanged', () => {
  const { store, storage } = createStore();
  store.rewardInteraction('chat');
  const before = store.exportData();
  const saved = storage.get(KEY);
  const cases = [
    '{broken', '{}', 'null', JSON.stringify({ version: 2 }),
    before.replace('"bond": 2', '"bond": -2'),
    before.replace('"selected": "qiyu"', '"selected": "other"'),
    before.replace('"tasks": []', '"tasks": [{"id":"x","title":"bad"}]'),
    before.replace('"daily": {', '"daily": {"__proto__":{"polluted":true},'),
    before.replace('"storyRead": []', '"storyRead": [12]')
  ];
  cases.forEach(text => {
    assert.equal(store.importData(text).ok, false);
    assert.equal(store.exportData(), before);
    assert.equal(storage.get(KEY), saved);
  });
  assert.equal(store.importData(' '.repeat(4 * 1024 * 1024 + 1)).ok, false);
  assert.equal({}.polluted, undefined);
});

test('valid exports import and snapshots do not mutate state accidentally', () => {
  const one = createStore().store;
  one.rewardInteraction('hug');
  one.select('xinghui');
  const two = createStore().store;
  assert.equal(two.importData(one.exportData()).ok, true);
  assert.equal(two.state().selected, 'xinghui');
  assert.equal(two.profile('qiyu').bond, 2);
  const snapshot = two.state();
  snapshot.profiles.qiyu.minutes = 999;
  assert.equal(two.profile('qiyu').minutes, 0);
  assert.equal(two.update(state => { state.profiles.qiyu.bond = -9; }), false);
  assert.equal(two.profile('qiyu').bond, 2);
});

test('real UI memories, chat and all story choices survive save and import', () => {
  const { store, storage } = createStore();
  const contentContext = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'deepspace', 'story-data.js'), 'utf8'), contentContext);
  const date = new Date(clock.now).toISOString();
  assert.equal(store.update(state => {
    const p = state.profiles.qiyu;
    p.memories = [
      { id: 'focus-memory', sessionId: 'focus-session', date, title: '一起专注了 25 分钟', text: '找到一个待核对的问题。', type: 'focus' },
      { id: 'task-memory', date, title: '完成了「读论文」', text: '又往前走了一小步。', type: 'task' },
      { id: 'story-memory', date, title: '靠窗的空位', text: '需要我的时候抬头。', type: 'story' }
    ];
    p.chat = [
      { role: 'user', text: '这一段读懂了。' },
      { role: 'assistant', text: '留一句进展，我们去透口气。', action: '他朝窗边偏了偏头。' }
    ];
    p.storyProgress['qiyu-0'] = { node: 0, reply: null, next: null };
  }), true);
  for (const [id, character] of Object.entries(contentContext.window.CompanionContent)) {
    for (const story of character.stories) {
      story.nodes.forEach((node, index) => {
        for (const choice of node.choices) {
          assert.equal(store.update(state => {
            state.profiles[id].storyProgress[story.id] = { node: index, reply: choice.reply, next: choice.next };
          }), true, `${story.id} node ${index} accepts its real UI choice`);
        }
      });
    }
  }
  const saved = store.exportData();
  assert.equal(createStore(storage).store.exportData(), saved);
  const restored = createStore().store;
  assert.equal(restored.importData(saved).ok, true);
  assert.equal(restored.exportData(), saved);
  assert.equal(restored.profile().memories.length, 3);
  assert.equal(restored.profile().chat.length, 2);
  assert.equal(restored.profile().storyProgress['qiyu-0'].next, 'end');
});

function rejectsNarrativeImports(cases) {
  const { store, storage } = createStore();
  store.rewardInteraction('chat');
  const before = store.exportData();
  const saved = storage.get(KEY);
  for (const [label, mutate] of cases) {
    const invalid = JSON.parse(before);
    mutate(invalid.profiles.qiyu);
    assert.equal(store.importData(JSON.stringify(invalid)).ok, false, label);
    assert.equal(store.exportData(), before, `${label}: memory remains unchanged`);
    assert.equal(storage.get(KEY), saved, `${label}: persisted save remains unchanged`);
  }
}

test('invalid story cursors cannot replace current memory or saved data', () => {
  const invalidEntries = [
    ['missing fields', {}],
    ['null progress', null],
    ['negative node', { node: -1, reply: null, next: null }],
    ['node above limit', { node: 101, reply: null, next: null }],
    ['fractional node', { node: 0.5, reply: null, next: null }],
    ['string node', { node: '0', reply: null, next: null }],
    ['object reply', { node: 0, reply: {}, next: 1 }],
    ['oversized reply', { node: 0, reply: 'a'.repeat(12001), next: 1 }],
    ['negative next', { node: 0, reply: '收到', next: -1 }],
    ['next above limit', { node: 0, reply: '收到', next: 101 }],
    ['fractional next', { node: 0, reply: '收到', next: 1.5 }],
    ['string next', { node: 0, reply: '收到', next: '1' }],
    ['unknown next', { node: 0, reply: '收到', next: 'later' }]
  ];
  rejectsNarrativeImports(invalidEntries.map(([label, progress]) => [label, p => {
    p.storyProgress['qiyu-0'] = progress;
  }]));
});

test('invalid memories cannot replace current memory or saved data', () => {
  const valid = { id: 'memory', date: new Date(clock.now).toISOString(), title: '今天的进展', text: '写好下一步。', type: 'focus' };
  const invalidEntries = [
    ['missing memory fields', {}],
    ['invalid date string', { ...valid, date: 'not-a-date' }],
    ['rolled-over date', { ...valid, date: '2026-02-30T15:00:00.000Z' }],
    ['non-ISO date', { ...valid, date: 'September 19, 2026' }],
    ['object title', { ...valid, title: {} }],
    ['oversized title', { ...valid, title: 'a'.repeat(501) }],
    ['object text', { ...valid, text: {} }],
    ['oversized text', { ...valid, text: 'a'.repeat(12001) }],
    ['unknown memory type', { ...valid, type: 'other' }],
    ['invalid session id', { ...valid, sessionId: {} }]
  ];
  rejectsNarrativeImports(invalidEntries.map(([label, memory]) => [label, p => {
    p.memories.push(memory);
  }]));
});

test('invalid chat messages cannot replace current memory or saved data', () => {
  const invalidEntries = [
    ['missing message fields', {}],
    ['unknown role', { role: 'system', text: 'hello' }],
    ['missing text', { role: 'user' }],
    ['object text', { role: 'user', text: {} }],
    ['oversized message', { role: 'user', text: 'a'.repeat(12001) }],
    ['object action', { role: 'assistant', text: 'hello', action: {} }],
    ['oversized action', { role: 'assistant', text: 'hello', action: 'a'.repeat(1001) }]
  ];
  rejectsNarrativeImports(invalidEntries.map(([label, message]) => [label, p => {
    p.chat.push(message);
  }]));
});

test('unrecognized existing saves are preserved, never silently reset', () => {
  const original = '{"version":0,"precious":"old memories"}';
  const storage = new Map([[KEY, original]]);
  const { store, events } = createStore(storage);
  assert.equal(store.persistence, false);
  assert.ok(store.lastError);
  assert.equal(store.exportData(), original);
  store.rewardInteraction('chat');
  assert.equal(storage.get(KEY), original);
  assert.ok(events.some(event => event.type === 'companion-storage-error'));
  const valid = createStore().store.exportData();
  assert.equal(store.importData(valid).ok, true);
  assert.equal(store.persistence, true);
  assert.ok([...storage.entries()].some(([key, value]) => key.startsWith(KEY + '-preserved-') && value === original));
});

test('storage failure keeps in-memory progress and emits recoverable warning', () => {
  const { store, events } = createStore(new Map(), { failWrite: true });
  assert.ok(store.start({ minutes: 1, category: 'study' }));
  advance(60000);
  assert.equal(store.tick().minutes, 1);
  assert.equal(store.profile().minutes, 1);
  assert.equal(store.persistence, false);
  assert.ok(store.lastError.includes('Quota'));
  assert.ok(events.some(event => event.type === 'companion-storage-error'));
  const before = store.exportData();
  const good = createStore().store.exportData();
  assert.equal(store.importData(good).ok, false);
  assert.equal(store.exportData(), before);
});

test('start validates duration, never overwrites an active timer', () => {
  const { store } = createStore();
  [0, -1, 121, 1.5, NaN, Infinity, '25'].forEach(minutes => assert.equal(store.start({ minutes, category: 'study' }), null));
  assert.equal(store.start({ minutes: 25, category: '' }), null);
  const timer = store.start({ minutes: 25, category: 'study' });
  assert.ok(timer);
  assert.equal(store.start({ minutes: 30, category: 'research' }), null);
  assert.equal(store.profile().timer.id, timer.id);
});

test('old sessions are capped at 1000 while cumulative minutes survive', () => {
  const { store } = createStore();
  const date = store.dateKey();
  assert.equal(store.update(state => {
    const profile = state.profiles.qiyu;
    profile.minutes = 1000;
    profile.bond = 1000;
    profile.sessions = Array.from({ length: 1000 }, (_, index) => ({ id: 'prior-' + index, date, minutes: 1, completed: true, category: 'study', taskId: null, fragments: 0, bond: 1, endedAt: clock.now }));
  }), true);
  store.start({ minutes: 1, category: 'study' });
  advance(60000);
  store.tick();
  assert.equal(store.profile().sessions.length, 1000);
  assert.equal(store.profile().sessions[0].id, 'prior-1');
  assert.equal(store.profile().minutes, 1001);
});

process.stdout.write('All companion-store tests passed.\n');
