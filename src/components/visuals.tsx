import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { anteriorData, posteriorData, type BodyMuscle } from '../data/bodyMap';
import { MUSCLE_PARTS } from '../data/muscles';
import { addDays, fmtShort, mondayOf, parse, today } from '../engine/dates';
import { rankOf, type Rank } from '../engine/progress';
import type { Muscle } from '../engine/types';
import { Chevron } from './ui';

/* ---------- Rank badge ---------- */

const SHIELD = 'M20 2 L36 8 V22 C36 32 29 38.5 20 42 C11 38.5 4 32 4 22 V8 Z';

/** A shield in the rank's colors, with one to three chevrons for the division. Legend gets a crown. */
export function RankBadge({ level, size = 32, locked }: { level: number; size?: number; locked?: boolean }) {
  const { rank, index, division } = rankOf(level);
  const id = `rb-${index}-${locked ? 'l' : 'u'}`;
  const legend = rank.name === 'Legend';
  const c = locked ? { color: 'var(--sunk)', dark: 'var(--line)' } : rank;
  const ink = locked ? 'var(--muted)' : '#fff';
  const chevrons = legend ? 0 : division + 1;
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 40 44" aria-hidden="true" className="rank-badge">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.color} />
          <stop offset="1" stopColor={c.dark} />
        </linearGradient>
      </defs>
      <path d={SHIELD} fill={`url(#${id})`} stroke={c.dark} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20 5.5 L33 10.5 V14 C27 12 13 12 7 14 V10.5 Z" fill="#fff" opacity={locked ? 0 : 0.22} />
      {index >= 5 && !legend && <path d="M20 8.5l1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z" fill={ink} opacity=".9" />}
      {legend && <path d="M11 22 L13 12 L17.5 17 L20 10 L22.5 17 L27 12 L29 22 Z" fill={ink} stroke={c.dark} strokeWidth=".8" strokeLinejoin="round" />}
      {Array.from({ length: chevrons }, (_, i) => (
        <path key={i} d={`M12 ${21 + i * 5} L20 ${26 + i * 5} L28 ${21 + i * 5}`} fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {legend && <text x="20" y="34" textAnchor="middle" fontSize="10" fontWeight="700" fill={ink} fontFamily="var(--display)">{division + 1}</text>}
    </svg>
  );
}

export function rankStyle(r: Rank): React.CSSProperties {
  return { ['--rank' as string]: r.color, ['--rank-dark' as string]: r.dark };
}

/* ---------- Streak flame ---------- */

export function Flame({ lit, size = 20, warn }: { lit: boolean; size?: number; warn?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={`flame${lit ? ' lit' : ''}${warn ? ' warn' : ''}`}>
      <path d="M12 2c.6 3.2 2.6 4.9 4.3 6.7C18 10.5 19 12.3 19 14.6 19 18.7 15.9 22 12 22s-7-3.3-7-7.4c0-2.4 1.1-4.3 2.6-5.8.2 1.8 1 3 2.3 3.6C9.6 9 10.6 5.6 12 2z" fill="currentColor" />
      <path d="M12 12.5c.3 1.6 1.4 2.4 2.1 3.3.5.6.8 1.3.8 2.1 0 1.8-1.3 3.1-2.9 3.1s-2.9-1.3-2.9-3.1c0-1.2.6-2.1 1.2-2.8.5.7.9 1 1.4 1.1-.2-1.4 0-2.6.3-3.7z" fill="#FFE2A8" opacity={lit ? 0.95 : 0} />
    </svg>
  );
}

/* ---------- Body map ---------- */

export function BodyMap({ primary, secondary }: { primary: Muscle[]; secondary: Muscle[] }) {
  const fill = useMemo(() => {
    const m = new Map<BodyMuscle, 'p' | 's'>();
    for (const x of secondary) for (const part of MUSCLE_PARTS[x]) m.set(part, 's');
    for (const x of primary) for (const part of MUSCLE_PARTS[x]) m.set(part, 'p');
    return m;
  }, [primary, secondary]);
  const fig = (data: typeof anteriorData, label: string) => (
    <figure>
      <svg viewBox="0 0 100 200" role="img" aria-label={`${label} view`}>
        {data.map(part => part.svgPoints.map((pts, i) => (
          <polygon key={`${part.muscle}-${i}`} points={pts} className={`bm ${fill.get(part.muscle) ?? ''}`} />
        )))}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
  return <div className="bodymap">{fig(anteriorData, 'Front')}{fig(posteriorData, 'Back')}</div>;
}

/* ---------- Line chart ---------- */

export interface Point { date: string; value: number }

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceStep(range: number, ticks: number) {
  const raw = range / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

/** One series over time. Hover or drag for exact values. */
export function LineChart({ points, unit, label }: { points: Point[]; unit: string; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 180;
  const pad = { l: 40, r: 14, t: 14, b: 26 };
  const iw = Math.max(10, width - pad.l - pad.r);
  const ih = H - pad.t - pad.b;
  const vals = points.map(p => p.value);
  const lo0 = Math.min(...vals);
  const hi0 = Math.max(...vals);
  const step = niceStep(Math.max(hi0 - lo0, hi0 * 0.1, 1), 3);
  const lo = Math.max(0, Math.floor((lo0 - step * 0.5) / step) * step);
  const hi = Math.ceil((hi0 + step * 0.5) / step) * step;
  const t0 = parse(points[0].date).getTime();
  const t1 = parse(points[points.length - 1].date).getTime();
  const x = (d: string) => pad.l + (t1 === t0 ? iw / 2 : ((parse(d).getTime() - t0) / (t1 - t0)) * iw);
  const y = (v: number) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = `${path}L${x(points[points.length - 1].date).toFixed(1)},${pad.t + ih}L${x(points[0].date).toFixed(1)},${pad.t + ih}Z`;

  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i; });
    setHover(best);
  };
  const hp = hover !== null ? points[hover] : null;
  const showDots = points.length <= 24;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={H} role="img" aria-label={`${label}: from ${points[0].value} to ${points[points.length - 1].value} ${unit}`}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".22" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map(v => (
          <g key={v}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} className="gl" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="axis">{v}</text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} className="axis">{fmtShort(points[0].date)}</text>
        {points.length > 1 && <text x={pad.l + iw} y={H - 6} textAnchor="end" className="axis">{fmtShort(points[points.length - 1].date)}</text>}
        <path d={area} fill="url(#chart-fill)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {showDots && points.map((p, i) => <circle key={i} cx={x(p.date)} cy={y(p.value)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />)}
        {hp && (<>
          <line x1={x(hp.date)} x2={x(hp.date)} y1={pad.t} y2={pad.t + ih} className="cross" />
          <circle cx={x(hp.date)} cy={y(hp.value)} r="6" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        </>)}
      </svg>
      {hp && (
        <div className="tip" style={{ left: Math.min(Math.max(x(hp.date), 60), width - 60), top: y(hp.value) - 52 }}>
          <b className="mono">{hp.value} {unit}</b><span>{fmtShort(hp.date)}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Month calendar ---------- */

export type DayMark = 'done' | 'missed' | 'planned' | 'rest' | null;

export function MonthCalendar({ mark, onPick }: { mark: (date: string) => DayMark; onPick?: (date: string) => void }) {
  const t = today();
  const [month, setMonth] = useState(() => t.slice(0, 7));
  useEffect(() => { setMonth(t.slice(0, 7)); }, [t]);
  const first = `${month}-01`;
  const start = mondayOf(first);
  const d = parse(first);
  const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  const cells: string[] = [];
  for (let c = start; c.slice(0, 7) <= month || cells.length % 7 !== 0; c = addDays(c, 1)) cells.push(c);
  const done = cells.filter(c => c.startsWith(month) && mark(c) === 'done').length;
  return (
    <div className="cal">
      <div className="cal-h">
        <button className="x" aria-label="Previous month" onClick={() => setMonth(iso(prevMonth))}><Chevron dir="left" /></button>
        <b>{d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b>
        <button className="x" aria-label="Next month" disabled={month >= t.slice(0, 7)} onClick={() => setMonth(iso(nextMonth))}><Chevron dir="right" /></button>
      </div>
      <div className="cal-grid" role="grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((n, i) => <span key={i} className="cal-dn" aria-hidden="true">{n}</span>)}
        {cells.map(c => {
          const m = mark(c);
          const out = !c.startsWith(month);
          const label = `${fmtShort(c)}${m === 'done' ? ', worked out' : m === 'missed' ? ', missed' : m === 'planned' ? ', planned' : ''}`;
          return (
            <button key={c} className={`cal-d ${m ?? ''}${out ? ' out' : ''}${c === t ? ' today' : ''}`} aria-label={label}
              disabled={!onPick || c > t} onClick={() => onPick?.(c)}>
              {parse(c).getDate()}
            </button>
          );
        })}
      </div>
      <div className="cal-key">
        <span><i className="k done" />Worked out</span>
        <span><i className="k missed" />Missed</span>
        <span><i className="k planned" />Planned</span>
        <span className="spacer" />
        <span className="mono">{done} this month</span>
      </div>
    </div>
  );
}
