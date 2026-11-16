import { useSyncExternalStore } from 'react';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'ended' | 'error';

export interface PlayerState {
  status: PlayerStatus;
  /** Что сейчас загружено — чтобы экраны отличали свой фрагмент от чужого. */
  tag: string | null;
}

// Короткая тишина: проигрывается по нажатию, чтобы iOS разрешил звук дальше.
const SILENCE =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const LOAD_TIMEOUT = 15000;
const FADE = 0.35;

class ClipPlayer {
  private el: HTMLAudioElement | null = null;
  private token = 0;
  private raf = 0;
  private timeout = 0;
  private start = 0;
  private end: number | null = null;
  private state: PlayerState = { status: 'idle', tag: null };
  private listeners = new Set<() => void>();

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getState = () => this.state;

  private set(status: PlayerStatus, tag: string | null = this.state.tag) {
    if (this.state.status === status && this.state.tag === tag) return;
    this.state = { status, tag };
    this.listeners.forEach((l) => l());
  }

  private audio(): HTMLAudioElement {
    if (!this.el) {
      this.el = new Audio();
      this.el.preload = 'auto';
    }
    return this.el;
  }

  /** Вызывать из обработчика нажатия перед первым воспроизведением. */
  unlock() {
    const el = this.audio();
    if (this.state.status === 'playing' || this.state.status === 'loading') return;
    el.src = SILENCE;
    el.play().catch(() => {});
  }

  /**
   * Играет фрагмент [start, start + duration). duration = null — до конца записи.
   */
  play(tag: string, src: string, start: number, duration: number | null) {
    const el = this.audio();
    const token = ++this.token;
    this.clearTimers();
    this.start = start;
    this.end = duration === null ? null : start + duration;
    this.set('loading', tag);

    const fail = () => {
      if (token !== this.token) return;
      this.clearTimers();
      el.pause();
      this.set('error');
    };
    const begin = () => {
      if (token !== this.token) return;
      el.volume = 0;
      el.play().then(() => {
        if (token !== this.token) return;
        window.clearTimeout(this.timeout);
        this.set('playing');
        this.tick(token);
      }, fail);
    };

    el.pause();
    el.onerror = fail;
    el.onended = () => token === this.token && this.finish();
    // requestAnimationFrame замирает в фоновой вкладке — конец фрагмента страхуем событием плеера.
    el.ontimeupdate = () => {
      if (token === this.token && this.state.status === 'playing' && this.end !== null && el.currentTime >= this.end) this.finish();
    };
    el.onloadedmetadata = () => {
      if (token !== this.token) return;
      if (start > 0.05) {
        el.onseeked = () => {
          el.onseeked = null;
          begin();
        };
        el.currentTime = start;
      } else begin();
    };
    el.src = src;
    el.load();
    this.timeout = window.setTimeout(fail, LOAD_TIMEOUT);
  }

  /** Продолжить после конца фрагмента — «дослушать». */
  extend(seconds: number) {
    const el = this.el;
    if (!el || this.state.status === 'idle' || this.state.status === 'error' || this.state.status === 'loading') return;
    const token = this.token;
    this.end = el.currentTime + seconds;
    this.start = el.currentTime;
    if (el.paused) {
      el.volume = 0;
      el.play().then(() => {
        if (token !== this.token) return;
        this.set('playing');
        this.tick(token);
      }, () => {});
    }
  }

  stop() {
    this.token++;
    this.clearTimers();
    this.el?.pause();
    this.set('idle', null);
  }

  /** Доля прозвучавшего фрагмента, 0..1. */
  progress(): number {
    const el = this.el;
    if (!el || this.end === null) return 0;
    if (this.state.status === 'ended') return 1;
    if (this.state.status !== 'playing') return 0;
    return Math.max(0, Math.min(1, (el.currentTime - this.start) / (this.end - this.start)));
  }

  /** Позиция в записи, секунды (для библиотеки). */
  position(): number {
    return this.el?.currentTime ?? 0;
  }

  private tick(token: number) {
    const el = this.el!;
    const step = () => {
      if (token !== this.token) return;
      const t = el.currentTime;
      const sinceStart = t - this.start;
      const untilEnd = this.end === null ? Infinity : this.end - t;
      el.volume = Math.max(0, Math.min(1, sinceStart / FADE, untilEnd / FADE));
      if (untilEnd <= 0) {
        this.finish();
        return;
      }
      this.raf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(step);
  }

  private finish() {
    this.clearTimers();
    this.el?.pause();
    this.set('ended');
  }

  private clearTimers() {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.timeout);
  }
}

export const player = new ClipPlayer();

export function usePlayer(): PlayerState {
  return useSyncExternalStore(player.subscribe, player.getState);
}
