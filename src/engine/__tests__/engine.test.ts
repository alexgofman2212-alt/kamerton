import { describe, expect, it } from 'vitest';
import { applyAnswer, emptyProgress, isWeak, normalize, statOf, streak, weakPieces } from '../progress';
import { buildSession, makeQuestion, pickDistractors, pickStart, OPTION_COUNT } from '../quiz';
import { INTERVALS, LEVELS, RANKS, questionLevel, rankOf, tierForRank } from '../rules';
import type { Era, Kind, Piece, Progress, Question } from '../types';
import { dayKey } from '../dates';

function rng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const ERAS: Era[] = ['baroque', 'classical', 'romantic', 'modern'];
const KINDS: Kind[] = ['orchestra', 'piano', 'vocal'];
const catalog: Piece[] = Array.from({ length: 40 }, (_, i) => ({
  id: `p${i}`,
  composer: `c${i % 10}`,
  title: `Piece ${i}`,
  era: ERAS[i % 4],
  kind: KINDS[i % 3],
  tier: ((i % 3) + 1) as 1 | 2 | 3,
  rec: { src: `x${i}.mp3`, duration: 200, license: 'CC0', artist: 'a', page: 'p' },
  intro: 1,
  spots: [60, 90, 120, 150],
}));

const q = (piece: Piece, level = 1): Question => ({ piece, reason: 'new', level, start: 0, clip: 15, options: [] });
const TODAY = 20000;

function answer(p: Progress, piece: Piece, ok: boolean, today = TODAY) {
  return applyAnswer(p, { question: q(piece), chosenId: ok ? piece.id : 'other', combo: 0, fast: false, today });
}

describe('ранги и сложность', () => {
  it('ранг растёт с опытом и не выходит за пределы', () => {
    expect(rankOf(0)).toBe(1);
    expect(rankOf(RANKS[1].xp - 1)).toBe(1);
    expect(rankOf(RANKS[1].xp)).toBe(2);
    expect(rankOf(10 ** 6)).toBe(RANKS.length);
  });
  it('фрагменты укорачиваются с уровнем: от 15 с до 5 с и меньше', () => {
    expect(LEVELS[0].clip).toBe(15);
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].clip).toBeLessThan(LEVELS[i - 1].clip);
    expect(LEVELS[LEVELS.length - 2].clip).toBe(5);
  });
  it('новое произведение даётся легко даже на высшем ранге', () => {
    expect(questionLevel(7, 0)).toBe(2);
    expect(questionLevel(7, 6)).toBe(7);
    expect(questionLevel(1, 6)).toBe(1);
  });
  it('каталог открывается по рангам', () => {
    expect(tierForRank(1)).toBe(1);
    expect(tierForRank(5)).toBe(3);
  });
});

describe('интервальное повторение', () => {
  it('верный ответ поднимает ступень и откладывает повторение', () => {
    const { progress, result } = answer(emptyProgress(), catalog[0], true);
    const s = statOf(progress, 'p0');
    expect(result.correct).toBe(true);
    expect(result.xp).toBeGreaterThan(0);
    expect(s.box).toBe(1);
    expect(s.due).toBe(TODAY + INTERVALS[1]);
  });
  it('ошибка возвращает к началу и помечает слабым местом', () => {
    let p = emptyProgress();
    for (let d = 0; d < 4; d++) p = answer(p, catalog[0], true, TODAY + d * 40).progress;
    expect(statOf(p, 'p0').box).toBe(4);
    const { progress, result } = answer(p, catalog[0], false, TODAY + 200);
    expect(result.xp).toBe(0);
    expect(statOf(progress, 'p0').box).toBe(1);
    expect(statOf(progress, 'p0').due).toBe(TODAY + 200);
    expect(isWeak(statOf(progress, 'p0'))).toBe(true);
    expect(weakPieces(progress, catalog).map((x) => x.id)).toEqual(['p0']);
  });
  it('повтор раньше срока не накручивает ступень', () => {
    let p = answer(emptyProgress(), catalog[0], true).progress;
    const due = statOf(p, 'p0').due;
    p = answer(p, catalog[0], true).progress;
    expect(statOf(p, 'p0').box).toBe(1);
    expect(statOf(p, 'p0').due).toBe(due);
  });
  it('исправление ошибки в том же занятии не снимает слабое место', () => {
    let p = answer(emptyProgress(), catalog[0], false).progress;
    p = answer(p, catalog[0], true).progress;
    const s = statOf(p, 'p0');
    expect(s.box).toBe(1);
    expect(s.due).toBe(TODAY + 1);
    expect(isWeak(s)).toBe(true);
    p = answer(p, catalog[0], true, TODAY + 1).progress;
    expect(isWeak(statOf(p, 'p0'))).toBe(true);
    p = answer(p, catalog[0], true, TODAY + 3).progress;
    expect(isWeak(statOf(p, 'p0'))).toBe(false);
  });
  it('слабое место закрывается после серии верных ответов', () => {
    let p = answer(emptyProgress(), catalog[0], false).progress;
    expect(isWeak(statOf(p, 'p0'))).toBe(true);
    for (let i = 1; i <= 3; i++) p = answer(p, catalog[0], true, TODAY + i * 10).progress;
    expect(isWeak(statOf(p, 'p0'))).toBe(false);
  });
  it('серия дней считается подряд и терпит сегодняшний пропуск', () => {
    const p = emptyProgress();
    for (const d of [TODAY - 3, TODAY - 2, TODAY - 1]) p.days[dayKey(d)] = { n: 5, ok: 4, xp: 50 };
    expect(streak(p, TODAY)).toBe(3);
    expect(streak(p, TODAY + 1)).toBe(0);
  });
});

