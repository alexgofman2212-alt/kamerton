import { PIECES } from '../data/catalog';
import { dayIndex } from '../engine/dates';
import { duePieces, statOf, streak, todayLog, weakPieces } from '../engine/progress';
import { scopeOf } from '../engine/quiz';
import { LEVELS, RANKS, rankProgress } from '../engine/rules';
import { useProgress } from '../engine/store';
import type { Mode } from '../engine/types';
import { IconClock, IconFlame, IconNote, IconPlay, IconTarget, IconUsers } from '../ui/icons';
import { Meter, Ring, plural } from '../ui/parts';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export function Home({ start, go }: { start: (m: Mode) => void; go: (name: 'eras' | 'composers' | 'weak') => void }) {
  const p = useProgress();
  const today = dayIndex();
  const rp = rankProgress(p.xp);
  const log = todayLog(p, today);
  const days = streak(p, today);
  const due = duePieces(p, PIECES, today).length;
  const weak = weakPieces(p, PIECES).length;
  const scope = scopeOf({ type: 'daily' }, p, PIECES);
  const fresh = scope.filter((x) => statOf(p, x.id).seen === 0).length;
  const first = Object.keys(p.pieces).length === 0;
  const lvl = LEVELS[rp.rank - 1];

  const sub = first
    ? 'Десять фрагментов — начнём с самого известного'
    : [due ? `${due} на повторение` : '', fresh ? `${Math.min(fresh, 4)} ${plural(Math.min(fresh, 4), 'новое', 'новых', 'новых')}` : '']
        .filter(Boolean)
        .join(' · ') || 'Практика усвоенного';

  return (
    <div className="screen">
      <div className="topbar">
        <div className="wordmark">
          <IconNote />
          Камертон
        </div>
        <span className={`chip ${days ? 'gold' : ''}`} title="Дней подряд">
          <IconFlame />
          {days} {plural(days, 'день', 'дня', 'дней')}
        </span>
      </div>

      <div className="card hero">
        <Ring size={96} stroke={5} frac={rp.frac}>
          <span className="rank-num">{ROMAN[rp.rank - 1]}</span>
        </Ring>
        <div className="grow">
          <div className="eyebrow">Ваш ранг</div>
          <h2 className="display">{rp.name}</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            {rp.next === null ? `${p.xp} опыта · высший ранг` : `Ещё ${rp.left} опыта до ранга «${RANKS[rp.rank].name}»`}
          </p>
        </div>
      </div>

      <div className="goal">
        <div className="row small muted" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Цель на сегодня</span>
          <span>
            {Math.min(log.n, p.settings.dailyGoal)} из {p.settings.dailyGoal}
          </span>
        </div>
        <Meter frac={log.n / p.settings.dailyGoal} />
      </div>

      <button className="btn primary cta" onClick={() => start({ type: 'daily' })}>
        <span>
          <span className="t">{first ? 'Начать' : 'Тренировка дня'}</span>
          <span className="s">{sub}</span>
        </span>
        <span className="play">
          <IconPlay />
        </span>
      </button>

      <div className="section-title">
        <span className="eyebrow">Режимы</span>
        <span className="small muted">
          Фрагмент до {lvl.clip} с
        </span>
      </div>
      <div className="modes">
        <button className="card mode" onClick={() => go('eras')}>
          <span className="ico">
            <IconClock />
          </span>
          <span>
            <h3>Эпохи</h3>
            <p>От барокко до XX века</p>
          </span>
        </button>
        <button className="card mode" onClick={() => go('composers')}>
          <span className="ico">
            <IconUsers />
          </span>
          <span>
            <h3>Композиторы</h3>
            <p>Выберите, кого учить</p>
          </span>
        </button>
        <button className="card mode wide" onClick={() => go('weak')}>
          <span className="ico">
            <IconTarget />
          </span>
          <span className="grow">
            <h3>Слабые места</h3>
            <p>{weak ? `${weak} ${plural(weak, 'произведение', 'произведения', 'произведений')} требуют внимания` : 'Ошибки и то, что вы закрепили сами'}</p>
          </span>
          {weak > 0 && <span className="badge" style={{ position: 'static' }}>{weak}</span>}
        </button>
      </div>
    </div>
  );
}
