(function (global) {
  'use strict';

  const MIN_SCENE_SECONDS = 20;
  const FADE_MS = 750;
  const LOAD_TIMEOUT_MS = 15000;

  function localMediaPath(value, extension) {
    return typeof value === 'string' && value.length <= 2048 &&
      !/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(value) &&
      !value.split(/[\\/]/).includes('..') &&
      !/[\u0000-\u001f]/.test(value) && extension.test(value.split(/[?#]/)[0]);
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
        poster: localMediaPath(clip.poster, /\.(?:jpe?g|png|webp|avif)$/i) ? clip.poster : ''
      });
    }).filter(Boolean);
  }

  /**
   * A quiet local-video scene player. It reuses #characterVideo when supplied,
   * owns only one additional video, and leaves scene layers/controls untouched.
   *
   * next() queues the next complete-scene boundary while playing. When paused,
   * it changes the still preview without starting playback. Short clips repeat
   * until at least 20 seconds have actually played before automatic rotation.
   */
  class CompanionScenePlayer {
    constructor({ container, character, clips, onClipChange, reduceMotion = false } = {}) {
      if (!container || typeof container.querySelector !== 'function') {
        throw new TypeError('CompanionScenePlayer requires a container element');
      }
      this.container = container;
      this.document = container.ownerDocument || global.document;
      this.onClipChange = typeof onClipChange === 'function' ? onClipChange : null;
      this._destroyed = false;
      this._epoch = 0;
      this._fadeTimer = null;
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
      // Inserting beside the primary preserves the existing scene's stacking order.
      primary.parentNode.insertBefore(secondary, primary.nextSibling);
      this._slots = [primary, secondary].map(video => {
        const slot = { video, index: -1, token: 0, ready: false, cleanups: [], timer: null, lastTime: 0, inheritedPoster: video.getAttribute('poster') || '', inheritedCharacter: String(character || '') };
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
        video.style.transition = this._transition();
        video.dataset.playerActive = 'false';
        return slot;
      });
      this._onVisibility = () => {
        if (this.document.hidden) {
          this._slots.forEach(slot => slot.video.pause());
          this._status = 'paused';
          this._emit();
        } else if (this._canPlay() && this._active) {
          this._tryPlay(this._active);
        }
      };
      this.document.addEventListener('visibilitychange', this._onVisibility);
      this.setCharacter(character, clips);
    }

    _transition() { return this._reduced ? 'none' : 'opacity ' + FADE_MS + 'ms ease, filter .8s'; }
    _canPlay() { return !this._destroyed && this._wantsPlay && !this._reduced && !this.document.hidden; }
    _valid(slot, token, epoch) { return !this._destroyed && this._epoch === epoch && slot.token === token; }

    _emit() {
      if (this._destroyed) return;
      this.container.dataset.playerState = this._status;
      if (this.onClipChange) {
        try { this.onClipChange(this.getCurrent()); } catch (error) { if (global.console) global.console.warn('Scene player callback failed', error); }
      }
    }

    _clearSlot(slot) {
      slot.token += 1;
      slot.cleanups.forEach(remove => remove());
      slot.cleanups = [];
      if (slot.timer !== null) global.clearTimeout(slot.timer);
      slot.timer = null;
      slot.ready = false;
      slot.video.pause();
    }

    _listen(slot, name, listener) {
      slot.video.addEventListener(name, listener);
      slot.cleanups.push(() => slot.video.removeEventListener(name, listener));
    }

    _nextIndex(from) {
      if (!this.clips.length) return -1;
      for (let offset = 1; offset <= this.clips.length; offset += 1) {
        const index = (from + offset + this.clips.length) % this.clips.length;
        if (!this._failed.has(index)) return index;
      }
      return -1;
    }

    _recordProgress(slot) {
      if (slot !== this._active) return;
      const time = Number(slot.video.currentTime);
      if (Number.isFinite(time)) {
        // Native seeking is tracked separately; time spent paused/backgrounded
        // never enters the media timeline and therefore never counts here.
        const delta = time - slot.lastTime;
        if (delta > 0 && !slot.video.seeking) this._watched += delta;
        slot.lastTime = time;
      }
    }

    _load(slot, index) {
      this._clearSlot(slot);
      const token = slot.token;
      const epoch = this._epoch;
      const video = slot.video;
      const clip = this.clips[index];
      if (!clip) return;
      slot.index = index;
      slot.lastTime = 0;
      video.dataset.clipId = clip.id;
      video.dataset.character = this.character;
      video.style.opacity = '0';
      video.style.transition = this._transition();
      video.dataset.playerActive = 'false';
      const poster = clip.poster || (slot === this._slots[0] && this.character === slot.inheritedCharacter ? slot.inheritedPoster : '');
      if (poster) video.setAttribute('poster', poster); else video.removeAttribute('poster');
      const expected = new URL(clip.src, this.document.baseURI || global.location.href).href;
      const currentSource = () => !video.currentSrc || video.currentSrc === expected;
      const ready = () => {
        if (!this._valid(slot, token, epoch) || !currentSource() || video.readyState < 2) return;
        slot.ready = true;
        if (slot.timer !== null) global.clearTimeout(slot.timer);
        slot.timer = null;
        if (this._pending === slot) this._activate(slot);
      };
      this._listen(slot, 'loadeddata', ready);
      this._listen(slot, 'canplay', ready);
      this._listen(slot, 'error', () => {
        if (this._valid(slot, token, epoch) && currentSource()) this._fail(slot, '这一段暂时无法播放');
      });
      this._listen(slot, 'timeupdate', () => {
        if (this._valid(slot, token, epoch)) this._recordProgress(slot);
      });
      this._listen(slot, 'seeking', () => { slot.lastTime = Number(video.currentTime) || 0; });
      this._listen(slot, 'seeked', () => { slot.lastTime = Number(video.currentTime) || 0; });
      this._listen(slot, 'ended', () => {
        if (this._valid(slot, token, epoch) && slot === this._active) this._ended(slot);
      });
      slot.timer = global.setTimeout(() => {
        if (this._valid(slot, token, epoch) && !slot.ready) this._fail(slot, '片段载入超时，已尝试下一段');
      }, LOAD_TIMEOUT_MS);
      video.src = clip.src;
      try { video.load(); } catch (_) { this._fail(slot, '这一段暂时无法载入'); }
      if (video.readyState >= 2 && currentSource()) ready();
    }

    _activate(slot) {
      if (this._destroyed || !slot.ready || this._pending !== slot) return;
      if (this._fadeTimer !== null) global.clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
      const old = this._active;
      this._active = slot;
      this._pending = null;
      this._index = slot.index;
      this._watched = 0;
      this._queuedNext = false;
      this._error = null;
      slot.lastTime = Number(slot.video.currentTime) || 0;
      this._slots.forEach(item => {
        item.video.style.transition = this._transition();
        item.video.dataset.playerActive = String(item === slot);
        item.video.style.opacity = item === slot ? '1' : '0';
      });
      if (old && old !== slot) old.video.pause();
      this._status = 'paused';
      this._emit();
      if (this._canPlay()) this._tryPlay(slot);
      const epoch = this._epoch;
      this._fadeTimer = global.setTimeout(() => {
        this._fadeTimer = null;
        if (!this._destroyed && epoch === this._epoch) this._preloadNext();
      }, old && !this._reduced ? FADE_MS + 30 : 0);
    }

    _preloadNext() {
      if (!this._active || this._pending || this.clips.length < 2) return;
      const index = this._nextIndex(this._index);
      if (index < 0 || index === this._index) return;
      const standby = this._slots.find(slot => slot !== this._active);
      if (standby.index !== index || !standby.ready) this._load(standby, index);
    }

    _tryPlay(slot) {
      if (!this._canPlay() || slot !== this._active || !slot.ready) return Promise.resolve(false);
      const token = slot.token;
      const epoch = this._epoch;
      let result;
      try { result = slot.video.play(); } catch (error) { result = Promise.reject(error); }
      return Promise.resolve(result).then(() => {
        if (!this._valid(slot, token, epoch) || slot !== this._active) return false;
        if (!this._canPlay()) { slot.video.pause(); return false; }
        this._status = 'playing';
        this._error = null;
        this._emit();
        return true;
      }).catch(error => {
        if (!this._valid(slot, token, epoch) || slot !== this._active) return false;
        if (error && error.name === 'AbortError') return false;
        if (error && error.name === 'NotSupportedError') {
          this._fail(slot, '这一段格式暂时无法播放');
        } else {
          // Autoplay may be disallowed. Keep the poster/decoded first frame,
          // and allow a later explicit play() call to retry after a user click.
          this._status = 'paused';
          this._error = '点播放后继续陪伴';
          this._emit();
        }
        return false;
      });
    }

    _repeat(slot) {
      try { slot.video.currentTime = 0; slot.lastTime = 0; } catch (_) { return this._fail(slot, '无法重新播放这一段'); }
      return this._canPlay() ? this._tryPlay(slot) : Promise.resolve(false);
    }

    _ended(slot) {
      this._recordProgress(slot);
      if (!this._canPlay()) { this._status = 'paused'; this._emit(); return; }
      if (!(Number(slot.video.duration) > 0)) { this._fail(slot, '片段时长无效'); return; }
      const readyForChange = this._watched >= MIN_SCENE_SECONDS;
      const shouldAdvance = readyForChange && (this._mode === 'auto' || this._queuedNext);
      const next = this._nextIndex(this._index);
      if (shouldAdvance && next >= 0 && next !== this._index) this._switchTo(next);
      else this._repeat(slot);
    }

    _switchTo(index) {
      if (this._destroyed || index < 0) return;
      if (this._fadeTimer !== null) global.clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
      const slot = this._active ? this._slots.find(item => item !== this._active) : this._slots[0];
      this._pending = slot;
      this._status = 'loading';
      // Keep the outgoing last frame visible while the next clip is loading.
      if (slot.index === index && slot.ready) this._activate(slot);
      else this._load(slot, index);
    }

    _fail(slot, message) {
      this._failed.add(slot.index);
      const wasPending = this._pending === slot;
      const wasActive = this._active === slot;
      this._clearSlot(slot);
      this._error = message;
      const next = this._nextIndex(slot.index);
      if (next < 0) {
        this._pending = null;
        this._status = 'unavailable';
        this._slots.forEach(item => item.video.pause());
        // A supplied local poster, or the scene's existing background, remains.
        if (!this._active) slot.video.style.opacity = slot.video.getAttribute('poster') ? '1' : '0';
        this._emit();
        return;
      }
      if (wasPending || wasActive) {
        this._pending = slot;
        if (wasActive) this._active = null;
        this._load(slot, next);
      } else {
        const nextUsable = this._nextIndex(this._index);
        if (nextUsable !== this._index && nextUsable >= 0) this._load(slot, nextUsable);
      }
    }

    setCharacter(character, clips) {
      if (this._destroyed) return this;
      this._epoch += 1;
      if (this._fadeTimer !== null) global.clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
      this._slots.forEach(slot => {
        this._clearSlot(slot);
        slot.video.style.opacity = '0';
        slot.video.dataset.playerActive = 'false';
        slot.video.removeAttribute('src');
        slot.video.removeAttribute('poster');
        try { slot.video.load(); } catch (_) {}
        slot.index = -1;
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
      if (this.clips.length) this._switchTo(0);
      else { this._error = '暂时没有可播放的本地片段'; this._emit(); }
      return this;
    }

    next() {
      if (this._destroyed || !this.clips.length) return this.getCurrent();
      if (!this._active || this._pending) return this.getCurrent();
      if (this._canPlay() && !this._active.video.paused && !this._active.video.ended) {
        this._queuedNext = true;
        this._emit();
      } else {
        const next = this._nextIndex(this._index);
        if (next >= 0 && next !== this._index) this._switchTo(next);
      }
      return this.getCurrent();
    }

    setMode(mode) {
      if (mode === 'auto' || mode === 'loop') { this._mode = mode; this._emit(); }
      return this;
    }

    play() {
      if (this._destroyed) return Promise.resolve(false);
      this._wantsPlay = true;
      if (!this._canPlay() || !this._active) return Promise.resolve(false);
      if (this._active.video.ended) return this._repeat(this._active);
      return this._tryPlay(this._active);
    }

    pause() {
      if (this._destroyed) return this;
      this._wantsPlay = false;
      if (this._active) this._recordProgress(this._active);
      this._slots.forEach(slot => slot.video.pause());
      this._status = 'paused';
      this._emit();
      return this;
    }

    setReducedMotion(value) {
      if (this._destroyed) return this;
      this._reduced = Boolean(value);
      this._slots.forEach(slot => { slot.video.style.transition = this._transition(); });
      if (this._reduced) {
        if (this._active) this._recordProgress(this._active);
        this._slots.forEach(slot => slot.video.pause());
        this._status = 'paused';
        this._emit();
      } else if (this._canPlay() && this._active) this._tryPlay(this._active);
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
      this._destroyed = true;
      this._epoch += 1;
      if (this._fadeTimer !== null) global.clearTimeout(this._fadeTimer);
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
