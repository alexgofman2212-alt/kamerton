import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PIECES, composerOf } from '../data/catalog';
import { player, usePlayer } from '../engine/player';
import { applyAnswer, statOf } from '../engine/progress';
import { buildSession, makeQuestion, scopeOf, type Planned } from '../engine/quiz';
import { ERA_NAME, rankOf } from '../engine/rules';
import { getProgress, setProgress } from '../engine/store';
import type { Mode, Piece, Question } from '../engine/types';
import { IconCheck, IconClose, IconReplay } from '../ui/icons';
import { Orb } from '../ui/parts';

export interface Summary {
  total: number;
  correct: number;
  xp: number;
  rankBefore: number;
  rankAfter: number;
  mistakes: { piece: Piece; chosen: Piece }[];
  learned: Piece[];
}

const REASON: Record<Question['reason'], string> = {
  new: 'Новое',
  review: 'Повторение',
  weak: 'Слабое место',
  practice: 'Практика',
};

/** После ошибки произведение возвращается в конец занятия — но не бесконечно. */
const MAX_EXTRA = 3;
const TAG = 'quiz';

export function Quiz({ mode, onExit, onDone }: { mode: Mode; onExit: () => void; onDone: (s: Summary) => void }) {
  const pool = useMemo(() => {
    const scope = scopeOf(mode, getProgress(), PIECES);
    return scope.length >= 8 ? scope : PIECES;
  }, [mode]);
  const [queue, setQueue] = useState<Planned[]>(() => buildSession(mode, getProgress(), PIECES));
  const [idx, setIdx] = useState(0);
  const [question, setQuestion] = useState<Question | null>(() => (queue[0] ? makeQuestion(queue[0], getProgress(), pool) : null));
  const [chosen, setChosen] = useState<string | null>(null);
  const [gained, setGained] = useState(0);
  const [marks, setMarks] = useState<(boolean | null)[]>([]);
  const ps = usePlayer();

  const combo = useRef(0);
  const replayed = useRef(false);
  const extra = useRef(0);
  const summary = useRef<Summary>({ total: 0, correct: 0, xp: 0, rankBefore: rankOf(getProgress().xp), rankAfter: 0, mistakes: [], learned: [] });

  const playClip = useCallback((q: Question) => player.play(TAG, q.piece.rec.src, q.start, q.clip), []);

  useEffect(() => {
    if (question) playClip(question);
  }, [question, playClip]);
  useEffect(() => () => player.stop(), []);

  const answer = useCallback(
    (id: string) => {
      if (!question || chosen) return;
      const before = getProgress();
      const wasNew = statOf(before, question.piece.id).seen === 0;
      const fast = !replayed.current && ps.tag === TAG && ps.status === 'playing';
      const { progress, result } = applyAnswer(before, { question, chosenId: id, combo: combo.current, fast });
      setProgress(progress);
      combo.current = result.correct ? combo.current + 1 : 0;
      setChosen(id);
      setGained(result.xp);
      setMarks((m) => [...m, result.correct]);

      const s = summary.current;
      s.total++;
      s.xp += result.xp;
      if (result.correct) {
        s.correct++;
        if (wasNew) s.learned.push(question.piece);
      } else {
        s.mistakes.push({ piece: question.piece, chosen: PIECES.find((x) => x.id === id)! });
        if (extra.current < MAX_EXTRA) {
          extra.current++;
          setQueue((q) => [...q, { piece: question.piece, reason: 'weak' }]);
        }
      }
      // Ответ дан — пусть музыка звучит дальше, это и есть обучение.
      if (ps.tag === TAG && ps.status === 'playing') player.extend(25);
    },
    [question, chosen, ps],
  );

  const next = useCallback(() => {
    if (idx + 1 >= queue.length) {
      const s = summary.current;
      s.rankAfter = rankOf(getProgress().xp);
      player.stop();
      onDone(s);
      return;
    }
    if (!chosen) setMarks((m) => [...m, null]); // пропуск из-за ошибки загрузки
    replayed.current = false;
    setChosen(null);
    setIdx(idx + 1);
    setQuestion(makeQuestion(queue[idx + 1], getProgress(), pool));
  }, [idx, queue, pool, onDone, chosen]);

  const replay = useCallback(() => {
    if (!question) return;
    replayed.current = true;
    playClip(question);
  }, [question, playClip]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!question) return;
      if (!chosen && e.key >= '1' && e.key <= String(question.options.length)) answer(question.options[Number(e.key) - 1].id);
      else if (chosen && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      } else if (!chosen && e.key.toLowerCase() === 'r') replay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, chosen, answer, next, replay]);

  if (!question) {
    return (
      <div className="quiz">
        <div className="quiz-top">
          <button className="icon-btn" onClick={onExit} aria-label="Закрыть">
            <IconClose />
          </button>
        </div>
        <div className="empty" style={{ margin: 'auto' }}>
          <div className="display">Пока нечего тренировать</div>
          <p>В этом режиме ещё нет произведений.</p>
        </div>
      </div>
    );
  }

  const piece = question.piece;
  const composer = composerOf(piece.composer);
  const correct = chosen === piece.id;
  const mine = ps.tag === TAG;
  const failed = mine && ps.status === 'error';
  const last = idx + 1 >= queue.length;

  return (
    <div className="quiz">
      <div className="quiz-top">
        <button className="icon-btn" onClick={onExit} aria-label="Завершить занятие">
          <IconClose />
        </button>
        <div className="steps" role="progressbar" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={idx + 1} aria-label="Ход занятия">
          {queue.map((_, i) => (
            <i key={i} className={i < marks.length ? (marks[i] === null ? '' : marks[i] ? 'ok' : 'bad') : i === idx ? 'cur' : ''} />
          ))}
        </div>
        <span className="small muted" style={{ minWidth: 36, textAlign: 'right' }}>
          {idx + 1}/{queue.length}
        </span>
      </div>

      <div className="stage">
        <Orb small={!!chosen} countdown={!chosen} />
        {chosen ? (
          <div className="reveal" aria-live="polite">
            <div className={`verdict ${correct ? 'ok' : 'bad'}`}>{correct ? `Верно · +${gained} опыта` : 'Не угадали — это было'}</div>
            <h2 className="display">{piece.title}</h2>
            <p className="muted small">
              {composer.full}
              {piece.part ? ` · ${piece.part}` : ''}
            </p>
            <p className="muted small">
              {ERA_NAME[piece.era]}
              {piece.year ? ` · ${piece.year}` : ''}
            </p>
          </div>
        ) : (
          <>
            <div className="row" style={{ gap: 8 }}>
              <span className={`chip ${question.reason === 'weak' ? 'bad' : question.reason === 'new' ? 'gold' : ''}`}>{REASON[question.reason]}</span>
              <span className="chip">{question.clip} с</span>
            </div>
            <p className="hint" aria-live="polite">
              {failed
                ? 'Не удалось загрузить запись'
                : ps.status === 'loading'
                  ? 'Загружаем запись…'
                  : ps.status === 'playing'
                    ? 'Что звучит?'
                    : 'Фрагмент прозвучал. Что это было?'}
            </p>
            {failed ? (
              <div className="row">
                <button className="btn compact" style={{ width: 'auto' }} onClick={() => playClip(question)}>
                  Повторить
                </button>
                <button className="btn compact ghost" style={{ width: 'auto' }} onClick={next}>
                  Пропустить
                </button>
              </div>
            ) : (
              mine &&
              ps.status === 'ended' && (
                <button className="btn compact ghost" style={{ width: 'auto' }} onClick={replay}>
                  <IconReplay width={18} height={18} />
                  Ещё раз
                </button>
              )
            )}
          </>
        )}
      </div>

      <div className="options">
        {question.options.map((o, i) => {
          const isRight = !!chosen && o.id === piece.id;
          const isWrong = chosen === o.id && !correct;
          const cls = !chosen ? '' : isRight ? 'right' : isWrong ? 'wrong' : 'dim';
          return (
            <button key={o.id} className={`opt ${cls}`} disabled={!!chosen} onClick={() => answer(o.id)}>
              <span className="key">{isRight ? <IconCheck /> : isWrong ? <IconClose /> : i + 1}</span>
              <span className="grow">
                <span className="t" style={{ display: 'block' }}>
                  {o.title}
                </span>
                <span className="s" style={{ display: 'block' }}>
                  {composerOf(o.composer).name}
                  {o.part ? ` · ${o.part}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="quiz-foot">
        {chosen && (
          <button className="btn primary" onClick={next} autoFocus>
            {last ? 'Итоги' : 'Дальше'}
          </button>
        )}
      </div>
    </div>
  );
}
