(function (global) {
  'use strict';

  const KEY = 'deepspace-companion-v1';
  const IDS = ['qiyu', 'xinghui'];
  const TIMEZONES = { qiyu: 'America/Chicago', xinghui: 'Asia/Shanghai' };
  const MAX_FILE_SIZE = 4 * 1024 * 1024;
  const MAX_COUNTER = 1000000000;
  const badKeys = new Set(['__proto__', 'constructor', 'prototype']);
  let lastError = null;
  let persistence = true;
  let protectedOriginal = null;
  let sequence = 0;

  const clone = value => JSON.parse(JSON.stringify(value));
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validId = id => IDS.includes(id);
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const integer = (value, min = 0, max = MAX_COUNTER) => Number.isSafeInteger(value) && value >= min && value <= max;
  const shortText = (value, max, empty = false) => typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
  const assert = (condition, text) => { if (!condition) throw new Error(text); };

  function freshProfile() {
    return {
      minutes: 0, bond: 0, fragments: 0, tasks: [], sessions: [], memories: [],
      storyProgress: {}, storyRead: [], chat: [], daily: {}, timer: null
    };
  }

  function freshState() {
    return {
      version: 1, selected: 'qiyu', settings: { sound: false, romance: true, motion: true },
      profiles: { qiyu: freshProfile(), xinghui: freshProfile() }
    };
  }

  function report(error) {
    lastError = error instanceof Error ? error.message : String(error);
    try {
      global.dispatchEvent(new global.CustomEvent('companion-storage-error', { detail: { message: lastError } }));
    } catch (_) { /* The store also works in embedded environments without CustomEvent. */ }
  }

  function keysExactly(obj, required, optional = []) {
    assert(isObject(obj), '存档字段必须是对象');
    assert(required.every(key => own(obj, key)), '存档缺少必要字段');
    assert(Object.keys(obj).every(key => required.includes(key) || optional.includes(key)), '存档包含不支持的字段');
  }

  // Keep flexible narrative objects usable while excluding executable/prototype data,
  // unbounded recursion, non-finite numbers, and excessive import payloads.
  function simpleJSON(value, depth = 0) {
    assert(depth <= 8, '存档嵌套层级过深');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'string') { assert(value.length <= 12000, '存档文本过长'); return; }
    if (typeof value === 'number') { assert(Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER, '存档数字无效'); return; }
    if (Array.isArray(value)) {
      assert(value.length <= 2000, '存档列表过长');
      value.forEach(item => simpleJSON(item, depth + 1));
      return;
    }
    assert(isObject(value), '存档只能包含普通 JSON 数据');
    const keys = Object.keys(value);
    assert(keys.length <= 1000, '存档对象过大');
    keys.forEach(key => {
      assert(!badKeys.has(key) && key.length <= 160, '存档包含不安全的字段');
      simpleJSON(value[key], depth + 1);
    });
  }

  function validDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 2000 || year > 9999) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function validISODate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
    const timestamp = Date.parse(value);
    // The UI writes toISOString(); round-tripping also rejects rolled-over dates.
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
  }

  function validateTimer(timer) {
    if (timer === null) return;
    keysExactly(timer, ['id', 'durationMs', 'startedAt', 'elapsedMs', 'paused', 'category', 'taskId']);
    assert(shortText(timer.id, 128), '计时会话编号无效');
    assert(integer(timer.durationMs, 60000, 120 * 60000) && timer.durationMs % 60000 === 0, '计时时长应为 1 至 120 分钟');
    assert(integer(timer.startedAt, 0, Number.MAX_SAFE_INTEGER), '计时开始时间无效');
    assert(integer(timer.elapsedMs, 0, timer.durationMs), '已计时时长无效');
    assert(typeof timer.paused === 'boolean', '计时暂停状态无效');
    assert(shortText(timer.category, 40), '计时分类无效');
    assert(timer.taskId === null || shortText(timer.taskId, 128), '计时关联任务无效');
  }

  function validateProfile(profile) {
    keysExactly(profile, ['minutes', 'bond', 'fragments', 'tasks', 'sessions', 'memories', 'storyProgress', 'storyRead', 'chat', 'daily', 'timer']);
    ['minutes', 'bond', 'fragments'].forEach(key => assert(integer(profile[key]), '累计数值无效'));
    assert(Array.isArray(profile.tasks) && profile.tasks.length <= 500, '任务列表无效或超过 500 项');
    const taskIds = new Set();
    profile.tasks.forEach(task => {
      keysExactly(task, ['id', 'title', 'category', 'done', 'steps'], ['createdAt', 'completedAt']);
      assert(shortText(task.id, 128) && !taskIds.has(task.id), '任务编号无效或重复');
      taskIds.add(task.id);
      assert(shortText(task.title, 500) && shortText(task.category, 40), '任务内容无效');
      assert(typeof task.done === 'boolean' && Array.isArray(task.steps) && task.steps.length <= 50, '任务步骤无效');
      task.steps.forEach(step => {
        keysExactly(step, ['text', 'done']);
        assert(shortText(step.text, 1000) && typeof step.done === 'boolean', '任务步骤内容无效');
      });
      ['createdAt', 'completedAt'].forEach(key => {
        if (own(task, key)) assert(task[key] === null || integer(task[key], 0, Number.MAX_SAFE_INTEGER), '任务时间无效');
      });
    });
    assert(Array.isArray(profile.sessions) && profile.sessions.length <= 1000, '专注记录无效或超过 1000 项');
    const sessionIds = new Set();
    profile.sessions.forEach(session => {
      keysExactly(session, ['id', 'date', 'minutes', 'completed', 'category', 'taskId', 'fragments', 'bond', 'endedAt']);
      assert(shortText(session.id, 128) && !sessionIds.has(session.id), '专注记录编号无效或重复');
      sessionIds.add(session.id);
      assert(validDateKey(session.date), '专注记录日期无效');
      assert(integer(session.minutes, 0, 120) && typeof session.completed === 'boolean', '专注记录时长无效');
      assert(shortText(session.category, 40) && (session.taskId === null || shortText(session.taskId, 128)), '专注记录分类或任务无效');
      assert(session.bond === session.minutes && session.fragments === Math.floor(session.minutes / 5), '专注奖励记录不一致');
      assert(integer(session.endedAt, 0, Number.MAX_SAFE_INTEGER), '专注结束时间无效');
    });
    assert(Array.isArray(profile.memories) && profile.memories.length <= 2000, '回忆列表无效或超过 2000 项');
    profile.memories.forEach(memory => {
      keysExactly(memory, ['id', 'date', 'title', 'text', 'type'], ['sessionId']);
      assert(shortText(memory.id, 128), '回忆编号无效');
      assert(validISODate(memory.date), '回忆日期无效');
      assert(shortText(memory.title, 500) && shortText(memory.text, 12000, true), '回忆内容无效');
      assert(['focus', 'task', 'story'].includes(memory.type), '回忆类型无效');
      if (own(memory, 'sessionId')) assert(shortText(memory.sessionId, 128), '回忆关联专注编号无效');
    });
    assert(Array.isArray(profile.chat) && profile.chat.length <= 2000, '对话列表无效或超过 2000 项');
    profile.chat.forEach(message => {
      keysExactly(message, ['role', 'text'], ['action']);
      assert(['user', 'assistant'].includes(message.role), '对话角色无效');
      assert(shortText(message.text, 12000, true), '对话内容无效');
      if (own(message, 'action')) assert(shortText(message.action, 1000, true), '对话场景描写无效');
    });
    assert(Array.isArray(profile.storyRead) && profile.storyRead.length <= 1000 && profile.storyRead.every(value => shortText(value, 160)), '剧情阅读记录无效');
    assert(isObject(profile.storyProgress) && Object.keys(profile.storyProgress).length <= 1000, '剧情进度记录无效');
    Object.entries(profile.storyProgress).forEach(([id, progress]) => {
      assert(shortText(id, 160) && !badKeys.has(id), '剧情编号无效');
      keysExactly(progress, ['node', 'reply', 'next']);
      assert(integer(progress.node, 0, 100), '剧情节点无效');
      assert(progress.reply === null || shortText(progress.reply, 12000, true), '剧情回应无效');
      assert(progress.next === null || progress.next === 'end' || integer(progress.next, 0, 100), '剧情下一节点无效');
    });
    assert(isObject(profile.daily), '每日记录无效');
    simpleJSON(profile.daily);
    validateTimer(profile.timer);
  }

  function validate(state) {
    keysExactly(state, ['version', 'selected', 'settings', 'profiles']);
    assert(state.version === 1, '存档版本不兼容，原存档已保留');
    assert(validId(state.selected), '选中的角色无效');
    keysExactly(state.settings, ['sound', 'romance', 'motion']);
    assert(Object.values(state.settings).every(value => typeof value === 'boolean'), '偏好设置无效');
    keysExactly(state.profiles, IDS);
    IDS.forEach(id => validateProfile(state.profiles[id]));
    assert(JSON.stringify(state).length <= MAX_FILE_SIZE, '存档超过 4 MB');
    return state;
  }

  let current = freshState();
  try {
    const raw = global.localStorage.getItem(KEY);
    if (raw !== null) {
      protectedOriginal = raw;
      assert(raw.length <= MAX_FILE_SIZE, '现有存档超过 4 MB，已保留原文件');
      current = validate(JSON.parse(raw));
      protectedOriginal = null;
    }
  } catch (error) {
    persistence = false;
    report(error);
  }

  function persist() {
    if (protectedOriginal !== null) {
      persistence = false;
      report('现有存档无法兼容，已保留原存档；请先导出备份，再导入可用存档。当前操作仅保留在本次打开期间。');
      return false;
    }
    try {
      global.localStorage.setItem(KEY, JSON.stringify(current));
      persistence = true;
      lastError = null;
      return true;
    } catch (error) {
      persistence = false;
      report(error);
      return false;
    }
  }

  function changed(detail) {
    try { global.dispatchEvent(new global.CustomEvent('companion-change', { detail })); } catch (_) {}
  }

  function update(mutator) {
    if (typeof mutator !== 'function') return false;
    const draft = clone(current);
    try {
      mutator(draft);
      validate(draft);
      current = draft;
    } catch (error) {
      report(error);
      return false;
    }
    persist();
    changed();
    return true;
  }

  function resolve(id) { return id === undefined ? current.selected : id; }
  function profile(id) {
    const selected = resolve(id);
    return validId(selected) ? clone(current.profiles[selected]) : null;
  }

  function dateKey(id = current.selected, timestamp = Date.now()) {
    if (!validId(id)) return null;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONES[id], year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(timestamp));
    const part = type => parts.find(item => item.type === type).value;
    return part('year') + '-' + part('month') + '-' + part('day');
  }

  function elapsed(id) {
    const selected = resolve(id);
    if (!validId(selected)) return 0;
    const timer = current.profiles[selected].timer;
    if (!timer) return 0;
    const running = timer.paused ? 0 : Math.max(0, Date.now() - timer.startedAt);
    return Math.min(timer.durationMs, timer.elapsedMs + running);
  }

  function start(options) {
    if (!isObject(options) || !integer(options.minutes, 1, 120)) return null;
    if (!shortText(options.category, 40)) return null;
    const taskId = options.taskId == null ? null : options.taskId;
    if (taskId !== null && !shortText(taskId, 128)) return null;
    const selected = current.selected;
    if (current.profiles[selected].timer) return null;
    const timer = {
      id: 'focus-' + Date.now().toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2, 10),
      durationMs: options.minutes * 60000, startedAt: Date.now(), elapsedMs: 0,
      paused: false, category: options.category, taskId
    };
    return update(state => { state.profiles[selected].timer = timer; }) ? clone(timer) : null;
  }

  function pause() {
    const selected = current.selected;
    const timer = current.profiles[selected].timer;
    if (!timer) return null;
    if (timer.paused) return clone(timer);
    const duration = elapsed(selected);
    if (!update(state => {
      state.profiles[selected].timer.elapsedMs = duration;
      state.profiles[selected].timer.paused = true;
    })) return null;
    return profile(selected).timer;
  }

  function resume() {
    const selected = current.selected;
    const timer = current.profiles[selected].timer;
    if (!timer) return null;
    if (!timer.paused) return clone(timer);
    if (!update(state => {
      state.profiles[selected].timer.startedAt = Date.now();
      state.profiles[selected].timer.paused = false;
    })) return null;
    return profile(selected).timer;
  }

  function finish(id) {
    const selected = resolve(id);
    if (!validId(selected)) return null;
    const old = current.profiles[selected];
    const timer = old.timer;
    if (!timer) return null;
    // A replayed timer from another page/import cannot reward a session twice.
    if (old.sessions.some(session => session.id === timer.id)) {
      update(state => { state.profiles[selected].timer = null; });
      return null;
    }
    const elapsedMs = elapsed(selected);
    const minutes = Math.floor(elapsedMs / 60000);
    const result = {
      minutes, completed: elapsedMs >= timer.durationMs, category: timer.category,
      taskId: timer.taskId, fragments: Math.floor(minutes / 5), bond: minutes, id: timer.id
    };
    const endedAt = Date.now();
    const date = dateKey(selected, endedAt);
    const success = update(state => {
      const target = state.profiles[selected];
      target.timer = null;
      target.minutes += minutes;
      target.bond += result.bond;
      target.fragments += result.fragments;
      target.sessions.push(Object.assign({}, result, { date, endedAt }));
      target.sessions = target.sessions.slice(-1000);
    });
    return success ? clone(result) : null;
  }

  function tick(id) {
    const selected = resolve(id);
    if (!validId(selected)) return null;
    const timer = current.profiles[selected].timer;
    return timer && elapsed(selected) >= timer.durationMs ? finish(selected) : null;
  }

  function todayMinutes(id) {
    const selected = resolve(id);
    if (!validId(selected)) return 0;
    const today = dateKey(selected);
    return current.profiles[selected].sessions.reduce((sum, session) => sum + (session.date === today ? session.minutes : 0), 0);
  }

  function rewardInteraction(kind) {
    if (!shortText(kind, 80) || badKeys.has(kind)) return { rewarded: false, bond: 0, kind };
    const selected = current.selected;
    const date = dateKey(selected);
    const result = { rewarded: false, bond: 0, date, kind };
    const entry = current.profiles[selected].daily[date];
    if (isObject(entry) && isObject(entry.interactions) && entry.interactions[kind] === true) return result;
    const success = update(state => {
      const target = state.profiles[selected];
      if (!isObject(target.daily[date])) target.daily[date] = {};
      if (!isObject(target.daily[date].interactions)) target.daily[date].interactions = {};
      target.daily[date].interactions[kind] = true;
      target.bond += 2;
      const dates = Object.keys(target.daily).filter(validDateKey).sort();
      dates.slice(0, Math.max(0, dates.length - 366)).forEach(key => { delete target.daily[key]; });
    });
    return success ? { rewarded: true, bond: 2, date, kind } : result;
  }

  function importData(text) {
    let imported;
    try {
      assert(typeof text === 'string' && text.length <= MAX_FILE_SIZE, '请选择小于 4 MB 的 JSON 存档');
      imported = validate(JSON.parse(text));
    } catch (error) {
      return { ok: false, error: error.message };
    }
    // Import is explicit replacement. Preserve any incompatible original first;
    // a quota/security failure must never erase the user's only existing save.
    try {
      if (protectedOriginal !== null) {
        const backupKey = KEY + '-preserved-' + Date.now() + '-' + (++sequence);
        global.localStorage.setItem(backupKey, protectedOriginal);
      }
      global.localStorage.setItem(KEY, JSON.stringify(imported));
    } catch (error) {
      persistence = false;
      report(error);
      return { ok: false, error: '保存导入存档失败；现有数据未改变。' };
    }
    protectedOriginal = null;
    current = imported;
    persistence = true;
    lastError = null;
    changed();
    return { ok: true };
  }

  // Refreshes in other tabs observe persisted state; no data is written in this
  // handler, and incompatible saves stay untouched for later recovery.
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('storage', event => {
      if (event.key !== KEY || typeof event.newValue !== 'string') return;
      try {
        assert(event.newValue.length <= MAX_FILE_SIZE, '外部存档超过 4 MB');
        current = validate(JSON.parse(event.newValue));
        protectedOriginal = null;
        persistence = true;
        lastError = null;
        changed({ source: 'storage' });
      } catch (error) {
        protectedOriginal = event.newValue;
        persistence = false;
        report(error);
      }
    });
  }

  global.CompanionStore = Object.freeze({
    state: () => clone(current), profile, update,
    select: id => validId(id) && update(state => { state.selected = id; }),
    start, elapsed, pause, resume, finish, tick, todayMinutes, rewardInteraction,
    dateKey,
    exportData: () => protectedOriginal !== null ? protectedOriginal : JSON.stringify(current, null, 2),
    importData,
    get persistence() { return persistence; },
    get lastError() { return lastError; }
  });
})(window);
