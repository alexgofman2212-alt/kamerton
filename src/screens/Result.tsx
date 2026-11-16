import { composerOf } from '../data/catalog';
import { RANKS, rankProgress } from '../engine/rules';
import { useProgress } from '../engine/store';
import { ListenButton, Meter, pieceLine, plural } from '../ui/parts';
import type { Summary } from './Quiz';

export function Result({ summary, again, home }: { summary: Summary; again: () => void; home: () => void }) {
  const p = useProgress();
  const rp = rankProgress(p.xp);
  const up = summary.rankAfter > summary.rankBefore;
  const share = summary.total ? summary.correct / summary.total : 0;
  const title = share === 1 ? 'Безупречно' : share >= 0.8 ? 'Отличный слух' : share >= 0.5 ? 'Хорошая работа' : 'Нужно стараться больше';

  return (
    <div className="screen no-tabs">
      <div style={{ textAlign: 'center', padding: '26px 0 18px' }}>
        <div className="eyebrow">{title}</div>
        <div className="score" style={{ marginTop: 10 }}>
          {summary.correct}
          <small> из {summary.total}</small>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          +{summary.xp} опыта
        </p>
      </div>

      {up && (
        <div className="card rankup" style={{ marginBottom: 12 }}>
          <div className="eyebrow gold">Новый ранг</div>
          <div className="display" style={{ fontSize: 36, marginTop: 4 }}>
            {RANKS[summary.rankAfter - 1].name}
          </div>
          <p className="small muted" style={{ marginTop: 6 }}>
            Фрагменты станут короче, а в занятия добавятся новые произведения.
          </p>
        </div>
      )}

      <div className="card">
        <div className="row small" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span>{rp.name}</span>
          <span className="muted">{rp.next === null ? 'высший ранг' : `${rp.left} до «${RANKS[rp.rank].name}»`}</span>
        </div>
        <Meter frac={rp.frac} />
      </div>

      {summary.mistakes.length > 0 && (
        <>
          <div className="section-title">
            <span className="eyebrow">Стоит переслушать</span>
            <span className="small muted">добавлено в слабые места</span>
          </div>
          <div className="list">
            {dedupe(summary.mistakes).map(({ piece, chosen }) => (
              <div className="item" key={piece.id}>
                <ListenButton piece={piece} seconds={30} />
                <div className="grow">
                  <div className="t">{piece.title}</div>
                  <div className="s">
                    {pieceLine(piece)} · вы ответили: {composerOf(chosen.composer).name}, «{chosen.title}»
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {summary.learned.length > 0 && (
        <p className="note" style={{ marginTop: 16 }}>
          Узнано впервые: {summary.learned.length} {plural(summary.learned.length, 'произведение', 'произведения', 'произведений')}. Вернём их на повторение завтра.
        </p>
      )}

      <div className="stack" style={{ marginTop: 22 }}>
        <button className="btn primary" onClick={again}>
          Ещё занятие
        </button>
        <button className="btn ghost" onClick={home}>
          На главную
        </button>
      </div>
    </div>
  );
}

function dedupe(list: Summary['mistakes']): Summary['mistakes'] {
  const seen = new Set<string>();
  return list.filter((m) => (seen.has(m.piece.id) ? false : (seen.add(m.piece.id), true)));
}
