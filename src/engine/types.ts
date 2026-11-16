export type Era = 'baroque' | 'classical' | 'romantic' | 'modern';
export type Kind = 'orchestra' | 'piano' | 'vocal' | 'chamber' | 'organ' | 'solo';

export interface Composer {
  id: string;
  /** Фамилия — так композитор подписан в вариантах ответа. */
  name: string;
  full: string;
  years: string;
  era: Era;
}

export interface Recording {
  /** MP3-поток (играет во всех браузерах, включая Safari). */
  src: string;
  duration: number;
  license: string;
  artist: string;
  /** Страница записи на Wikimedia Commons — для атрибуции. */
  page: string;
}

export interface Piece {
  id: string;
  composer: string;
  title: string;
  part?: string;
  year?: string;
  era: Era;
  kind: Kind;
  /** 1 — самые известные, открыты сразу; 2 и 3 открываются с рангом. */
  tier: 1 | 2 | 3;
  rec: Recording;
  /** Секунда, с которой начинается музыка (тишина в начале пропущена). */
  intro: number;
  /** Громкие, не начальные места записи — для «неочевидных» фрагментов. */
  spots: number[];
}

export interface PieceStat {
  /** Ступень интервального повторения: 0 — не встречалось, 6 — максимум. */
  box: number;
  /** Номер дня, когда произведение нужно повторить. */
  due: number;
  seen: number;
  right: number;
  wrong: number;
  lastWrong: number | null;
  pinned: boolean;
}

export interface DayLog {
  n: number;
  ok: number;
  xp: number;
}

export interface Settings {
  dailyGoal: number;
  reminder: boolean;
  reminderTime: string;
}

export interface Progress {
  v: 1;
  xp: number;
  pieces: Record<string, PieceStat>;
  pinnedComposers: string[];
  days: Record<string, DayLog>;
  settings: Settings;
}

export type Mode =
  | { type: 'daily' }
  | { type: 'era'; era: Era }
  | { type: 'composers'; ids: string[] }
  | { type: 'weak' };

export type Reason = 'new' | 'review' | 'weak' | 'practice';

export interface Question {
  piece: Piece;
  reason: Reason;
  level: number;
  start: number;
  clip: number;
  options: Piece[];
}

export interface AnswerResult {
  correct: boolean;
  xp: number;
  rankBefore: number;
  rankAfter: number;
}
