import { PIECES } from '../data/catalog';
import { dayIndex, dayKey } from '../engine/dates';
import { isMastered, mastery, statOf, streak } from '../engine/progress';
import { ERAS, LEVELS, RANKS, rankOf } from '../engine/rules';
import { useProgress } from '../engine/store';
import { IconCheck } from '../ui/icons';
import { Meter, plural } from '../ui/parts';

const UNLOCK = ['Самые известные произведения, длинные фрагменты с начала', 'Каталог шире', 'Весь каталог, фрагменты из середины', '', '', '', 'Самые короткие и неочевидные фрагменты'];

export function Stats() {
  const p = useProgress();
  const today = dayIndex();
  const rank = rankOf(p.xp);
  const stats = Object.values(p.pieces);
  const seen = stats.reduce((s, x) => s + x.seen, 0);
  const right = stats.reduce((s, x) => s + x.right, 0);
  const mastered = PIECES.filter((x) => isMastered(statOf(p, x.id))).length;
  const days = Array.from({ length: 14 }, (_, i) => p.days[dayKey(today - 13 + i)]?.n ?? 0);
  const peak = Math.max(p.settings.dailyGoal, ...days);

  return (
    <div className="screen">
      <div className="topbar">
        <h1>Прогресс</h1>
        <span className="chip gold">{p.xp} опыта</span>
      </div>

      <div className="stat-grid">
        <div className="card stat">
          <b>{mastered}</b>
          <span>освоено из {PIECES.length}</span>
        </div>
        <div className="card stat">
          <b>{seen ? Math.round((right / seen) * 100) : 0}%</b>
          <span>точность</span>
        </div>
        <div className="card stat">
          <b>{streak(p, today)}</b>
          <span>{plural(streak(p, today), 'день', 'дня', 'дней')} подряд</span>
        </div>
      </div>

      <div className="section-title">
        <span className="eyebrow">Две недели</span>
        <span className="small muted">ответов в день</span>
      </div>
      <div className="card">
        <div className="week" role="img" aria-label={`Ответов за последние 14 дней: ${days.join(', ')}`}>
          {days.map((n, i) => (
            <i key={i} className={n ? 'f' : ''} style={{ height: `${Math.max(5, (n / peak) * 100)}%`, opacity: n ? 0.45 + 0.55 * Math.min(1, n / p.settings.dailyGoal) : 1 }} />
          ))}
        </div>
      </div>

      <div className="section-title">
        <span className="eyebrow">Эпохи</span>
      </div>
      <div className="card stack" style={{ gap: 16 }}>
        {ERAS.map((e) => {
          const m = mastery(p, PIECES.filter((x) => x.era === e.id));
          return (
            <div key={e.id} className={`era-${e.id}`}>
              <div className="row small" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <span>{e.name}</span>
                <span className="muted">{Math.round(m * 100)}%</span>
              </div>
              <div className="meter">
                <i style={{ width: `${Math.round(m * 100)}%`, background: 'var(--c)' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-title">
        <span className="eyebrow">Лестница рангов</span>
      </div>
      <div className="list ladder">
        {RANKS.map((r, i) => {
          const n = i + 1;
          const state = n < rank ? 'done' : n === rank ? 'cur' : '';
          return (
            <div key={r.name} className={`item ${state}`}>
              <span className="num">{n < rank ? <IconCheck width={20} height={20} /> : n}</span>
              <div className="grow">
                <div className="t">{r.name}</div>
                <div className="s">
                  Фрагмент {LEVELS[i].clip} с{UNLOCK[i] ? ` · ${UNLOCK[i].toLowerCase()}` : ''}
                </div>
                {n === rank && RANKS[n] && (
                  <div style={{ marginTop: 8 }}>
                    <Meter frac={(p.xp - r.xp) / (RANKS[n].xp - r.xp)} />
                  </div>
                )}
              </div>
              <span className="small muted">{r.xp}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
