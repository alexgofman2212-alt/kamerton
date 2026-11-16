import { useEffect, useRef } from 'react';
import { composerOf } from '../data/catalog';
import { player, usePlayer } from '../engine/player';
import { MASTERED_BOX } from '../engine/rules';
import type { Composer, Piece } from '../engine/types';
import { IconPlay, IconStop } from './icons';

export function Ring({ size, stroke, frac, children }: { size: number; stroke: number; frac: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="bar" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, frac)))} />
      </svg>
      <div className="inner">{children}</div>
    </div>
  );
}

export function Monogram({ composer }: { composer: Composer }) {
  return <span className={`mono era-${composer.era}`}>{composer.name[0]}</span>;
}

/** Четыре точки: насколько произведение усвоено. */
export function Dots({ box }: { box: number }) {
  const n = Math.min(box, MASTERED_BOX);
  return (
    <span className="dots" role="img" aria-label={`Усвоено: ${n} из ${MASTERED_BOX}`}>
      {Array.from({ length: MASTERED_BOX }, (_, i) => (
        <i key={i} className={i < n ? 'f' : ''} />
      ))}
    </span>
  );
}

export function Meter({ frac }: { frac: number }) {
  return (
    <div className="meter">
      <i style={{ width: `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%` }} />
    </div>
  );
}

/** Круг плеера: обводка показывает, сколько фрагмента прозвучало. */
export function Orb({ small, countdown }: { small?: boolean; countdown: boolean }) {
  const ps = usePlayer();
  const bar = useRef<SVGCircleElement>(null);
  const R = 46;
  const C = 2 * Math.PI * R;

  useEffect(() => {
    let raf = 0;
    const step = () => {
      if (bar.current) bar.current.style.strokeDashoffset = String(C * (countdown ? player.progress() : 0));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [C, countdown]);

  return (
    <div className={`orb ${small ? 'small' : ''} ${ps.status === 'playing' ? 'playing' : ''}`}>
      <svg className="prog" viewBox="0 0 100 100">
        <circle className="track" cx="50" cy="50" r={R} fill="none" strokeWidth="2.5" />
        {countdown && <circle ref={bar} className="bar" cx="50" cy="50" r={R} fill="none" strokeWidth="2.5" strokeDasharray={C} />}
      </svg>
      <div className="core">
        {ps.status === 'loading' ? (
          <span className="spinner" />
        ) : ps.status === 'playing' ? (
          <span className="bars"><i /><i /><i /><i /><i /></span>
        ) : (
          <IconPlay width={small ? 26 : 40} height={small ? 26 : 40} style={{ opacity: 0.55 }} />
        )}
      </div>
    </div>
  );
}

/** Кнопка «послушать запись» для списков. */
export function ListenButton({ piece, seconds = null }: { piece: Piece; seconds?: number | null }) {
  const ps = usePlayer();
  const tag = `listen:${piece.id}`;
  const active = ps.tag === tag && (ps.status === 'playing' || ps.status === 'loading');
  return (
    <button
      className={`icon-btn sm ${active ? 'on' : ''}`}
      aria-label={active ? 'Остановить' : `Слушать: ${piece.title}`}
      onClick={(e) => {
        e.stopPropagation();
        if (active) player.stop();
        else player.play(tag, piece.rec.src, piece.intro, seconds);
      }}
    >
      {active && ps.status === 'loading' ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : active ? <IconStop width={18} height={18} /> : <IconPlay width={18} height={18} />}
    </button>
  );
}

export function pieceLine(piece: Piece): string {
  const c = composerOf(piece.composer);
  return piece.part ? `${c.name} · ${piece.part}` : c.name;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
