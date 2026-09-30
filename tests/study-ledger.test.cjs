'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../shared/study-ledger.js');

const now = Date.parse('2026-09-29T05:30:00.000Z');
const session = (id, minutes = 25, category = '科研', endedAt = now) => ({ id, minutes, category, endedAt });
const copy = value => JSON.parse(JSON.stringify(value));
let count = 0;
function test(name, run) { run(); count++; console.log('✓ ' + name); }

test('CommonJS and browser globals expose the agreed pure API', () => {
  assert.deepEqual(Object.keys(L).sort(), ['apply', 'dateKey', 'normalizeSession', 'profiles', 'sessionKey', 'summarize', 'timeZone'].sort());
  const context = vm.createContext({ Intl, Date });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../shared/study-ledger.js'), 'utf8'), context);
  assert.equal(typeof context.StudyLedger.apply, 'function');
  assert.equal(context.StudyLedger.profiles.qiyu.uid, 'u1');
  assert.equal(L.profiles.qiyu.name, 'ljx');
  assert.equal(L.profiles.xinghui.name, 'zhai');
  assert.ok(Object.isFrozen(L.profiles.qiyu));
});

test('session keys encode forbidden path characters and Unicode without collisions', () => {
  const ids = ['a/b', 'a.b', 'a#b', 'a$b', 'a[b]', 'a]b', '祁煜/沈星回', '🌌', '\ud800', '\u0000', 's0061', 'a'];
  const keys = ids.map(L.sessionKey);
  assert.equal(new Set(keys).size, ids.length);
  for (const [index, key] of keys.entries()) {
    assert.match(key, /^s(?:[0-9a-f]{4})+$/);
    assert.equal(key, L.sessionKey(ids[index]));
    assert.equal(Buffer.byteLength(key), 1 + ids[index].length * 4);
  }
  assert.equal(Buffer.byteLength(L.sessionKey('界'.repeat(128))), 513);
  for (const invalid of ['', ' ', 123, null, 'x'.repeat(129)]) assert.throws(() => L.sessionKey(invalid));
});

test('normalization credits whole actual minutes and maps research/writing consistently', () => {
  for (const category of ['科研', '写作', 'research', 'writing', ' Research ', 'ky']) {
    assert.deepEqual(L.normalizeSession(session('a', 25, category)), session('a', 25, 'ky'));
  }
  for (const category of ['学习', 'study', 'learning', 'xx']) assert.equal(L.normalizeSession(session('a', 1, category)).category, 'xx');
  for (const value of [null, {}, session('a', 0), session('a', -1), session('a', 1.5), session('a', 121), session('a', '25'), session('a', 1, ''), session('a', 1, '学习', NaN), session('a', 1, '学习', Number.MAX_SAFE_INTEGER)]) {
    assert.equal(L.normalizeSession(value), null);
  }
  assert.equal(L.apply(null, [session('zero', 0)], 'qiyu'), undefined);
});

test('user-root application preserves sessions, todos, rewards and unrelated fields', () => {
  const initial = {
    name: 'ljx', tz: 'America/Los_Angeles',
    session: { startTs: now - 60000, cat: 'xx', mode: 'up', durMin: 240 },
    economy: { coins: 42, unlockedScenes: { cafe: true } },
    stats: { bondXp: 123 }, petLife: { location: 'u2' }, extra: { preserve: ['a', 'b'] },
    days: { '2026-09-28': { m: { ky: 10, xx: 20, dl: 9 }, todos: { task: { done: true } }, drink: { tops: ['pearl'] } } },
    studySync: { otherSource: { keep: true } }
  };
  const before = copy(initial);
  const result = L.apply(initial, [session('done')], 'qiyu');
  assert.deepEqual(initial, before, 'Caller input remains untouched');
  assert.equal(result.days['2026-09-28'].m.ky, 35);
  assert.equal(result.days['2026-09-28'].m.xx, 20);
  assert.equal(result.days['2026-09-28'].m.dl, 9);
  for (const field of ['session', 'economy', 'stats', 'petLife', 'extra', 'name', 'tz']) assert.deepEqual(result[field], before[field]);
  assert.deepEqual(result.days['2026-09-28'].todos, before.days['2026-09-28'].todos);
  assert.deepEqual(result.days['2026-09-28'].drink, before.days['2026-09-28'].drink);
  assert.deepEqual(result.studySync.otherSource, { keep: true });
  assert.notEqual(result.session, initial.session, 'Returned nested data is also cloned');
  assert.deepEqual(result.studySync.deepspaceSessions[L.sessionKey('done')], { ...session('done', 25, 'ky'), date: '2026-09-28' });
});

test('receipt is global across duplicate batches, changed timestamps and changed time zones', () => {
  const first = L.apply({ tz: 'America/Los_Angeles' }, [session('same'), session('same')], 'qiyu');
  assert.equal(first.days['2026-09-28'].m.ky, 25);
  assert.equal(L.apply(first, [session('same')], 'qiyu'), undefined);
  first.tz = 'Asia/Shanghai';
  assert.equal(L.apply(first, [session('same', 25, '科研', now + 86400000)], 'qiyu'), undefined);
  assert.equal(first.studySync.deepspaceSessions[L.sessionKey('same')].date, '2026-09-28');
  assert.equal(Object.keys(first.days).length, 1);
});

