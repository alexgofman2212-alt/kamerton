import { useState } from 'react';
import { COMPOSERS, PIECES, piecesBy } from '../data/catalog';
import { statOf, togglePin } from '../engine/progress';
import { ERAS, tierForRank, rankOf, RANKS } from '../engine/rules';
import { setProgress, useProgress } from '../engine/store';
import type { Era } from '../engine/types';
import { IconPin } from '../ui/icons';
import { Dots, ListenButton, Monogram } from '../ui/parts';

export function Library() {
  const p = useProgress();
  const [era, setEra] = useState<Era | 'all'>('all');
  const tier = tierForRank(rankOf(p.xp));
  const composers = COMPOSERS.filter((c) => (era === 'all' || c.era === era) && piecesBy(c.id).length);

  return (
    <div className="screen">
      <div className="topbar">
        <h1>Библиотека</h1>
        <span className="chip">{PIECES.length} записей</span>
      </div>
      <div className="seg scroll" role="tablist" aria-label="Эпоха">
        <button role="tab" aria-selected={era === 'all'} className={era === 'all' ? 'on' : ''} onClick={() => setEra('all')}>
          Все
        </button>
        {ERAS.map((e) => (
          <button key={e.id} role="tab" aria-selected={era === e.id} className={era === e.id ? 'on' : ''} onClick={() => setEra(e.id)}>
            {e.name}
          </button>
        ))}
      </div>
      <p className="note" style={{ margin: '12px 0 4px' }}>
        Слушайте целиком, чтобы запомнить. Булавка отправляет произведение в «Слабые места».
      </p>

      {composers.map((c) => (
        <div key={c.id}>
          <div className="row" style={{ margin: '22px 0 10px' }}>
            <Monogram composer={c} />
            <div className="grow">
              <div className="display" style={{ fontSize: 23 }}>
                {c.full}
              </div>
              <div className="small muted">{c.years}</div>
            </div>
          </div>
          <div className="list">
            {piecesBy(c.id).map((x) => {
              const s = statOf(p, x.id);
              const locked = x.tier > tier && s.seen === 0;
              return (
                <div className="item" key={x.id}>
                  <ListenButton piece={x} />
                  <div className="grow">
                    <div className="t">{x.title}</div>
                    <div className="s">
                      {[x.part, x.year, locked ? `в занятиях с ранга «${RANKS[x.tier - 1].name}»` : ''].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <Dots box={s.box} />
                  <button className={`icon-btn sm ${s.pinned ? 'on' : ''}`} aria-pressed={s.pinned} aria-label={s.pinned ? `Открепить: ${x.title}` : `Закрепить в слабых местах: ${x.title}`} onClick={() => setProgress((st) => togglePin(st, x.id))}>
                    <IconPin width={18} height={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
