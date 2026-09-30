'use strict';
const assert = require('node:assert/strict');
const { createStudySync, QUEUE_KEY } = require('../deepspace/study-sync.js');
const Ledger = require('../shared/study-ledger.js');
const clone = value => JSON.parse(JSON.stringify(value));
const now = Date.parse('2026-09-30T01:00:00Z');
const session = (id = 'session-1', minutes = 25) => ({ id, minutes, category: '科研', endedAt: now, date: '2026-09-29' });
function memory() {
  const values = new Map();
  return { values, getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}
function storeWith(sessions = []) {
  const profiles = {
    qiyu: { minutes: sessions.reduce((n, s) => n + s.minutes, 0), sessions: clone(sessions) },
    xinghui: { minutes: 0, sessions: [] }
  };
  return { profiles, state: () => ({ selected: 'qiyu' }), profile: id => clone(profiles[id]) };
}
function cloud() {
  const users = {
    qiyu: { tz: 'America/Los_Angeles', days: { '2026-09-29': { m: { ky: 40, xx: 20, dl: 500 }, todos: { keep: true } } }, economy: { coins: 99 }, session: { keep: true } },
    xinghui: { tz: 'America/New_York', days: {} }
  };
  const watchers = new Map(), connections = new Set();
  let connected = true, failure = null, ackLost = false, writes = 0;
  const notify = id => { for (const cb of watchers.get(id) || []) cb(clone(users[id])); };
  return {
    users, get writes() { return writes; },
    fail(error) { failure = error; }, loseNextAck() { ackLost = true; },
    publish(id, updater) { updater(users[id]); notify(id); },
    online(value) { connected = value; for (const cb of connections) cb(value); },
    async connect() {
      return {
        watch(id, callback, onError) {
          if (!watchers.has(id)) watchers.set(id, new Set());
          watchers.get(id).add(callback); callback(clone(users[id]));
          return () => watchers.get(id).delete(callback);
        },
        onConnection(callback) { connections.add(callback); callback(connected); return () => connections.delete(callback); },
        async transact(id, update) {
          assert.equal(connected, true, 'Never begin a new write while disconnected');
          writes++;
          if (failure) throw failure;
          // Firebase may invoke an updater repeatedly after concurrent changes.
          update(clone(users[id]));
          await Promise.resolve();
          const next = update(clone(users[id]));
          if (next !== undefined) users[id] = next;
          if (ackLost) { ackLost = false; throw Object.assign(new Error('Connection lost after commit'), { code: 'NETWORK_ERROR' }); }
          notify(id); return clone(users[id]);
        }
      };
    }
  };
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function settle(check) {
  for (let i = 0; i < 60; i++) { if (check()) return; await sleep(10); }
  assert.ok(check(), 'Expected sync did not settle');
}
async function test(name, run) { await run(); console.log('✓ ' + name); }
const active = new Set();
function bridge(store, storage, fakeCloud, overrides = {}) {
  const instance = createStudySync({ store, storage, connect: () => fakeCloud.connect(), now: () => now, ...overrides });
  active.add(instance); return instance;
}
(async () => {
  await test('existing cloud history + new local minutes merge once and preserve unrelated data', async () => {
    const db = cloud(), store = storeWith([session()]), storage = memory(), sync = bridge(store, storage, db);
    await sync.start();
    assert.equal(sync.summary().todayMinutes, 85);
    await settle(() => sync.summary().status === 'synced');
    assert.equal(db.users.qiyu.days['2026-09-29'].m.ky, 65);
    assert.equal(sync.summary().totalMinutes, 85);
    assert.equal(sync.summary().pendingCount, 0);
    assert.equal(sync.timeZone('qiyu'), 'America/Los_Angeles');
    assert.equal(sync.timeZone('xinghui'), 'America/New_York');
    assert.deepEqual(db.users.qiyu.economy, { coins: 99 });
    assert.deepEqual(db.users.qiyu.session, { keep: true });
    assert.equal(store.profiles.qiyu.minutes, 25, 'Shared totals never replace the local reward store');
    sync.scan(); await sleep(150); assert.equal(db.writes, 1);
    sync.destroy();
  });
  await test('two clients import the same save concurrently without duplicate minutes', async () => {
    const db = cloud(), a = bridge(storeWith([session()]), memory(), db), b = bridge(storeWith([session()]), memory(), db);
    await Promise.all([a.start(), b.start()]);
    await settle(() => a.summary().pendingCount === 0 && b.summary().pendingCount === 0);
    assert.equal(db.users.qiyu.days['2026-09-29'].m.ky, 65);
    assert.equal(Object.keys(db.users.qiyu.studySync.deepspaceSessions).length, 1);
    a.destroy(); b.destroy();
  });
  await test('offline outbox survives reload even after the local 1000-session list has dropped its record', async () => {
    const db = cloud(), storage = memory(), original = storeWith([session('old')]); db.online(false);
    const a = bridge(original, storage, db); await a.start();
    assert.equal(a.summary().pendingMinutes, 25); assert.equal(db.writes, 0); a.destroy();
    const withoutDetails = storeWith([]); withoutDetails.profiles.qiyu.minutes = 25;
    const b = bridge(withoutDetails, storage, db); await b.start();
    assert.equal(b.summary().pendingMinutes, 25);
    db.online(true); await settle(() => b.summary().pendingCount === 0);
    assert.equal(db.users.qiyu.days['2026-09-29'].m.ky, 65); b.destroy();
  });
  await test('lost commit acknowledgement can retry safely after reconnect', async () => {
    const db = cloud(), sync = bridge(storeWith([session()]), memory(), db); db.loseNextAck();
    await sync.start(); await settle(() => sync.summary().status === 'error');
    assert.equal(db.users.qiyu.days['2026-09-29'].m.ky, 65);
    db.online(false); db.online(true);
    await settle(() => sync.summary().status === 'synced');
    assert.equal(sync.summary().totalMinutes, 85); assert.equal(db.users.qiyu.days['2026-09-29'].m.ky, 65); sync.destroy();
  });
  await test('permission failures retain pending data and recover via explicit retry', async () => {
    const db = cloud(), storage = memory(), sync = bridge(storeWith([session()]), storage, db);
    db.fail(Object.assign(new Error('Permission denied'), { code: 'PERMISSION_DENIED' }));
    await sync.start(); await settle(() => sync.summary().status === 'error');
    assert.equal(sync.summary().pendingMinutes, 25); assert.ok(storage.getItem(QUEUE_KEY).includes('session-1'));
    assert.equal(db.users.qiyu.days['2026-09-29'].m.ky, 40);
    db.fail(null); await sync.retry(); await settle(() => sync.summary().status === 'synced');
    assert.equal(db.users.qiyu.days['2026-09-29'].m.ky, 65); sync.destroy();
  });
  await test('milk tea updates flow back live, exercise stays excluded, and accounts stay isolated', async () => {
    const db = cloud(), sync = bridge(storeWith(), memory(), db); await sync.start();
    db.publish('qiyu', u => { u.days['2026-09-29'].m.xx += 15; u.days['2026-09-29'].m.dl += 500; });
    assert.equal(sync.summary().todayMinutes, 75); assert.equal(sync.summary('xinghui').todayMinutes, 0);
    assert.equal(db.writes, 0); sync.destroy();
  });
  await test('summary excludes untraceable old totals and reports same-ID conflicts without overwriting receipts', async () => {
    const db = cloud(); db.users.qiyu = Ledger.apply(db.users.qiyu, [session()], 'qiyu');
    const local = storeWith([session('session-1', 30)]); local.profiles.qiyu.minutes = 1000;
    const sync = bridge(local, memory(), db); await sync.start();
    assert.equal(sync.summary().totalMinutes, 85); assert.equal(sync.summary().conflicts, 1);
    assert.equal(sync.summary().unindexedMinutes, 970); assert.equal(db.writes, 0); sync.destroy();
  });
  await test('corrupted outbox is preserved and a stale tab cannot erase a newer pending entry', async () => {
    const db = cloud(); db.online(false);
    const storage = memory(), a = bridge(storeWith([session('a')]), storage, db), b = bridge(storeWith([session('b')]), storage, db);
    await a.start(); await b.start(); a.scan();
    const queued = JSON.parse(storage.getItem(QUEUE_KEY)).profiles.qiyu;
    assert.equal(Object.keys(queued).length, 2);
    a.destroy(); b.destroy();
    const bad = memory(); bad.values.set(QUEUE_KEY, '{valuable incomplete data');
    const c = bridge(storeWith([session()]), bad, db); await c.start();
    assert.equal(bad.getItem(QUEUE_KEY), '{valuable incomplete data');
    assert.equal(c.summary().error.code, 'local-cache-invalid'); c.destroy();
  });
  console.log('All shared-study synchronization tests passed; no network connections were made.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => active.forEach(sync => sync.destroy()));
