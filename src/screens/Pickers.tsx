import { useState } from 'react';
import { COMPOSERS, PIECES, piecesBy } from '../data/catalog';
import { isWeak, mastery, statOf, toggleComposerPin, togglePin } from '../engine/progress';
import { ERAS } from '../engine/rules';
import { setProgress, useProgress } from '../engine/store';
import type { Mode } from '../engine/types';
import { IconBack, IconCheck, IconChevron, IconPin } from '../ui/icons';
import { Dots, ListenButton, Monogram, pieceLine, plural } from '../ui/parts';

function Top({ title, back }: { title: string; back: () => void }) {
  return (
    <div className="topbar">
      <button className="icon-btn" onClick={back} aria-label="Назад">
        <IconBack />
      </button>
      <h1>{title}</h1>
    </div>
  );
}

export function Eras({ start, back }: { start: (m: Mode) => void; back: () => void }) {
  const p = useProgress();
  return (
    <div className="screen no-tabs">
      <Top title="По эпохам" back={back} />
      <div className="stack">
        {ERAS.map((e) => {
          const pieces = PIECES.filter((x) => x.era === e.id);
          return (
            <button key={e.id} className={`card era-card era-${e.id}`} onClick={() => start({ type: 'era', era: e.id })} disabled={!pieces.length}>
              <span className="grow">
                <span className="eyebrow">{e.years}</span>
                <h3>{e.name}</h3>
                <span className="small muted">
                  {e.note} · {pieces.length} {plural(pieces.length, 'произведение', 'произведения', 'произведений')}
                </span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span className="pct">{Math.round(mastery(p, pieces) * 100)}%</span>
                <span className="small muted" style={{ display: 'block' }}>
                  усвоено
                </span>
              </span>
              <IconChevron style={{ color: 'var(--faint)' }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Composers({ start, back }: { start: (m: Mode) => void; back: () => void }) {
  const p = useProgress();
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const count = PIECES.filter((x) => picked.includes(x.composer)).length;

  return (
    <div className="screen no-tabs">
      <Top title="По композиторам" back={back} />
      <p className="note" style={{ marginBottom: 14 }}>
        Отметьте одного или нескольких. Булавка закрепляет композитора в «Слабых местах».
      </p>
      {ERAS.map((e) => {
        const list = COMPOSERS.filter((c) => c.era === e.id && piecesBy(c.id).length);
        if (!list.length) return null;
        return (
          <div key={e.id}>
            <div className="section-title" style={{ marginTop: 18 }}>
              <span className="eyebrow">{e.name}</span>
            </div>
            <div className="list">
              {list.map((c) => {
                const pieces = piecesBy(c.id);
                const on = picked.includes(c.id);
                const pinned = p.pinnedComposers.includes(c.id);
                return (
                  <div key={c.id} className={`item ${on ? 'selected' : ''}`} role="checkbox" aria-checked={on} tabIndex={0} onClick={() => toggle(c.id)} onKeyDown={(ev) => (ev.key === ' ' || ev.key === 'Enter') && (ev.preventDefault(), toggle(c.id))} style={{ cursor: 'pointer' }}>
                    <span className="check">
                      <IconCheck />
                    </span>
                    <Monogram composer={c} />
                    <div className="grow">
                      <div className="t">{c.full}</div>
                      <div className="s">
                        {pieces.length} {plural(pieces.length, 'произведение', 'произведения', 'произведений')} · усвоено {Math.round(mastery(p, pieces) * 100)}%
                      </div>
                    </div>
                    <button
                      className={`icon-btn sm ${pinned ? 'on' : ''}`}
                      aria-label={pinned ? `Убрать из слабых мест: ${c.name}` : `Закрепить в слабых местах: ${c.name}`}
                      aria-pressed={pinned}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setProgress((s) => toggleComposerPin(s, c.id));
                      }}
                    >
                      <IconPin width={18} height={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="sticky-cta">
        <button className="btn primary" disabled={!picked.length} onClick={() => start({ type: 'composers', ids: picked })}>
          {picked.length ? `Тренировать · ${count} ${plural(count, 'произведение', 'произведения', 'произведений')}` : 'Выберите композиторов'}
        </button>
      </div>
    </div>
  );
}

export function Weak({ start, back, toLibrary, toComposers }: { start: (m: Mode) => void; back: () => void; toLibrary: () => void; toComposers: () => void }) {
  const p = useProgress();
  const pinnedComposers = COMPOSERS.filter((c) => p.pinnedComposers.includes(c.id));
  const own = PIECES.filter((x) => isWeak(statOf(p, x.id)));
  const total = PIECES.filter((x) => isWeak(statOf(p, x.id)) || p.pinnedComposers.includes(x.composer)).length;

  return (
    <div className="screen no-tabs">
      <Top title="Слабые места" back={back} />
      <p className="note" style={{ marginBottom: 14 }}>
        Сюда попадает то, в чём вы ошибались, и то, что закрепили сами. Произведение уходит из списка, когда вы несколько раз подряд узнаёте его верно.
      </p>

      {pinnedComposers.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 8 }}>
            <span className="eyebrow">Закреплённые композиторы</span>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {pinnedComposers.map((c) => (
              <button key={c.id} className="chip gold" onClick={() => setProgress((s) => toggleComposerPin(s, c.id))} aria-label={`Открепить: ${c.name}`}>
                <IconPin />
                {c.name} ×
              </button>
            ))}
          </div>
        </>
      )}

      {own.length > 0 ? (
        <>
          <div className="section-title">
            <span className="eyebrow">Произведения</span>
            <span className="small muted">{own.length}</span>
          </div>
          <div className="list">
            {own.map((x) => {
              const s = statOf(p, x.id);
              return (
                <div className="item" key={x.id}>
                  <ListenButton piece={x} />
                  <div className="grow">
                    <div className="t">{x.title}</div>
                    <div className="s">
                      {pieceLine(x)}
                      {s.wrong ? ` · ошибок: ${s.wrong}` : ''}
                    </div>
                  </div>
                  <Dots box={s.box} />
                  <button className={`icon-btn sm ${s.pinned ? 'on' : ''}`} aria-pressed={s.pinned} aria-label={s.pinned ? 'Открепить' : 'Закрепить'} onClick={() => setProgress((st) => togglePin(st, x.id))}>
                    <IconPin width={18} height={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        !pinnedComposers.length && (
          <div className="card empty">
            <div className="display">Слабых мест пока нет</div>
            <p>Ошибки появятся здесь сами. А можно закрепить вручную то, что хочется подтянуть.</p>
          </div>
        )
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn compact" onClick={toLibrary}>
          Закрепить произведение
        </button>
        <button className="btn compact" onClick={toComposers}>
          Закрепить композитора
        </button>
      </div>

      <div className="sticky-cta">
        <button className="btn primary" disabled={!total} onClick={() => start({ type: 'weak' })}>
          {total ? `Тренировать · ${total} ${plural(total, 'произведение', 'произведения', 'произведений')}` : 'Нечего тренировать'}
        </button>
      </div>
    </div>
  );
}
