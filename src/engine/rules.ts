import type { Era } from './types';

export const ERAS: { id: Era; name: string; years: string; note: string }[] = [
  { id: 'baroque', name: 'Барокко', years: '1600–1750', note: 'Бах, Вивальди, Гендель' },
  { id: 'classical', name: 'Классицизм', years: '1750–1820', note: 'Моцарт, Гайдн, Бетховен' },
  { id: 'romantic', name: 'Романтизм', years: '1820–1900', note: 'Шопен, Чайковский, Вагнер' },
  { id: 'modern', name: 'Рубеж XX века', years: '1890–1930', note: 'Дебюсси, Равель, Рахманинов' },
];

export const ERA_NAME: Record<Era, string> = Object.fromEntries(ERAS.map((e) => [e.id, e.name])) as Record<Era, string>;

/** Ранги: порог опыта и то, что ранг открывает. */
export const RANKS = [
  { name: 'Слушатель', xp: 0 },
  { name: 'Любитель', xp: 150 },
  { name: 'Меломан', xp: 450 },
  { name: 'Ценитель', xp: 900 },
  { name: 'Знаток', xp: 1600 },
  { name: 'Эрудит', xp: 2600 },
  { name: 'Маэстро', xp: 4000 },
];

/**
 * Уровни сложности вопроса (1–7). Чем выше — тем короче фрагмент,
 * тем чаще он взят из середины произведения, а не из знаменитого начала.
 */
export const LEVELS = [
  { clip: 15, body: 0, introJitter: 0 },
  { clip: 12, body: 0, introJitter: 5 },
  { clip: 10, body: 0.4, introJitter: 8 },
  { clip: 8, body: 0.7, introJitter: 10 },
  { clip: 6, body: 0.9, introJitter: 12 },
  { clip: 5, body: 1, introJitter: 12 },
  { clip: 4, body: 1, introJitter: 12 },
];

/** Интервалы повторения по ступеням, в днях. */
export const INTERVALS = [0, 1, 2, 4, 8, 16, 32];
export const MAX_BOX = INTERVALS.length - 1;
/** С этой ступени произведение считается освоенным. */
export const MASTERED_BOX = 4;

export const SESSION_SIZE = 10;

export function rankOf(xp: number): number {
  let r = 1;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) r = i + 1;
  return r;
}

export function rankProgress(xp: number): { rank: number; name: string; next: number | null; frac: number; left: number } {
  const rank = rankOf(xp);
  const cur = RANKS[rank - 1];
  const nxt = RANKS[rank];
  if (!nxt) return { rank, name: cur.name, next: null, frac: 1, left: 0 };
  return { rank, name: cur.name, next: nxt.xp, frac: (xp - cur.xp) / (nxt.xp - cur.xp), left: nxt.xp - xp };
}

/** Уровень каталога (tier), доступный на ранге. */
export function tierForRank(rank: number): number {
  return Math.min(3, rank);
}

/**
 * Сложность конкретного вопроса: ограничена и рангом, и тем, насколько
 * хорошо усвоено само произведение — новое всегда даётся длинным началом.
 */
export function questionLevel(rank: number, box: number): number {
  return Math.max(1, Math.min(rank, box + 2, LEVELS.length));
}