describe('составление занятия', () => {
  it('новичок получает 10 разных произведений первого уровня', () => {
    const plan = buildSession({ type: 'daily' }, emptyProgress(), catalog, rng(), TODAY);
    expect(plan).toHaveLength(10);
    expect(new Set(plan.map((x) => x.piece.id)).size).toBe(10);
    expect(plan.every((x) => x.piece.tier === 1 && x.reason === 'new')).toBe(true);
  });
  it('слабые места и просроченные повторения идут в занятие первыми', () => {
    let p = emptyProgress();
    p = answer(p, catalog[0], false).progress; // слабое
    p = answer(p, catalog[3], true, TODAY - 5).progress; // пора повторить
    const plan = buildSession({ type: 'daily' }, p, catalog, rng(3), TODAY);
    const reasons = Object.fromEntries(plan.map((x) => [x.piece.id, x.reason]));
    expect(reasons.p0).toBe('weak');
    expect(reasons.p3).toBe('review');
  });
  it('режим эпохи не выходит за эпоху, режим композиторов — за выбранных', () => {
    const era = buildSession({ type: 'era', era: 'romantic' }, emptyProgress(), catalog, rng(), TODAY);
    expect(era.length).toBe(10);
    expect(era.every((x) => x.piece.era === 'romantic')).toBe(true);
    const comp = buildSession({ type: 'composers', ids: ['c1'] }, emptyProgress(), catalog, rng(), TODAY);
    expect(comp.every((x) => x.piece.composer === 'c1')).toBe(true);
    for (let i = 1; i < comp.length; i++) expect(comp[i].piece.id).not.toBe(comp[i - 1].piece.id);
  });
  it('режим слабых мест пуст, пока нет ошибок, и включает закреплённых композиторов', () => {
    expect(buildSession({ type: 'weak' }, emptyProgress(), catalog, rng(), TODAY)).toHaveLength(0);
    const p = { ...emptyProgress(), pinnedComposers: ['c2'] };
    const plan = buildSession({ type: 'weak' }, p, catalog, rng(), TODAY);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((x) => x.piece.composer === 'c2')).toBe(true);
  });
});

describe('вопрос', () => {
  it('пять уникальных вариантов, среди них верный', () => {
    const r = rng(7);
    for (const piece of catalog) {
      const question = makeQuestion({ piece, reason: 'new' }, emptyProgress(), catalog, r);
      expect(question.options).toHaveLength(OPTION_COUNT);
      expect(new Set(question.options.map((o) => o.id)).size).toBe(OPTION_COUNT);
      expect(question.options.some((o) => o.id === piece.id)).toBe(true);
    }
  });
  it('на первом уровне фрагмент начинается с начала, на высоком — из середины', () => {
    const r = rng(5);
    expect(pickStart(catalog[0], 1, r)).toBe(catalog[0].intro);
    for (let i = 0; i < 30; i++) expect(pickStart(catalog[0], 7, r)).toBeGreaterThan(50);
  });
  it('фрагмент не выходит за конец записи', () => {
    const short: Piece = { ...catalog[0], rec: { ...catalog[0].rec, duration: 20 }, spots: [18] };
    const r = rng(9);
    for (let level = 1; level <= 7; level++) {
      const s = pickStart(short, level, r);
      expect(s + LEVELS[level - 1].clip).toBeLessThanOrEqual(20);
    }
  });
  it('на высоком уровне неверные варианты ближе к ответу, чем на низком', () => {
    const piece = catalog[0];
    const share = (level: number) => {
      const r = rng(11);
      let same = 0;
      for (let i = 0; i < 400; i++) same += pickDistractors(piece, level, catalog, r).filter((x) => x.era === piece.era).length;
      return same / 1600;
    };
    expect(share(7)).toBeGreaterThan(share(1) + 0.25);
  });
});

describe('хранение', () => {
  it('отвергает чужие данные и дополняет неполные', () => {
    expect(normalize(null)).toBeNull();
    expect(normalize({ v: 2, xp: 1 })).toBeNull();
    const p = normalize({ v: 1, xp: 30, pieces: { p0: { box: 2 } } })!;
    expect(p.settings.dailyGoal).toBe(20);
    expect(p.pieces.p0.pinned).toBe(false);
    expect(p.pieces.p0.box).toBe(2);
  });
});
