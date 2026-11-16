import { dayIndex } from './dates';
import { isDue, isWeak, statOf } from './progress';
import { LEVELS, SESSION_SIZE, questionLevel, rankOf, tierForRank } from './rules';
import type { Mode, Piece, Progress, Question, Reason } from './types';

export type Rng = () => number;

export const OPTION_COUNT = 5;

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Взвешенная выборка без возвращения. */
function pickWeighted<T>(items: T[], weight: (x: T) => number, n: number, rng: Rng): T[] {
  const pool = items.map((x) => ({ x, w: Math.max(0, weight(x)) })).filter((e) => e.w > 0);
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, e) => s + e.w, 0);
    let r = rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].w;
      if (r <= 0) break;
    }
    out.push(pool[i].x);
    pool.splice(i, 1);
  }
  return out;
}

/** Произведения, доступные в режиме. */
export function scopeOf(mode: Mode, p: Progress, catalog: Piece[]): Piece[] {
  switch (mode.type) {
    case 'daily': {
      const tier = tierForRank(rankOf(p.xp));
      // Уже начатое не пропадает, даже если относится к ещё закрытому уровню.
      return catalog.filter((x) => x.tier <= tier || statOf(p, x.id).seen > 0);
    }
    case 'era':
      return catalog.filter((x) => x.era === mode.era);
    case 'composers':
      return catalog.filter((x) => mode.ids.includes(x.composer));
    case 'weak':
      return catalog.filter((x) => isWeak(statOf(p, x.id)) || p.pinnedComposers.includes(x.composer));
  }
}

export interface Planned {
  piece: Piece;
  reason: Reason;
}

/**
 * Составляет очередь занятия: сначала то, что пора повторить и что даётся
 * плохо, затем немного нового, остальное — практика усвоенного.
 */
export function buildSession(
  mode: Mode,
  p: Progress,
  catalog: Piece[],
  rng: Rng = Math.random,
  today: number = dayIndex(),
  size: number = SESSION_SIZE,
): Planned[] {
  const scope = scopeOf(mode, p, catalog);
  if (!scope.length) return [];

  const weak: Piece[] = [];
  const due: Piece[] = [];
  const fresh: Piece[] = [];
  const rest: Piece[] = [];
  for (const x of shuffle(scope, rng)) {
    const s = statOf(p, x.id);
    if (s.seen === 0) fresh.push(x);
    else if (isWeak(s)) weak.push(x);
    else if (isDue(s, today)) due.push(x);
    else rest.push(x);
  }
  due.sort((a, b) => statOf(p, a.id).due - statOf(p, b.id).due);
  fresh.sort((a, b) => a.tier - b.tier);
  rest.sort((a, b) => statOf(p, a.id).due - statOf(p, b.id).due);

  const plan: Planned[] = [];
  const take = (src: Piece[], n: number, reason: Reason) => {
    for (const piece of src.splice(0, Math.max(0, n))) plan.push({ piece, reason });
  };

  if (mode.type === 'weak') {
    take(weak, size, 'weak');
    take(due, size - plan.length, 'review');
    take(fresh, size - plan.length, 'new');
    take(rest, size - plan.length, 'weak');
  } else {
    const newQuota = mode.type === 'daily' ? Math.min(4, Math.max(2, size - weak.length - due.length)) : size;
    take(weak, 3, 'weak');
    take(due, size - plan.length - Math.min(newQuota, fresh.length, 2), 'review');
    take(fresh, Math.min(newQuota, size - plan.length), 'new');
    take(weak, size - plan.length, 'weak');
    take(due, size - plan.length, 'review');
    take(rest, size - plan.length, 'practice');
    take(fresh, size - plan.length, 'new');
  }

  // Маленький набор: добираем повторами, но не подряд.
  const unique = plan.length;
  let i = 0;
  while (plan.length < size && unique > 1 && plan.length < unique * 3) {
    plan.push({ ...plan[i % unique] });
    i++;
  }
  return spread(shuffle(plan, rng));
}

/** Разводит одинаковые произведения, чтобы они не шли подряд. */
function spread(plan: Planned[]): Planned[] {
  for (let i = 1; i < plan.length; i++) {
    if (plan[i].piece.id !== plan[i - 1].piece.id) continue;
    const j = plan.findIndex((x, k) => k > i && x.piece.id !== plan[i].piece.id && (k + 1 >= plan.length || plan[k + 1].piece.id !== plan[i].piece.id));
    if (j > 0) [plan[i], plan[j]] = [plan[j], plan[i]];
  }
  return plan;
}

/** Выбирает начало фрагмента. */
export function pickStart(piece: Piece, level: number, rng: Rng): number {
  const cfg = LEVELS[level - 1];
  const last = Math.max(piece.intro, piece.rec.duration - cfg.clip - 1.5);
  let start: number;
  if (piece.spots.length && rng() < cfg.body) {
    const spot = piece.spots[Math.floor(rng() * piece.spots.length)];
    start = spot + (rng() * 4 - 2);
  } else {
    start = piece.intro + rng() * cfg.introJitter;
  }
  return Math.round(Math.max(piece.intro, Math.min(start, last)) * 10) / 10;
}

/**
 * Неверные варианты. На низких уровнях они намеренно далеки от ответа
 * (другая эпоха, другой состав), на высоких — та же эпоха, тот же
 * композитор и тот же состав исполнителей.
 */
export function pickDistractors(piece: Piece, level: number, pool: Piece[], rng: Rng, n = OPTION_COUNT - 1): Piece[] {
  const t = (level - 1) / (LEVELS.length - 1); // 0..1
  const weight = (x: Piece) => {
    if (x.id === piece.id) return 0;
    let w = 1;
    w *= x.era === piece.era ? 1 + 6 * t : 1 + 1.5 * (1 - t);
    w *= x.kind === piece.kind ? 1 + 4 * t : 1 + 1 * (1 - t);
    if (x.composer === piece.composer) w *= level >= 3 ? 1 + 5 * t : 0.6;
    return w;
  };
  return pickWeighted(pool, weight, n, rng);
}

export function makeQuestion(plan: Planned, p: Progress, catalog: Piece[], rng: Rng = Math.random): Question {
  const { piece, reason } = plan;
  const level = questionLevel(rankOf(p.xp), statOf(p, piece.id).box);
  const options = shuffle([piece, ...pickDistractors(piece, level, catalog, rng)], rng);
  return { piece, reason, level, start: pickStart(piece, level, rng), clip: LEVELS[level - 1].clip, options };
}
