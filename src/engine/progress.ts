import { dayIndex, dayKey } from './dates';
import { INTERVALS, MASTERED_BOX, MAX_BOX, LEVELS, rankOf } from './rules';
import type { AnswerResult, Piece, PieceStat, Progress, Question } from './types';

export const EMPTY_STAT: PieceStat = { box: 0, due: 0, seen: 0, right: 0, wrong: 0, lastWrong: null, pinned: false };

export function emptyProgress(): Progress {
  return {
    v: 1,
    xp: 0,
    pieces: {},
    pinnedComposers: [],
    days: {},
    settings: { dailyGoal: 20, reminder: false, reminderTime: '19:00' },
  };
}

export function statOf(p: Progress, id: string): PieceStat {
  return p.pieces[id] ?? EMPTY_STAT;
}

/**
 * Слабое место: закреплено вручную, после ошибки ещё не набрано два верных
 * ответа в разные дни, или общая точность низкая.
 */
export function isWeak(s: PieceStat): boolean {
  if (s.pinned) return true;
  if (s.seen === 0) return false;
  if (s.wrong > 0 && s.box <= 2) return true;
  return s.seen >= 3 && s.right / s.seen < 0.6;
}

export function isMastered(s: PieceStat): boolean {
  return s.box >= MASTERED_BOX;
}

export function isDue(s: PieceStat, today: number): boolean {
  return s.seen > 0 && s.due <= today;
}

export function xpFor(level: number, combo: number, fast: boolean): number {
  return 10 + level * 2 + Math.min(combo, 5) + (fast ? 3 : 0);
}

export interface AnswerInput {
  question: Question;
  chosenId: string;
  /** Серия верных ответов до этого вопроса. */
  combo: number;
  /** Ответ дан, пока фрагмент ещё звучал. */
  fast: boolean;
  today?: number;
}

export function applyAnswer(p: Progress, a: AnswerInput): { progress: Progress; result: AnswerResult } {
  const today = a.today ?? dayIndex();
  const id = a.question.piece.id;
  const prev = statOf(p, id);
  const correct = a.chosenId === id;
  const rankBefore = rankOf(p.xp);

  // Верный ответ не в срок (досрочный повтор или повтор сразу после ошибки
  // в том же занятии) не продвигает ступень — иначе интервалы теряют смысл.
  const early = prev.seen > 0 && prev.due > today;
  const sameDayFix = prev.lastWrong === today;
  let box: number;
  let due: number;
  if (!correct) {
    box = Math.max(1, Math.min(prev.box, 3) - 2);
    due = today;
  } else if (sameDayFix) {
    box = Math.max(prev.box, 1);
    due = today + 1;
  } else if (early) {
    box = Math.max(prev.box, 1);
    due = prev.due;
  } else {
    box = Math.min(MAX_BOX, prev.box + 1);
    due = today + INTERVALS[box];
  }

  const stat: PieceStat = {
    ...prev,
    box,
    due,
    seen: prev.seen + 1,
    right: prev.right + (correct ? 1 : 0),
    wrong: prev.wrong + (correct ? 0 : 1),
    lastWrong: correct ? prev.lastWrong : today,
  };

  const xp = correct ? xpFor(a.question.level, a.combo, a.fast) : 0;
  const key = dayKey(today);
  const day = p.days[key] ?? { n: 0, ok: 0, xp: 0 };
  const progress: Progress = {
    ...p,
    xp: p.xp + xp,
    pieces: { ...p.pieces, [id]: stat },
    days: { ...p.days, [key]: { n: day.n + 1, ok: day.ok + (correct ? 1 : 0), xp: day.xp + xp } },
  };
  return { progress, result: { correct, xp, rankBefore, rankAfter: rankOf(progress.xp) } };
}

export function togglePin(p: Progress, id: string): Progress {
  const s = statOf(p, id);
  return { ...p, pieces: { ...p.pieces, [id]: { ...s, pinned: !s.pinned } } };
}

export function toggleComposerPin(p: Progress, id: string): Progress {
  const has = p.pinnedComposers.includes(id);
  return { ...p, pinnedComposers: has ? p.pinnedComposers.filter((c) => c !== id) : [...p.pinnedComposers, id] };
}

/** Серия дней подряд с занятиями; сегодняшний пропуск серию ещё не рвёт. */
export function streak(p: Progress, today: number = dayIndex()): number {
  const done = (i: number) => (p.days[dayKey(i)]?.n ?? 0) > 0;
  let i = done(today) ? today : today - 1;
  let n = 0;
  while (done(i)) {
    n++;
    i--;
  }
  return n;
}

export function todayLog(p: Progress, today: number = dayIndex()) {
  return p.days[dayKey(today)] ?? { n: 0, ok: 0, xp: 0 };
}

export function weakPieces(p: Progress, catalog: Piece[]): Piece[] {
  return catalog.filter((x) => isWeak(statOf(p, x.id)) || p.pinnedComposers.includes(x.composer));
}

export function duePieces(p: Progress, catalog: Piece[], today: number = dayIndex()): Piece[] {
  return catalog.filter((x) => isDue(statOf(p, x.id), today));
}

export function mastery(p: Progress, pieces: Piece[]): number {
  if (!pieces.length) return 0;
  const sum = pieces.reduce((acc, x) => acc + Math.min(statOf(p, x.id).box, MASTERED_BOX) / MASTERED_BOX, 0);
  return sum / pieces.length;
}

export function clipSeconds(level: number): number {
  return LEVELS[level - 1].clip;
}

// ---- хранение -------------------------------------------------------------

/**
 * Прогресс хранится через этот интерфейс. Сейчас — localStorage;
 * для синхронизации между устройствами достаточно добавить реализацию
 * поверх серверного API, не трогая остальной код.
 */
export interface ProgressStore {
  load(): Progress | null;
  save(p: Progress): void;
}

const KEY = 'kamerton.progress.v1';

export const localStore: ProgressStore = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  },
  save(p) {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* хранилище недоступно (приватный режим) — работаем в памяти */
    }
  },
};

/** Приводит загруженные или импортированные данные к текущей схеме. */
export function normalize(raw: unknown): Progress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Progress>;
  if (r.v !== 1 || typeof r.xp !== 'number') return null;
  const base = emptyProgress();
  const pieces: Record<string, PieceStat> = {};
  for (const [id, s] of Object.entries(r.pieces ?? {})) pieces[id] = { ...EMPTY_STAT, ...s };
  return {
    v: 1,
    xp: Math.max(0, r.xp),
    pieces,
    pinnedComposers: Array.isArray(r.pinnedComposers) ? r.pinnedComposers : [],
    days: r.days ?? {},
    settings: { ...base.settings, ...(r.settings ?? {}) },
  };
}
