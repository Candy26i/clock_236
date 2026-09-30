(function (global) {
  'use strict';

  const DWELL_SECONDS = 54;
  const TRANSITION_SECONDS = 0.45;
  const LOAD_TIMEOUT_MS = 15000;
  const WARMUP_SECONDS = 0.16;

  function localMediaPath(value, extension) {
    return typeof value === 'string' && value.length <= 2048 &&
      !/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(value) &&
      !value.split(/[\\/]/).includes('..') &&
      !/[\u0000-\u001f]/.test(value) && extension.test(value.split(/[?#]/)[0]);
  }

  function bounded(value, fallback, min, max) {
    const number = Number(value);
    return value !== undefined && value !== null && Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function normalizeClips(character, input) {
    const list = Array.isArray(input) ? input : (input && input[character]);
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.slice(0, 100).map((entry, index) => {
      const clip = typeof entry === 'string' ? { src: entry } : entry;
      if (!clip || !localMediaPath(clip.src, /\.mp4$/i) || seen.has(clip.src)) return null;
      seen.add(clip.src);
      return Object.assign({}, clip, {
        id: String(clip.id || character + '-' + index),
        label: String(clip.label || clip.title || '陪伴片段 ' + (index + 1)),
        title: String(clip.title || clip.label || '陪伴片段 ' + (index + 1)),
        poster: localMediaPath(clip.poster, /\.(?:jpe?g|png|webp|avif)$/i) ? clip.poster : '',
        dwellSeconds: bounded(clip.dwellSeconds, DWELL_SECONDS, 1, 3600),
        playbackRate: bounded(clip.playbackRate, 1, 0.25, 2),
        loopStart: bounded(clip.loopStart, 0, 0, 36000),
        loopEnd: Number.isFinite(Number(clip.loopEnd)) && Number(clip.loopEnd) > 0 ? Number(clip.loopEnd) : null,
        transitionSeconds: bounded(clip.transitionSeconds, TRANSITION_SECONDS, 0.05, 1.5)
      });
    }).filter(Boolean);
  }

  /**
   * Two reusable, muted local-video slots. Every loop uses the hidden slot;
   * the visible video is never rewound. A decoded incoming frame fades over
   * the still-moving, fully opaque outgoing frame. Actual foreground playback
   * counts toward automatic dwell; next() selects the next loop boundary.
   */
  class CompanionScenePlayer {
    constructor({ container, character, clips, onClipChange, reduceMotion = false } = {}) {
      if (!container || typeof container.querySelector !== 'function') throw new TypeError('CompanionScenePlayer requires a container element');
      this.container = container;
      this.document = container.ownerDocument || global.document;
      this.onClipChange = typeof onClipChange === 'function' ? onClipChange : null;
      this._destroyed = false;
      this._epoch = 0;
      this._raf = null;
      this._fadeTimer = null;
      this._transitioning = null;
      this._warming = null;
      this._mode = 'auto';
      this._reduced = Boolean(reduceMotion);
      this._wantsPlay = !this._reduced;
      this._active = null;
      this._pending = null;
      this._index = -1;
      this._watched = 0;
      this._queuedNext = false;
      this._failed = new Set();
      this._status = 'loading';
      this._error = null;

      let primary = container.querySelector('#characterVideo');
      if (!primary || String(primary.tagName).toLowerCase() !== 'video') primary = null;
      this._adopted = primary;
      if (!primary) {
        primary = this.document.createElement('video');
        if (!this.document.getElementById('characterVideo')) primary.id = 'characterVideo';
        container.appendChild(primary);
      }
      const secondary = this.document.createElement('video');
      primary.parentNode.insertBefore(secondary, primary.nextSibling);
      this._slots = [primary, secondary].map(video => {
        const slot = { video, index: -1, source: '', token: 0, ready: false, cleanups: [], timer: null, frame: null, lastTime: 0, playPromise: null, inheritedPoster: video.getAttribute('poster') || '', inheritedCharacter: String(character || '') };
        video.pause();
        video.classList.add('character-video');
        video.setAttribute('aria-hidden', 'true');
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.removeAttribute('autoplay');
        video.removeAttribute('loop');
        video.autoplay = false;
        video.loop = false;
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.controls = false;
        video.tabIndex = -1;
        video.preload = 'auto';
        video.style.opacity = '0';
        video.style.pointerEvents = 'none';
        video.style.transition = 'none';
        video.dataset.playerActive = 'false';
        video.dataset.playerTransition = 'false';
        return slot;
      });
      this._onVisibility = () => {
        if (this.document.hidden) this._halt();
        else if (this._canPlay()) this._start();
      };
      this.document.addEventListener('visibilitychange', this._onVisibility);
      this.setCharacter(character, clips);
    }

    _canPlay() { return !this._destroyed && this._wantsPlay && !this._reduced && !this.document.hidden; }
    _valid(slot, token, epoch) { return !this._destroyed && this._epoch === epoch && slot.token === token; }
    _clip(slot) { return slot && this.clips[slot.index]; }
    _bounds(slot) {
      const clip = this._clip(slot);
      const duration = Number(slot.video.duration);
      const end = Number.isFinite(duration) && duration > 0 ? Math.min(clip.loopEnd || duration, duration) : (clip.loopEnd || Infinity);
      return { start: Math.min(clip.loopStart, Math.max(0, end - 0.25)), end };
    }
    _fadeSeconds(slot) {
      const bounds = this._bounds(slot);
      return Math.min(this._clip(slot).transitionSeconds, (bounds.end - bounds.start) / this._clip(slot).playbackRate / 3);
    }
    _emit() {
      if (this._destroyed) return;
      this.container.dataset.playerState = this._status;
      if (this.onClipChange) {
        try { this.onClipChange(this.getCurrent()); } catch (error) { if (global.console) global.console.warn('Scene player callback failed', error); }
      }
    }
    _listen(slot, name, listener) {
      slot.video.addEventListener(name, listener);
      slot.cleanups.push(() => slot.video.removeEventListener(name, listener));
    }
    _cancelFrame(slot) {
      if (slot.frame !== null && slot.video.cancelVideoFrameCallback) slot.video.cancelVideoFrameCallback(slot.frame);
      slot.frame = null;
    }
    _clearSlot(slot) {
      slot.token += 1;
      slot.cleanups.forEach(remove => remove());
      slot.cleanups = [];
      if (slot.timer !== null) global.clearTimeout(slot.timer);
      slot.timer = null;
      this._cancelFrame(slot);
      slot.ready = false;
      slot.playPromise = null;
      slot.video.pause();
    }
    _nextIndex(from) {
      for (let offset = 1; offset <= this.clips.length; offset += 1) {
        const index = (from + offset + this.clips.length) % this.clips.length;
        if (!this._failed.has(index)) return index;
      }
      return -1;
    }
    _recordProgress(slot) {
      if (slot !== this._active) return;
      const time = Number(slot.video.currentTime);
      if (!Number.isFinite(time)) return;
      const delta = time - slot.lastTime;
      // Convert media time into time actually spent watching, including slowed
      // clips, while never counting seeks or wall time spent paused/backgrounded.
      if (delta > 0 && !slot.video.seeking) this._watched += delta / (slot.video.playbackRate || 1);
      slot.lastTime = time;
    }
    _targetIndex() {
      if (!this._active) return -1;
      if (this._failed.has(this._index)) return this._nextIndex(this._index);
      const remaining = Math.max(0, this._bounds(this._active).end - this._active.video.currentTime) / this._clip(this._active).playbackRate;
      const rotate = this._queuedNext || (this._mode === 'auto' && this._watched + remaining >= this._clip(this._active).dwellSeconds);
      return rotate ? this._nextIndex(this._index) : this._index;
    }

    _load(slot, index) {
      const clip = this.clips[index];
      if (!clip) return;
      const reuse = slot.source === clip.src && slot.video.readyState >= 1 && !slot.video.error;
      this._clearSlot(slot);
      const token = slot.token;
      const epoch = this._epoch;
      const video = slot.video;
      slot.index = index;
      slot.source = clip.src;
      slot.lastTime = 0;
      video.dataset.clipId = clip.id;
      video.dataset.character = this.character;
      video.dataset.playerActive = 'false';
      video.dataset.playerTransition = 'false';
      video.style.transition = 'none';
      video.style.opacity = '0';
      video.style.zIndex = '-1';
      video.playbackRate = clip.playbackRate;
      const poster = clip.poster || (slot === this._slots[0] && this.character === slot.inheritedCharacter ? slot.inheritedPoster : '');
      if (poster) video.setAttribute('poster', poster); else video.removeAttribute('poster');
      const expected = new URL(clip.src, this.document.baseURI || global.location.href).href;
      const valid = () => this._valid(slot, token, epoch) && (!video.currentSrc || video.currentSrc === expected);
      let positioned = false;
      const ready = () => {
        if (!valid() || video.readyState < 1) return;
        if (!positioned) {
          positioned = true;
          const start = this._bounds(slot).start;
          if (Math.abs(video.currentTime - start) > 0.015) {
            try { video.currentTime = start; } catch (_) { this._fail(slot, '无法定位这一段'); }
            return;
          }
        }
        if (video.readyState < 2 || video.seeking) return;
        slot.ready = true;
        slot.lastTime = video.currentTime;
        if (slot.timer !== null) global.clearTimeout(slot.timer);
        slot.timer = null;
        if (this._pending === slot) this._commitStill(slot);
      };
      ['loadedmetadata', 'loadeddata', 'canplay', 'seeked'].forEach(event => this._listen(slot, event, ready));
      this._listen(slot, 'error', () => { if (valid()) this._fail(slot, '这一段暂时无法播放'); });
      this._listen(slot, 'timeupdate', () => { if (valid()) this._recordProgress(slot); });
      this._listen(slot, 'seeking', () => { slot.lastTime = Number(video.currentTime) || 0; });
      this._listen(slot, 'ended', () => { if (valid() && slot === this._active) { this._recordProgress(slot); this._schedule(); } });
      slot.timer = global.setTimeout(() => { if (valid() && !slot.ready) this._fail(slot, '片段载入超时，已尝试下一段'); }, LOAD_TIMEOUT_MS);
      // Once a same-source slot is hidden, seek its existing decoder instead of
      // tearing it down and requesting the MP4 again on every short loop.
      if (!reuse) {
        video.src = clip.src;
        try { video.load(); } catch (_) { this._fail(slot, '这一段暂时无法载入'); }
      }
      if (video.readyState >= 1) ready();
    }

    _commit(slot) {
      const old = this._active;
      const previousStatus = this._status;
      if (old) this._recordProgress(old);
      const changed = !old || old.source !== slot.source;
      this._active = slot;
      this._pending = null;
      this._index = slot.index;
      if (changed) { this._watched = 0; this._queuedNext = false; }
      this._error = null;
      slot.lastTime = Number(slot.video.currentTime) || 0;
      this._slots.forEach(item => {
        item.video.style.transition = 'none';
        item.video.style.opacity = item === slot ? '1' : '0';
        item.video.style.zIndex = item === slot ? '-1' : '-2';
        item.video.dataset.playerActive = String(item === slot);
        item.video.dataset.playerTransition = 'false';
        if (item !== slot) item.video.pause();
      });
      this._status = this._canPlay() && !slot.video.paused ? 'playing' : 'paused';
      if (changed || previousStatus !== this._status) this._emit();
    }
    _commitStill(slot) {
      if (!slot.ready || this._pending !== slot) return;
      this._commit(slot);
      this._prepareStandby();
      if (this._canPlay()) this._start();
    }
    _prepareStandby() {
      if (!this._active || this._pending || this._transitioning || this._warming || this._destroyed) return;
      const index = this._targetIndex();
      if (index < 0) return;
      const spare = this._slots.find(slot => slot !== this._active);
      // Preparing the same source in the other slot is intentional. The visible
      // slot is never seeked, including when only one usable clip exists.
      if (spare.index !== index || spare.source !== this.clips[index].src || !spare.ready || spare.video.currentTime > this._bounds(spare).start + 0.03) {
        if (spare.index === index && !spare.ready && spare.timer !== null) return;
        this._load(spare, index);
      }
    }
    _playSlot(slot) {
      if (!this._canPlay() || !slot.ready) return Promise.resolve(false);
      if (slot.playPromise) return slot.playPromise;
      const token = slot.token;
      const epoch = this._epoch;
      let result;
      try { result = slot.video.play(); } catch (error) { result = Promise.reject(error); }
      const promise = Promise.resolve(result).then(() => {
        if (!this._valid(slot, token, epoch)) return false;
        if (!this._canPlay() || (slot !== this._active && (!this._warming || this._warming.slot !== slot) && (!this._transitioning || this._transitioning.slot !== slot))) { slot.video.pause(); return false; }
        if (slot === this._active) { this._status = 'playing'; this._error = null; this._emit(); }
        return true;
      }).catch(error => {
        if (!this._valid(slot, token, epoch) || (error && error.name === 'AbortError')) return false;
        if (error && error.name === 'NotSupportedError') this._fail(slot, '这一段格式暂时无法播放');
        else { this._error = '点播放后继续陪伴'; this._halt(); }
        return false;
      }).finally(() => { if (slot.playPromise === promise) slot.playPromise = null; });
      slot.playPromise = promise;
      return promise;
    }

    _handoff() {
      if (!this._canPlay() || !this._active || this._warming || this._transitioning || this._pending) return;
      this._prepareStandby();
      const slot = this._slots.find(item => item !== this._active);
      if (!slot.ready || slot.index !== this._targetIndex()) return;
      const warm = { slot, old: this._active, epoch: this._epoch, token: slot.token, decoded: false, playing: false, startTime: slot.video.currentTime };
      this._warming = warm;
      const presented = () => {
        slot.frame = null;
        if (this._warming !== warm || !this._valid(slot, warm.token, warm.epoch)) return;
        if (slot.video.readyState >= 2 && !slot.video.seeking) warm.decoded = true;
        this._maybeFade(warm);
      };
      if (typeof slot.video.requestVideoFrameCallback === 'function') slot.frame = slot.video.requestVideoFrameCallback(presented);
      this._playSlot(slot).then(playing => {
        if (this._warming !== warm) return;
        warm.playing = playing;
        this._maybeFade(warm);
      });
      this._schedule();
    }
    _maybeFade(warm) {
      if (this._warming !== warm || !warm.playing || !warm.decoded || !this._canPlay()) return;
      const slot = warm.slot;
      const old = warm.old;
      this._cancelFrame(slot);
      this._warming = null;
      this._transitioning = warm;
      // Opaque old footage stays underneath until the incoming decoded video
      // has completed its fade. Neither slot is paused during this overlap.
      old.video.style.transition = 'none';
      old.video.style.opacity = '1';
      old.video.style.zIndex = '-2';
      slot.video.style.transition = 'none';
      slot.video.style.opacity = '0';
      slot.video.style.zIndex = '-1';
      slot.video.dataset.playerTransition = 'true';
      void slot.video.offsetWidth;
      const seconds = this._fadeSeconds(old);
      slot.video.style.transition = 'opacity ' + seconds + 's linear';
      slot.video.style.opacity = '1';
      this._fadeTimer = global.setTimeout(() => this._finishTransition(), seconds * 1000 + 20);
    }
    _finishTransition() {
      if (this._fadeTimer !== null) global.clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
      const transition = this._transitioning;
      this._transitioning = null;
      if (!transition || !this._valid(transition.slot, transition.token, transition.epoch)) return;
      this._commit(transition.slot);
      this._prepareStandby();
      this._schedule();
    }
    _schedule() {
      if (this._raf !== null || !this._canPlay() || !this._active) return;
      this._raf = global.requestAnimationFrame(() => {
        this._raf = null;
        if (!this._canPlay() || !this._active) return;
        this._recordProgress(this._active);
        if (this._warming) {
          const warm = this._warming;
          // Safari/older engines without rVFC: wait for advancing decoded media,
          // not merely loadeddata. rVFC-capable engines also get this watchdog.
          if (!warm.decoded && warm.slot.video.readyState >= 2 && !warm.slot.video.seeking && warm.slot.video.currentTime > warm.startTime + 0.035) warm.decoded = true;
          this._maybeFade(warm);
        }
        if (!this._warming && !this._transitioning && !this._pending) {
          this._prepareStandby();
          const remaining = (this._bounds(this._active).end - this._active.video.currentTime) / this._clip(this._active).playbackRate;
          if (remaining <= this._fadeSeconds(this._active) + WARMUP_SECONDS) this._handoff();
        }
        this._schedule();
      });
    }
    _start() {
      if (!this._canPlay() || !this._active) return Promise.resolve(false);
      this._prepareStandby();
      this._schedule();
      const bounds = this._bounds(this._active);
      if (this._active.video.ended || this._active.video.currentTime >= bounds.end) { this._handoff(); return Promise.resolve(true); }
      return this._playSlot(this._active);
    }
    _halt() {
      if (this._active) this._recordProgress(this._active);
      if (this._transitioning) this._finishTransition();
      if (this._warming) { this._cancelFrame(this._warming.slot); this._warming = null; }
      if (this._raf !== null) global.cancelAnimationFrame(this._raf);
      this._raf = null;
      this._slots.forEach(slot => slot.video.pause());
      this._status = 'paused';
      this._emit();
    }
    _switchStill(index) {
      if (index < 0 || this._destroyed) return;
      const slot = this._active ? this._slots.find(item => item !== this._active) : this._slots[0];
      this._pending = slot;
      this._status = 'loading';
      if (slot.index === index && slot.ready && slot.video.currentTime <= this._bounds(slot).start + 0.03) this._commitStill(slot);
      else this._load(slot, index);
    }
    _fail(slot, message) {
      this._failed.add(slot.index);
      this._error = message;
      if (this._warming && (this._warming.slot === slot || this._warming.old === slot)) {
        // Either half can fail while the incoming play promise is unresolved.
        // Retire the entire handoff before reusing either element for recovery.
        this._cancelFrame(this._warming.slot);
        this._warming.slot.video.pause();
        this._warming = null;
      }
      if (this._transitioning) {
        if (this._fadeTimer !== null) global.clearTimeout(this._fadeTimer);
        this._fadeTimer = null;
        this._transitioning.slot.video.pause();
        this._transitioning.slot.video.style.transition = 'none';
        this._transitioning.slot.video.style.opacity = '0';
        this._transitioning.slot.video.dataset.playerTransition = 'false';
        this._transitioning = null;
        if (this._active) { this._active.video.style.opacity = '1'; this._active.video.style.zIndex = '-1'; }
      }
      this._clearSlot(slot);
      const next = this._nextIndex(slot.index);
      if (next < 0) {
        this._pending = null;
        this._halt();
        this._status = 'unavailable';
        if (!this._active) slot.video.style.opacity = slot.video.getAttribute('poster') ? '1' : '0';
        this._emit();
      } else if (this._pending === slot || this._active === slot) {
        if (this._active === slot) this._active = null;
        this._pending = slot;
        this._load(slot, next);
      } else {
        this._load(slot, this._failed.has(this._index) ? next : this._targetIndex());
      }
    }

    setCharacter(character, clips) {
      if (this._destroyed) return this;
      this._halt();
      this._epoch += 1;
      this._slots.forEach(slot => {
        this._clearSlot(slot);
        slot.video.style.opacity = '0';
        slot.video.dataset.playerActive = 'false';
        slot.video.dataset.playerTransition = 'false';
        slot.video.removeAttribute('src');
        slot.video.removeAttribute('poster');
        try { slot.video.load(); } catch (_) {}
        slot.index = -1;
        slot.source = '';
      });
      this.character = String(character || '');
      this.clips = normalizeClips(this.character, clips);
      this._active = null;
      this._pending = null;
      this._index = -1;
      this._failed.clear();
      this._watched = 0;
      this._queuedNext = false;
      this._error = null;
      this._status = this.clips.length ? 'loading' : 'unavailable';
      if (this.clips.length) this._switchStill(0);
      else { this._error = '暂时没有可播放的本地片段'; this._emit(); }
      return this;
    }
    updateClips(clips) {
      if (this._destroyed) return this;
      const normalized = normalizeClips(this.character, clips);
      const index = this._active ? normalized.findIndex(clip => clip.src === this._active.source) : -1;
      if (index < 0) return this.setCharacter(this.character, clips);
      // Preserve the active element/token/timeline when the manifest arrives
      // after its local fallback has already begun playing.
      if (this._transitioning) this._finishTransition();
      const keep = normalized.findIndex(clip => clip.src === this._active.source);
      if (keep < 0) return this.setCharacter(this.character, clips);
      if (this._warming) { this._cancelFrame(this._warming.slot); this._warming.slot.video.pause(); this._warming = null; }
      const spare = this._slots.find(slot => slot !== this._active);
      this._clearSlot(spare);
      spare.index = -1;
      this._pending = null;
      this.clips = normalized;
      this._failed.clear();
      this._index = keep;
      this._active.index = keep;
      this._active.video.dataset.clipId = normalized[keep].id;
      this._active.video.playbackRate = normalized[keep].playbackRate;
      if (normalized[keep].poster) this._active.video.setAttribute('poster', normalized[keep].poster);
      this._prepareStandby();
      this._emit();
      return this;
    }
    next() {
      if (this._destroyed || !this._active || this._pending) return this.getCurrent();
      const next = this._nextIndex(this._index);
      if (next < 0 || next === this._index) return this.getCurrent();
      if (this._canPlay() && !this._active.video.paused) {
        this._queuedNext = true;
        this._prepareStandby();
        this._emit();
      } else {
        this._halt();
        this._switchStill(next);
      }
      return this.getCurrent();
    }
    setMode(mode) {
      if (mode === 'auto' || mode === 'loop') { this._mode = mode; this._prepareStandby(); this._emit(); }
      return this;
    }
    play() {
      if (this._destroyed) return Promise.resolve(false);
      this._wantsPlay = true;
      return this._start();
    }
    pause() {
      if (this._destroyed) return this;
      this._wantsPlay = false;
      this._halt();
      return this;
    }
    setReducedMotion(value) {
      if (this._destroyed) return this;
      const changed = this._reduced !== Boolean(value);
      this._reduced = Boolean(value);
      if (this._reduced) this._halt();
      else if (changed && this._canPlay()) this._start();
      return this;
    }
    getCurrent() {
      const slot = this._active || this._pending;
      const index = slot ? slot.index : this._index;
      return {
        character: this.character, index, clip: this.clips && this.clips[index] ? Object.assign({}, this.clips[index]) : null,
        mode: this._mode, paused: !this._active || this._active.video.paused,
        state: this._destroyed ? 'destroyed' : this._status, reducedMotion: this._reduced,
        nextQueued: this._queuedNext, watchedSeconds: this._watched, error: this._error
      };
    }
    destroy() {
      if (this._destroyed) return;
      this._halt();
      this._destroyed = true;
      this._epoch += 1;
      this.document.removeEventListener('visibilitychange', this._onVisibility);
      this._slots.forEach(slot => {
        this._clearSlot(slot);
        slot.video.removeAttribute('src');
        try { slot.video.load(); } catch (_) {}
        if (slot.video !== this._adopted) slot.video.remove();
      });
      this.container.dataset.playerState = 'destroyed';
      this._active = null;
      this._pending = null;
      this.onClipChange = null;
    }
  }

  global.CompanionScenePlayer = CompanionScenePlayer;
})(window);
