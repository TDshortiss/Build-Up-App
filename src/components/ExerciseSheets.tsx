import { AREA_LABEL, EXERCISES } from '../data/exercises';
import { avoidMap } from '../engine/resolve';
import type { AppState, Exercise, Tier } from '../engine/types';
import { update } from '../state/store';
import { MUSCLE_LABEL, musclesFor } from '../data/muscles';
import { Sheet } from './ui';
import { BodyMap } from './visuals';

export function ExerciseInfo({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const q = encodeURIComponent(`${ex.name} exercise how to`);
  const m = musclesFor(ex);
  return (
    <Sheet title={ex.name} onClose={onClose}>
      <span className="tag">{AREA_LABEL[ex.area]} · {['Bodyweight', 'Home gear', 'Gym'][ex.tier]}</span>
      <div className="ex-visual">
        <div className="muscles">
          <BodyMap primary={m.p} secondary={m.s} />
          <div className="mkey">
            <span><i className="k p" />{m.p.map(x => MUSCLE_LABEL[x]).join(', ')}</span>
            {m.s.length > 0 && <span><i className="k s" />{m.s.map(x => MUSCLE_LABEL[x]).join(', ')}</span>}
          </div>
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="label">How to</span>
        <p>{ex.cue}</p>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="label">Why it helps</span>
        <p>{ex.why}</p>
      </div>
      <a href={`https://www.youtube.com/results?search_query=${q}`} target="_blank" rel="noreferrer">Watch a demo on YouTube</a>
    </Sheet>
  );
}

/** Pick a replacement for an exercise. The choice applies everywhere it appears in the plan. */
export function SwapSheet({ planned, current, state, tier, onClose }: { planned: Exercise; current: Exercise; state: AppState; tier: Tier; onClose: () => void }) {
  const avoid = avoidMap(state.profile?.injuries ?? [], state.rehab);
  const alts = EXERCISES.filter(e => e.pattern === planned.pattern && e.id !== current.id && e.tier <= tier && !e.tags.some(t => avoid.has(t)))
    .sort((a, b) => (b.area === planned.area ? 1 : 0) - (a.area === planned.area ? 1 : 0) || b.tier - a.tier);
  const choose = (id: string | null) => {
    update(s => {
      const swaps = { ...s.swaps };
      if (id === null || id === planned.id) delete swaps[planned.id]; else swaps[planned.id] = id;
      return { ...s, swaps };
    });
    onClose();
  };
  return (
    <Sheet title="Swap exercise" onClose={onClose}>
      <p className="muted">Replacing <b>{current.name}</b>. Your choice applies everywhere it appears in your plan.</p>
      {state.swaps[planned.id] && (
        <button className="opt" onClick={() => choose(null)}><b>Go back to {planned.name}</b><span>The exercise your plan picked.</span></button>
      )}
      <div className="alts">
        {alts.length === 0 && <p className="note">No other options match your equipment and injuries right now.</p>}
        {alts.map(e => (
          <button key={e.id} className="opt" onClick={() => choose(e.id)}>
            <b>{e.name}</b>
            <span>{e.cue}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
