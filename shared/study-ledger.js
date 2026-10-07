/* Pure shared-study accounting. No storage, network, clocks or reward side effects. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StudyLedger = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const profiles = Object.freeze({
    qiyu: Object.freeze({ uid: 'u1', name: 'ljx', timeZone: 'America/Chicago' }),
    xinghui: Object.freeze({ uid: 'u2', name: 'zhai', timeZone: 'Asia/Shanghai' })
  });
  const research = new Set(['ky', '科研', '写作', 'research', 'writing']);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 128 && id.trim().length > 0;
  const validTimestamp = value => Number.isSafeInteger(value) && value >= 0 && Number.isFinite(new Date(value).getTime());
  const clone = value => JSON.parse(JSON.stringify(value));

  function profile(profileId) {
    if (!own(profiles, profileId)) throw new TypeError('Unknown study profile');
    return profiles[profileId];
  }

  function record(value, label) {
    if (value == null) return {};
    if (!object(value)) throw new TypeError(label + ' must be an object');
    return value;
  }

  function safeAdd(left, right) {
    const total = left + right;
    if (!Number.isSafeInteger(total) || total < 0) throw new RangeError('Study minutes exceed the supported range');
    return total;
  }

  function sessionKey(id) {
    if (!validId(id)) throw new TypeError('Session ID must be a nonempty string of at most 128 UTF-16 units');
    // Encode every UTF-16 unit, including surrogate pairs and unpaired surrogates.
    // This is reversible, collision-free and at most 513 ASCII bytes.
    let key = 's';
    for (let index = 0; index < id.length; index++) key += id.charCodeAt(index).toString(16).padStart(4, '0');
    return key;
  }

  function normalizeSession(session) {
    if (!object(session) || !validId(session.id)) return null;
    if (!Number.isSafeInteger(session.minutes) || session.minutes <= 0) return null;
    if (typeof session.category !== 'string' || !session.category.trim() || session.category.length > 40) return null;
    if (!validTimestamp(session.endedAt)) return null;
    const category = session.category.trim().toLowerCase();
    return { id: session.id, minutes: session.minutes, category: research.has(category) ? 'ky' : 'xx', endedAt: session.endedAt };
  }

  function timeZone(user, profileId) {
    const fallback = profile(profileId).timeZone;
    const candidate = user && user.tz;
    if (typeof candidate !== 'string' || !candidate || candidate.length > 128) return fallback;
    try { new Intl.DateTimeFormat('en-US', { timeZone: candidate }); return candidate; }
    catch (_) { return fallback; }
  }

  function dateKey(zone, timestamp) {
    if (!validTimestamp(timestamp)) throw new TypeError('Invalid study timestamp');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(timestamp));
    const part = type => parts.find(item => item.type === type).value;
    return part('year') + '-' + part('month') + '-' + part('day');
  }

  function receipts(user) {
    const sync = record(user.studySync, 'studySync');
    return record(sync.deepspaceSessions, 'deepspaceSessions');
  }

  function validSessions(sessions) {
    if (!Array.isArray(sessions)) throw new TypeError('Sessions must be an array');
    return sessions.map(normalizeSession).filter(Boolean);
  }

  function apply(user, sessions, profileId) {
    const current = record(user, 'User');
    const zone = timeZone(current, profileId);
    const known = receipts(current);
    let result;
    for (const session of validSessions(sessions)) {
      const key = sessionKey(session.id);
      const existing = result ? result.studySync.deepspaceSessions : known;
      // A receipt is global to the user, so a later time-zone/date change can
      // never move or credit the same session again. First payload wins.
      if (own(existing, key)) continue;
      if (!result) {
        result = clone(current);
        result.days = record(result.days, 'days');
        result.studySync = record(result.studySync, 'studySync');
        result.studySync.deepspaceSessions = record(result.studySync.deepspaceSessions, 'deepspaceSessions');
      }
      const date = dateKey(zone, session.endedAt);
      const day = record(result.days[date], 'Day');
      const minutes = record(day.m, 'Daily minutes');
      const before = own(minutes, session.category) ? minutes[session.category] : 0;
      if (!Number.isSafeInteger(before) || before < 0) throw new TypeError('Existing daily study minutes are invalid');
      minutes[session.category] = safeAdd(before, session.minutes);
      day.m = minutes;
      result.days[date] = day;
      result.studySync.deepspaceSessions[key] = Object.assign({}, session, { date });
    }
    return result;
  }

  function dayTotal(day) {
    const values = object(day) && object(day.m) ? day.m : {};
    const count = key => Number.isSafeInteger(values[key]) && values[key] >= 0 ? values[key] : 0;
    return safeAdd(count('ky'), count('xx'));
  }

  function summarize(user, pendingSessions, profileId, now = Date.now()) {
    const current = record(user, 'User');
    const zone = timeZone(current, profileId);
    const today = dateKey(zone, now);
    const days = record(current.days, 'days');
    const known = receipts(current);
    let cloudTotal = 0;
    for (const [date, day] of Object.entries(days)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) cloudTotal = safeAdd(cloudTotal, dayTotal(day));
    }
    const cloudToday = dayTotal(days[today]);
    let pendingCount = 0, pendingMinutes = 0, pendingToday = 0;
    const first = new Map(), conflicts = new Set();
    for (const session of validSessions(pendingSessions)) {
      const key = sessionKey(session.id);
      const inCloud = own(known, key);
      const canonical = inCloud ? known[key] : first.get(key);
      if (inCloud || first.has(key)) {
        if (!object(canonical) || canonical.minutes !== session.minutes || canonical.category !== session.category) conflicts.add(key);
        continue;
      }
      first.set(key, session);
      pendingCount++;
      pendingMinutes = safeAdd(pendingMinutes, session.minutes);
      if (dateKey(zone, session.endedAt) === today) pendingToday = safeAdd(pendingToday, session.minutes);
    }
    return {
      cloudToday, cloudTotal,
      todayMinutes: safeAdd(cloudToday, pendingToday), totalMinutes: safeAdd(cloudTotal, pendingMinutes),
      pendingCount, pendingMinutes, conflicts: conflicts.size, timeZone: zone
    };
  }

  return Object.freeze({ profiles, sessionKey, normalizeSession, apply, summarize, timeZone, dateKey });
});
