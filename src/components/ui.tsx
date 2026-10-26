import { useEffect, type ReactNode } from 'react';
import { painMessage, painTone } from '../engine/resolve';

export function Logo() {
  return <span className="logo">Build <span>Up</span></span>;
}

export function Effort({ level }: { level: 1 | 2 | 3 }) {
  const label = ['Easy', 'Moderate', 'Hard'][level - 1];
  return <i className={`eff e${level}`} role="img" aria-label={label} title={label} />;
}

export const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>
);
export const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d={dir === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} />
  </svg>
);
export const Close = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
);

const ICONS: Record<string, string> = {
  today: 'M4 5h16v15H4zM4 9h16M9 3v4M15 3v4',
  plan: 'M4 6h16M4 12h16M4 18h10',
  rehab: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
  library: 'M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8 1-3.9 15-3.8-1z',
  me: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
};
export function TabIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="scrim" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-h">
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Close"><Close /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PainSlider({ label, value, onChange, injuryName }: { label: string; value: number | undefined; onChange: (n: number) => void; injuryName: string }) {
  const v = value ?? 0;
  const id = `pain-${label.replace(/\W+/g, '-')}`;
  return (
    <div className="pain">
      <label htmlFor={id} style={{ fontWeight: 600 }}>{label}</label>
      <div className="pain-row">
        <input id={id} type="range" min={0} max={10} step={1} value={v} onChange={e => onChange(Number(e.target.value))} />
        <output htmlFor={id}>{value === undefined ? '–' : `${v}/10`}</output>
      </div>
      {value !== undefined && <p className={`pain-msg ${painTone(v)}`}>{painMessage(v, injuryName)}</p>}
    </div>
  );
}

export function Opt({ pressed, onClick, title, sub, big, check }: { pressed: boolean; onClick: () => void; title: string; sub?: string; big?: boolean; check?: boolean }) {
  return (
    <button type="button" className={`opt${big ? ' big' : ''}`} aria-pressed={pressed} onClick={onClick}>
      {check ? (
        <span className="opt-row"><span className="check">{pressed && <CheckIcon />}</span><span><b>{title}</b>{sub && <span style={{ display: 'block' }}>{sub}</span>}</span></span>
      ) : (<><b>{title}</b>{sub && <span>{sub}</span>}</>)}
    </button>
  );
}

export function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>{children}</button>;
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}
