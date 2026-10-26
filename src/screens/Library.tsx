import { useMemo, useState } from 'react';
import { ExerciseInfo } from '../components/ExerciseSheets';
import { Chip } from '../components/ui';
import { AREA_LABEL, EXERCISES } from '../data/exercises';
import type { Area, Exercise, Tier } from '../engine/types';

const AREAS: Area[] = ['ankle', 'knee', 'hip', 'back', 'core', 'shoulder', 'elbow', 'upper', 'full'];

export function Library({ tier }: { tier: Tier }) {
  const [q, setQ] = useState('');
  const [area, setArea] = useState<Area | null>(null);
  const [mine, setMine] = useState(true);
  const [info, setInfo] = useState<Exercise | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return EXERCISES.filter(e => (!area || e.area === area) && (!mine || e.tier <= tier)
      && (!s || e.name.toLowerCase().includes(s) || e.cue.toLowerCase().includes(s) || e.why.toLowerCase().includes(s)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q, area, mine, tier]);

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <p className="label">Exercise library</p>
          <h1>{EXERCISES.length} exercises</h1>
        </div>
      </header>
      <div className="search">
        <input className="input" type="search" placeholder="Search exercises" value={q} onChange={e => setQ(e.target.value)} aria-label="Search exercises" />
        <Chip pressed={mine} onClick={() => setMine(m => !m)}>Fits my equipment</Chip>
      </div>
      <div className="chips">
        <Chip pressed={area === null} onClick={() => setArea(null)}>All</Chip>
        {AREAS.map(a => <Chip key={a} pressed={area === a} onClick={() => setArea(area === a ? null : a)}>{AREA_LABEL[a]}</Chip>)}
      </div>
      <p className="fine" style={{ marginTop: 12 }}>{list.length} shown</p>
      <div className="lib">
        {list.map(e => (
          <button key={e.id} className="card" style={{ textAlign: 'left' }} onClick={() => setInfo(e)}>
            <span className="tag">{AREA_LABEL[e.area]} · {['Bodyweight', 'Home gear', 'Gym'][e.tier]}</span>
            <h3>{e.name}</h3>
            <p className="muted" style={{ fontSize: 15 }}>{e.why}</p>
          </button>
        ))}
      </div>
      {info && <ExerciseInfo ex={info} onClose={() => setInfo(null)} />}
    </div>
  );
}
