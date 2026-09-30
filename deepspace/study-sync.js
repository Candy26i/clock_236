(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../shared/study-ledger.js'));
  } else {
    const api = factory(root.StudyLedger);
    root.CompanionStudy = api.createStudySync({
      store: root.CompanionStore,
      storage: { getItem: key => root.localStorage.getItem(key), setItem: (key, value) => root.localStorage.setItem(key, value) },
      connect: () => api.connectFirebase(root),
      emit: () => root.dispatchEvent(new CustomEvent('companion-study-change'))
    });
    root.addEventListener('companion-change', () => root.CompanionStudy.scan());
    root.addEventListener('online', () => root.CompanionStudy.retry());
    root.document.addEventListener('visibilitychange', () => { if (!root.document.hidden) root.CompanionStudy.scan(); });
    root.addEventListener('storage', event => {
      if (event.key === api.QUEUE_KEY) root.CompanionStudy.reloadQueue();
    });
    root.CompanionStudy.start();
  }
})(typeof window === 'object' ? window : globalThis, function (Ledger) {
  'use strict';
  const IDS = ['qiyu', 'xinghui'];
  const QUEUE_KEY = 'deepspace-study-outbox-v1';
  const CACHE_KEY = 'deepspace-study-cache-v1';
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const blank = () => ({ qiyu: {}, xinghui: {} });

  // Cache only minute totals and receipts, never the user's tasks, drinks or pet state.
  function compact(user) {
    const snapshot = { tz: user?.tz || null, days: {}, studySync: { deepspaceSessions: {} } };
    for (const [date, day] of Object.entries(user?.days || {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && object(day?.m)) snapshot.days[date] = { m: copy(day.m) };
    }
    if (object(user?.studySync?.deepspaceSessions)) snapshot.studySync.deepspaceSessions = copy(user.studySync.deepspaceSessions);
    return snapshot;
  }

  function createStudySync({ store, storage, connect, emit = () => {}, now = () => Date.now(), delay = setTimeout, cancel = clearTimeout }) {
    let queue = blank(), snapshots = {}, ready = {}, live = {}, inFlight = {};
    let transport, connectionPromise, stopConnection, stops = [], timer, dayTimer, lastDays, online = false, destroyed = false;
    let errors = {}, queueError = null, queueProtected = false;

    function failure(error, fallback = 'sync-failed') {
      return { code: String(error?.code || fallback), message: String(error?.message || error || '同步暂未完成') };
    }
    function saveQueue() {
      if (queueProtected) return false;
      try {
        const sorted = {};
        for (const id of IDS) sorted[id] = Object.fromEntries(Object.entries(queue[id]).sort(([a], [b]) => a.localeCompare(b)));
        const serialized = JSON.stringify({ version: 1, profiles: sorted });
        if (storage.getItem(QUEUE_KEY) !== serialized) storage.setItem(QUEUE_KEY, serialized);
        queueError = null;
        return true;
      } catch (error) { queueError = failure(error, 'local-storage'); return false; }
    }
    function reloadQueue() {
      try {
        const raw = storage.getItem(QUEUE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.version !== 1 || !object(data.profiles)) throw new Error('待同步存档格式无法读取，原数据已保留');
        for (const id of IDS) {
          if (!object(data.profiles[id])) throw new Error('待同步存档缺少账户');
          for (const value of Object.values(data.profiles[id])) {
            const entry = Ledger.normalizeSession(value);
            if (!entry) throw new Error('待同步存档包含无效记录，原数据已保留');
            queue[id][Ledger.sessionKey(entry.id)] ||= entry;
          }
        }
        queueProtected = false;
        queueError = null;
      } catch (error) { queueProtected = true; queueError = failure(error, 'local-cache-invalid'); }
    }
    reloadQueue();
    try {
      const cached = JSON.parse(storage.getItem(CACHE_KEY) || 'null');
      if (cached?.version === 1 && object(cached.profiles)) {
        for (const id of IDS) if (object(cached.profiles[id])) {
          snapshots[id] = compact(cached.profiles[id]); ready[id] = true;
        }
      }
    } catch (_) { /* Cloud reads can restore a discarded read-only cache. */ }

    const receipts = id => snapshots[id]?.studySync?.deepspaceSessions || {};
    function collect() {
      reloadQueue();
      for (const id of IDS) {
        for (const session of store.profile(id)?.sessions || []) {
          const entry = Ledger.normalizeSession(session);
          if (!entry) continue;
          const key = Ledger.sessionKey(entry.id);
          if (!Object.hasOwn(receipts(id), key)) queue[id][key] ||= entry;
        }
        for (const key of Object.keys(queue[id])) if (Object.hasOwn(receipts(id), key)) delete queue[id][key];
      }
      saveQueue();
    }
    function pending(id) {
      // Keep local completed sessions visible for conflict reporting, even after an ACK.
      return [...Object.values(queue[id]), ...(store.profile(id)?.sessions || [])];
    }
    function summary(id = store.state().selected) {
      if (!IDS.includes(id)) id = 'qiyu';
      const profile = store.profile(id);
      const totals = Ledger.summarize(snapshots[id] || {}, pending(id), id, now());
      const detailed = (profile?.sessions || []).reduce((sum, item) => sum + item.minutes, 0);
      const error = errors[id] || (totals.pendingCount ? queueError : null);
      const status = error ? 'error' : !online ? (transport || ready[id] ? 'offline' : connectionPromise ? 'connecting' : 'local') : !live[id] ? 'connecting' : totals.pendingCount || inFlight[id] ? 'syncing' : 'synced';
      return { ...totals, totalMinutes: ready[id] ? totals.totalMinutes : Math.max(profile?.minutes || 0, totals.totalMinutes),
        ready: !!ready[id], online, status, error, unindexedMinutes: Math.max(0, (profile?.minutes || 0) - detailed) };
    }
    function timeZone(id) { return Ledger.timeZone(snapshots[id] || {}, id); }
    function notify() { if (!destroyed) emit(); }
    function checkDay() {
      if (destroyed) return;
      const days = IDS.map(id => Ledger.dateKey(timeZone(id), now())).join('|');
      if (lastDays && days !== lastDays) notify();
      lastDays = days;
      dayTimer = delay(checkDay, 60000);
    }
    function schedule() {
      if (destroyed || timer) return;
      timer = delay(() => { timer = null; IDS.forEach(flush); }, 100);
    }
    function scan() { if (destroyed) return; collect(); notify(); schedule(); }
    function receive(id, user) {
      snapshots[id] = compact(user); ready[id] = true; live[id] = true;
      errors[id] = null;
      collect();
      try { storage.setItem(CACHE_KEY, JSON.stringify({ version: 1, profiles: snapshots })); } catch (_) {}
      notify(); schedule();
    }
    async function flush(id) {
      if (destroyed || !transport || !online || !live[id] || inFlight[id] || errors[id]) return;
      const entries = Object.values(queue[id]).filter(entry => !Object.hasOwn(receipts(id), Ledger.sessionKey(entry.id))).slice(0, 100);
      if (!entries.length) return;
      inFlight[id] = true; notify();
      try {
        const user = await transport.transact(id, current => Ledger.apply(current, entries, id));
        if (!destroyed) receive(id, user);
      } catch (error) { errors[id] = failure(error); }
      finally { inFlight[id] = false; notify(); schedule(); }
    }
    function subscribe() {
      stops.forEach(stop => stop()); stops = [];
      for (const id of IDS) {
        errors[id] = null; live[id] = false;
        stops.push(transport.watch(id, user => receive(id, user), error => {
          errors[id] = failure(error); live[id] = false; notify();
        }));
      }
    }
    async function start() {
      if (destroyed) return;
      if (!dayTimer) checkDay();
      scan();
      if (transport) { subscribe(); notify(); schedule(); return; }
      if (connectionPromise) return connectionPromise;
      IDS.forEach(id => { errors[id] = null; });
      connectionPromise = (async () => {
        try {
          const connection = await connect();
          if (destroyed) { connection.close?.(); return; }
          transport = connection;
          subscribe();
          stopConnection = transport.onConnection(value => {
            online = !!value;
            // Transient write failures are retried after a real reconnect.
            if (online) for (const id of IDS) if (live[id] && !String(errors[id]?.code).includes('PERMISSION')) errors[id] = null;
            notify(); schedule();
          });
        } catch (error) { IDS.forEach(id => { errors[id] = failure(error, 'connection-failed'); }); }
        finally { connectionPromise = null; notify(); }
      })();
      notify(); return connectionPromise;
    }
    function destroy() {
      destroyed = true; if (timer) cancel(timer); if (dayTimer) cancel(dayTimer);
      stops.forEach(stop => stop()); stopConnection?.(); transport?.close?.();
    }
    return { start, retry: start, scan, reloadQueue: () => { reloadQueue(); scan(); }, summary, timeZone, destroy };
  }

  function loadScript(root, src) {
    return new Promise((resolve, reject) => {
      const script = root.document.createElement('script');
      const timer = root.setTimeout(() => { script.remove(); reject(new Error('同步服务加载超时')); }, 12000);
      script.src = src; script.async = true;
      script.onload = () => { root.clearTimeout(timer); resolve(); };
      script.onerror = () => { root.clearTimeout(timer); script.remove(); reject(new Error('同步服务暂时无法连接')); };
      root.document.head.appendChild(script);
    });
  }
  async function connectFirebase(root) {
    for (const part of ['app', 'database']) {
      if (part === 'app' ? root.firebase?.initializeApp : root.firebase?.database) continue;
      try { await loadScript(root, `https://www.gstatic.com/firebasejs/10.12.2/firebase-${part}-compat.js`); }
      catch (_) { await loadScript(root, `https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.2/firebase-${part}-compat.min.js`); }
    }
    const name = 'deepspace-study';
    const app = root.firebase.apps.find(item => item.name === name) || root.firebase.initializeApp(root.StudyFirebaseConfig, name);
    const db = app.database();
    const ref = id => db.ref('milktea-v1/users/' + Ledger.profiles[id].uid);
    return {
      watch(id, onValue, onError) {
        const target = ref(id), callback = snapshot => onValue(snapshot.val());
        target.on('value', callback, onError);
        return () => target.off('value', callback);
      },
      onConnection(callback) {
        const target = db.ref('.info/connected'), listener = snapshot => callback(snapshot.val() === true);
        target.on('value', listener);
        return () => target.off('value', listener);
      },
      async transact(id, update) {
        let reducerError;
        const result = await ref(id).transaction(value => {
          try { return update(value); }
          catch (error) { reducerError = error; return undefined; }
        }, undefined, false);
        if (reducerError) throw reducerError;
        return result.snapshot.val();
      }
    };
  }
  return { createStudySync, connectFirebase, QUEUE_KEY, CACHE_KEY };
});
