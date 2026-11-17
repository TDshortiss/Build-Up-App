import { useMemo, useState } from 'react';
import { AREA_LABEL, EX, EXERCISES } from '../data/exercises';
import { MUSCLE_LABEL, musclesFor } from '../data/muscles';
import type { Muscle, Tier } from '../engine/types';
import { Chip, Sheet } from './ui';
import { MiniBody } from './visuals';

export const MUSCLE_FILTERS: Muscle[] = ['chest', 'upper-back', 'lats', 'front-delts', 'side-delts', 'biceps', 'triceps', 'abs', 'quads', 'hamstrings', 'glutes', 'calves'];

/** Small square thumbnail: a tiny body with the exercise's main muscles lit up. */
export function ExThumb({ id }: { id: string; name?: string }) {
  const ex = EX[id];
  return <span className="thumb" aria-hidden="true">{ex && <MiniBody primary={musclesFor(ex).p} />}</span>;
}

/** Search and pick an exercise. Calls onPick once per tap, so several can be added in a row. */
export function ExercisePicker({ tier, onPick, onClose, picked }: { tier: Tier; onPick: (id: string) => void; onClose: () => void; picked?: string[] }) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [mine, setMine] = useState(true);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return EXERCISES.filter(e => e.pattern !== 'mobility' && e.pattern !== 'rehab' && (!mine || e.tier <= tier)
      && (!muscle || musclesFor(e).p.includes(muscle))
      && (!s || e.name.toLowerCase().includes(s) || AREA_LABEL[e.area].toLowerCase().includes(s)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q, muscle, mine, tier]);
  return (
    <Sheet title="Add exercise" onClose={onClose}>
      <input className="input" type="search" placeholder="Search 220+ exercises" value={q} onChange={e => setQ(e.target.value)} aria-label="Search exercises" autoFocus />
      <div className="chips scroll-chips">
        <Chip pressed={mine} onClick={() => setMine(m => !m)}>Fits my equipment</Chip>
        {MUSCLE_FILTERS.map(m => <Chip key={m} pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>{MUSCLE_LABEL[m]}</Chip>)}
      </div>
      <div className="pick-list">
        {list.map(e => {
          const n = picked?.filter(p => p === e.id).length ?? 0;
          return (
            <button key={e.id} className="pick" onClick={() => onPick(e.id)}>
              <ExThumb id={e.id} name={e.name} />
              <span className="pick-t"><b>{e.name}</b><small>{musclesFor(e).p.map(m => MUSCLE_LABEL[m]).join(', ')}</small></span>
              <span className={`pick-add${n ? ' on' : ''}`} aria-hidden="true">{n ? '✓' : '+'}</span>
            </button>
          );
        })}
        {list.length === 0 && <p className="note">No matches. Try another search or turn off "Fits my equipment".</p>}
      </div>
      <button className="btn block" onClick={onClose}>Done</button>
    </Sheet>
  );
}