test('transaction retries preserve concurrent native increments and credit each session once', () => {
  const empty = { tz: 'America/Los_Angeles', days: { '2026-09-28': { m: { ky: 0, xx: 0 } } } };
  const proposalA = L.apply(empty, [session('A')], 'qiyu');
  const proposalB = L.apply(empty, [session('B', 5, '学习')], 'qiyu');
  assert.equal(proposalB.days['2026-09-28'].m.ky, 0);
  let committed = proposalA;
  committed.days['2026-09-28'].m.ky += 12; // Original milk-tea client committed meanwhile.
  committed = L.apply(committed, [session('B', 5, '学习')], 'qiyu'); // Server retries with current value.
  assert.deepEqual(committed.days['2026-09-28'].m, { ky: 37, xx: 5 });
  assert.equal(L.apply(committed, [session('A'), session('B', 5, '学习')], 'qiyu'), undefined);
  assert.equal(Object.keys(committed.studySync.deepspaceSessions).length, 2);
});

test('two accounts with the same session ID retain independent receipt namespaces', () => {
  const qiyu = L.apply({ tz: 'America/Los_Angeles' }, [session('shared-id')], 'qiyu');
  const xinghui = L.apply({ tz: 'America/New_York' }, [session('shared-id', 10, '学习')], 'xinghui');
  assert.equal(qiyu.days['2026-09-28'].m.ky, 25);
  assert.equal(xinghui.days['2026-09-29'].m.xx, 10);
  assert.equal(L.summarize(qiyu, [], 'qiyu', now).totalMinutes, 25);
  assert.equal(L.summarize(xinghui, [], 'xinghui', now).totalMinutes, 10);
});

test('cloud user time zone overrides profile defaults, including midnight and DST boundaries', () => {
  assert.equal(L.timeZone({ tz: 'America/Los_Angeles' }, 'qiyu'), 'America/Los_Angeles');
  assert.equal(L.timeZone({ tz: 'America/New_York' }, 'xinghui'), 'America/New_York');
  assert.equal(L.timeZone({ tz: 'Invalid/Zone' }, 'qiyu'), 'America/Chicago');
  assert.equal(L.timeZone(null, 'xinghui'), 'Asia/Shanghai');
  assert.equal(L.dateKey('America/Los_Angeles', Date.parse('2026-09-29T06:59:59.999Z')), '2026-09-28');
  assert.equal(L.dateKey('America/Los_Angeles', Date.parse('2026-09-29T07:00:00.000Z')), '2026-09-29');
  assert.equal(L.dateKey('America/Los_Angeles', Date.parse('2026-11-01T08:30:00.000Z')), '2026-11-01');
  assert.equal(L.dateKey('America/Los_Angeles', Date.parse('2026-11-01T09:30:00.000Z')), '2026-11-01');
  const result = L.apply({ tz: 'America/Los_Angeles' }, [session('historical', 5, '学习', now - 86400000)], 'qiyu');
  assert.equal(result.days['2026-09-27'].m.xx, 5, 'Use session end time, never upload day');
});

test('summary combines cloud minutes and only unapplied pending sessions, excluding exercise', () => {
  const source = { tz: 'America/Los_Angeles', days: { '2026-09-27': { m: { ky: 40, xx: 10, dl: 500 } }, '2026-09-28': { m: { xx: 20 } } } };
  const cloud = L.apply(source, [session('cloud')], 'qiyu');
  const pending = [session('cloud'), session('new', 5, '学习'), session('new', 5, '学习'), session('yesterday', 10, '写作', now - 86400000)];
  assert.deepEqual(L.summarize(cloud, pending, 'qiyu', now), {
    cloudToday: 45, cloudTotal: 95, todayMinutes: 50, totalMinutes: 110,
    pendingCount: 2, pendingMinutes: 15, conflicts: 0, timeZone: 'America/Los_Angeles'
  });
  const applied = L.apply(cloud, pending, 'qiyu');
  const summary = L.summarize(applied, pending, 'qiyu', now);
  assert.equal(summary.pendingCount, 0);
  assert.equal(summary.todayMinutes, 50);
  assert.equal(summary.totalMinutes, 110, 'Cloud echo and local pending never double-count');
});

test('conflicting IDs keep the first receipt and report one conflict per ID', () => {
  const cloud = L.apply({ tz: 'America/Los_Angeles' }, [session('first', 25, '科研')], 'qiyu');
  const changed = [session('first', 30, '科研'), session('first', 25, '学习'), session('first', 25, '写作')];
  assert.equal(L.apply(cloud, changed, 'qiyu'), undefined);
  const summary = L.summarize(cloud, changed, 'qiyu', now);
  assert.equal(summary.totalMinutes, 25);
  assert.equal(summary.pendingCount, 0);
  assert.equal(summary.conflicts, 1);
  const duplicates = [session('new', 10, '科研'), session('new', 20, '科研')];
  assert.equal(L.summarize(cloud, duplicates, 'qiyu', now).conflicts, 1);
  assert.equal(L.summarize(cloud, duplicates, 'qiyu', now).pendingMinutes, 10);
  assert.equal(L.apply(cloud, duplicates, 'qiyu').days['2026-09-28'].m.ky, 35);
});

test('summaries work with a minimal cache and empty users without mutating data', () => {
  const initial = L.apply(null, [session('a')], 'qiyu');
  const cached = { tz: 'America/Chicago', days: initial.days, studySync: initial.studySync };
  const before = copy(cached);
  assert.equal(L.summarize(cached, [session('a')], 'qiyu', now).pendingCount, 0);
  assert.deepEqual(cached, before);
  assert.deepEqual(L.summarize(null, [], 'xinghui', now), {
    cloudToday: 0, cloudTotal: 0, todayMinutes: 0, totalMinutes: 0,
    pendingCount: 0, pendingMinutes: 0, conflicts: 0, timeZone: 'Asia/Shanghai'
  });
  assert.throws(() => L.apply({ days: { '2026-09-29': { m: { ky: 'unreadable' } } } }, [session('bad')], 'qiyu'));
  assert.throws(() => L.summarize(null, [], 'unknown', now));
});

console.log(`PASS ${count} study-ledger groups; no browser storage or network accessed.`);
