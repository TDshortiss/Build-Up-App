import { useMemo, useState } from 'react';
import { ExerciseInfo } from '../components/ExerciseSheets';
import { ExThumb, MUSCLE_FILTERS } from '../components/ExercisePicker';
import { Chip } from '../components/ui';
import { MUSCLE_LABEL, musclesFor } from '../data/muscles';
import { AREA_LABEL, EXERCISES } from '../data/exercises';
import type { Area, Exercise, Muscle, Tier } from '../engine/types';

const AREAS: Area[] = ['ankle', 'knee', 'hip', 'back', 'core', 'shoulder', 'elbow', 'upper', 'full'];

export function Library({ tier }: { tier: Tier }) {
  const [q, setQ] = useState('');
  const [area, setArea] = useState<Area | null>(null);
  const [mine, setMine] = useState(true);
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [info, setInfo] = useState<Exercise | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return EXERCISES.filter(e => (!area || e.area === area) && (!mine || e.tier <= tier) && (!muscle || musclesFor(e).p.includes(muscle))
      && (!s || e.name.toLowerCase().includes(s) || e.cue.toLowerCase().includes(s) || e.why.toLowerCase().includes(s)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q, area, mine, tier, muscle]);

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
      <h3 className="label grouph" style={{ margin: '16px 0 8px' }}>Muscle</h3>
      <div className="chips">
        {MUSCLE_FILTERS.map(m => <Chip key={m} pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>{MUSCLE_LABEL[m]}</Chip>)}
      </div>
      <p className="fine" style={{ marginTop: 12 }}>{list.length} shown</p>
      <div className="lib">
        {list.map(e => (
          <button key={e.id} className="card" style={{ textAlign: 'left' }} onClick={() => setInfo(e)}>
            <div className="lib-top">
              <ExThumb id={e.id} name={e.name} />
              <div>
                <span className="tag">{musclesFor(e).p.map(m => MUSCLE_LABEL[m]).join(' · ')} · {['Bodyweight', 'Home gear', 'Gym'][e.tier]}</span>
                <h3>{e.name}</h3>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 15 }}>{e.why}</p>
          </button>
        ))}
      </div>
      {info && <ExerciseInfo ex={info} onClose={() => setInfo(null)} />}
    </div>
  );
}
