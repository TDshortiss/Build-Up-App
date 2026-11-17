import { useEffect, useMemo, useState } from 'react';
import { ExerciseInfo } from '../components/ExerciseSheets';
import { ExercisePicker, ExThumb } from '../components/ExercisePicker';
import { CheckIcon, Close, Sheet } from '../components/ui';
import { EX } from '../data/exercises';
import { MUSCLE_LABEL, musclesFor } from '../data/muscles';
import { STARTERS } from '../data/starterWorkouts';
import { fmtShort, today } from '../engine/dates';
import { computeProgress, levelInfo, sessionDone, type Progress } from '../engine/progress';
import type { AppState, CustomWorkout, Exercise, Tier, WorkoutItem, WorkoutSession } from '../engine/types';
import { getState } from '../state/store';
import {
  addExercise, deleteWorkout, discardSession, finishSession, patchSession, previousSets, saveWorkout, uid, workoutFromSession,
} from '../state/workouts';
import { RankBadge } from '../components/visuals';
import { ask } from '../components/ConfirmHost';

const EQUIP_LABEL = { gym: 'Full gym', home: 'Home gear', bodyweight: 'No equipment' };

export function Workouts({ state, progress, tier, onStart, onOpenSession }: {
  state: AppState; progress: Progress; tier: Tier; onStart: (w: CustomWorkout | null) => void; onOpenSession: (id: string) => void;
}) {
  const [editing, setEditing] = useState<CustomWorkout | null>(null);
  const equipment = state.profile!.equipment;
  const history = useMemo(() => Object.values(state.sessions).filter(sessionDone).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!)).slice(0, 12), [state.sessions]);
  const xpOf = (id: string) => [...progress.byWorkout.entries()].find(([r]) => r.id === id)?.[1].xp ?? 0;

  const blank = (): CustomWorkout => ({ id: uid(), name: '', items: [], createdAt: today(), updatedAt: Date.now() });

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <p className="label">Your own training</p>
          <h1>Workouts</h1>
        </div>
        <div className="row">
          <button className="btn ghost small" onClick={() => onStart(null)}>Empty workout</button>
          <button className="btn small" onClick={() => setEditing(blank())}>New workout</button>
        </div>
      </header>

      <section className="stack" style={{ gap: 10 }}>
        <h2 className="section-h">My workouts</h2>
        {state.workouts.length === 0
          ? <p className="note">Build a workout once and start it any time with one tap. Or save one of the ready-made workouts below and change it to suit you.</p>
          : (
            <div className="wk-grid">
              {state.workouts.map(w => (
                <article key={w.id} className="card wcard">
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <h3>{w.name}</h3>
                    <button className="linkbtn" onClick={() => setEditing(w)}>Edit</button>
                  </div>
                  <p className="fine">{w.items.map(i => EX[i.ex]?.name).filter(Boolean).join(' · ')}</p>
                  <button className="btn small" onClick={() => onStart(w)}>Start</button>
                </article>
              ))}
            </div>
          )}
      </section>

      <section className="stack" style={{ gap: 10, marginTop: 28 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="section-h">Ready-made</h2>
          <span className="pill">{EQUIP_LABEL[equipment]}</span>
        </div>
        <div className="wk-grid">
          {STARTERS[equipment].map(s => (
            <article key={s.key} className="card wcard starter">
              <h3>{s.name}</h3>
              <p className="muted" style={{ fontSize: 15 }}>{s.blurb}</p>
              <div className="thumbs">{s.items.slice(0, 5).map(i => <ExThumb key={i.ex} id={i.ex} name={EX[i.ex].name} />)}</div>
              <div className="row">
                <button className="btn small" onClick={() => onStart({ id: `starter-${s.key}`, name: s.name, items: s.items, createdAt: today(), updatedAt: 0 })}>Start</button>
                <button className="btn ghost small" onClick={() => setEditing({ ...blank(), name: s.name, items: s.items })}>Save &amp; edit</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section className="stack" style={{ gap: 10, marginTop: 28 }}>
          <h2 className="section-h">History</h2>
          <ul className="history">
            {history.map(s => (
              <li key={s.id}>
                <button onClick={() => onOpenSession(s.id)}>
                  <span><b>{s.name}</b><small>{fmtShort(s.date)} · {s.entries.length} exercises · {s.entries.reduce((a, e) => a + e.sets.filter(x => x.done).length, 0)} sets</small></span>
                  <span className="mono xp">+{xpOf(s.id)} XP</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && <WorkoutEditor initial={editing} tier={tier} isNew={!state.workouts.some(w => w.id === editing.id)} onClose={() => setEditing(null)} />}
    </div>
  );
}

/* ---------- Build or edit a workout ---------- */

function WorkoutEditor({ initial, tier, isNew, onClose }: { initial: CustomWorkout; tier: Tier; isNew: boolean; onClose: () => void }) {
  const [w, setW] = useState(initial);
  const [picking, setPicking] = useState(false);
  const setItem = (i: number, p: Partial<WorkoutItem>) => setW(x => ({ ...x, items: x.items.map((it, k) => (k === i ? { ...it, ...p } : it)) }));
  const move = (i: number, d: number) => setW(x => {
    const items = [...x.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return x;
    [items[i], items[j]] = [items[j], items[i]];
    return { ...x, items };
  });
  const save = () => { saveWorkout({ ...w, name: w.name.trim() || 'My workout' }); onClose(); };
  return (
    <Sheet title={isNew ? 'New workout' : 'Edit workout'} onClose={onClose}>
      <div className="field">
        <label htmlFor="wname">Name</label>
        <input id="wname" className="input" placeholder="e.g. Push Day" value={w.name} onChange={e => setW({ ...w, name: e.target.value })} />
      </div>
      <ol className="edit-list">
        {w.items.map((it, i) => (
          <li key={`${it.ex}-${i}`}>
            <ExThumb id={it.ex} name={EX[it.ex].name} />
            <div className="stack" style={{ gap: 6, minWidth: 0 }}>
              <b>{EX[it.ex].name}</b>
              <div className="row" style={{ gap: 8 }}>
                <label className="mini">Sets
                  <input type="number" inputMode="numeric" min={1} max={10} value={it.sets} onChange={e => setItem(i, { sets: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} />
                </label>
                <label className="mini">{EX[it.ex].timed ? 'Time' : 'Reps'}
                  <input value={it.reps} onChange={e => setItem(i, { reps: e.target.value })} style={{ width: 72 }} />
                </label>
              </div>
            </div>
            <div className="edit-actions">
              <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button aria-label="Move down" disabled={i === w.items.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button aria-label={`Remove ${EX[it.ex].name}`} onClick={() => setW(x => ({ ...x, items: x.items.filter((_, k) => k !== i) }))}><Close /></button>
            </div>
          </li>
        ))}
      </ol>
      <button className="btn ghost block" onClick={() => setPicking(true)}>+ Add exercise</button>
      <div className="row">
        <button className="btn" style={{ flex: 1 }} disabled={w.items.length === 0} onClick={save}>Save workout</button>
        {!isNew && <button className="linkbtn danger" onClick={async () => { if (await ask(`Delete "${w.name}"? Your logged sessions stay.`, { yes: 'Delete', danger: true })) { deleteWorkout(w.id); onClose(); } }}>Delete</button>}
      </div>
      {picking && <ExercisePicker tier={tier} picked={w.items.map(i => i.ex)}
        onPick={id => setW(x => ({ ...x, items: [...x.items, { ex: id, sets: 3, reps: EX[id].timed ? '30 s' : '8–12' }] }))}
        onClose={() => setPicking(false)} />}
    </Sheet>
  );
}

/* ---------- Logging a workout ---------- */

function useElapsed(start: string): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - new Date(start).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function ActiveWorkout({ session, state, tier, onHide, onFinished }: {
  session: WorkoutSession; state: AppState; tier: Tier; onHide: () => void; onFinished: (id: string) => void;
}) {
  const units = state.profile!.units;
  const elapsed = useElapsed(session.startedAt);
  const [picking, setPicking] = useState(false);
  const [info, setInfo] = useState<Exercise | null>(null);
  const id = session.id;
  const doneSets = session.entries.reduce((a, e) => a + e.sets.filter(x => x.done).length, 0);
  const totalSets = session.entries.reduce((a, e) => a + e.sets.length, 0);

  const setSet = (ei: number, si: number, p: Partial<WorkoutSession['entries'][number]['sets'][number]>) =>
    patchSession(id, s => ({ ...s, entries: s.entries.map((e, k) => (k === ei ? { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, ...p } : x)) } : e)) }));
  const addSet = (ei: number) => patchSession(id, s => ({ ...s, entries: s.entries.map((e, k) => {
    if (k !== ei) return e;
    const last = e.sets[e.sets.length - 1];
    return { ...e, sets: [...e.sets, { reps: last?.reps ?? null, weight: last?.weight ?? null, done: false }] };
  }) }));
  const removeSet = (ei: number, si: number) => patchSession(id, s => ({ ...s, entries: s.entries.map((e, k) => (k === ei ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e)) }));
  const removeEntry = (ei: number) => patchSession(id, s => ({ ...s, entries: s.entries.filter((_, k) => k !== ei) }));

  const finish = async () => {
    if (doneSets === 0) {
      if (await ask('No sets are ticked off yet. Tick off the sets you did, or discard this workout.', { yes: 'Discard', danger: true })) { discardSession(id); onHide(); }
      return;
    }
    finishSession(id);
    onFinished(id);
  };

  const num = (v: string): number | null => (v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

  return (
    <div className="active" role="dialog" aria-modal="true" aria-label="Workout in progress">
      <header className="active-h">
        <button className="x" onClick={onHide} aria-label="Minimise workout"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6l4 4 4-4" /></svg></button>
        <input className="active-name" value={session.name} onChange={e => patchSession(id, s => ({ ...s, name: e.target.value }))} aria-label="Workout name" />
        <span className="mono timer">{elapsed}</span>
        <button className="btn small done" onClick={finish}>Finish</button>
      </header>
      <div className="active-body">
        <div className="meter" aria-label={`${doneSets} of ${totalSets} sets done`}><i style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} /></div>
        {session.entries.length === 0 && <p className="note" style={{ marginTop: 16 }}>Add your first exercise to get going.</p>}
        {session.entries.map((e, ei) => {
          const ex = EX[e.ex];
          if (!ex) return null;
          const prev = previousSets(state, e.ex, id);
          return (
            <section key={`${e.ex}-${ei}`} className="log-ex">
              <div className="log-h">
                <ExThumb id={ex.id} name={ex.name} />
                <button className="ex-name" onClick={() => setInfo(ex)}>{ex.name}</button>
                <button className="x small" aria-label={`Remove ${ex.name}`} onClick={() => removeEntry(ei)}><Close /></button>
              </div>
              <p className="fine">{musclesFor(ex).p.map(m => MUSCLE_LABEL[m]).join(', ')}{e.target ? ` · target ${e.target}` : ''}</p>
              <table className="sets">
                <thead><tr><th>Set</th><th>Last time</th>{ex.loaded && <th>{units}</th>}<th>{ex.timed ? 'Sec' : 'Reps'}</th><th aria-label="Done" /></tr></thead>
                <tbody>
                  {e.sets.map((x, si) => {
                    const p = prev?.[si];
                    return (
                      <tr key={si} className={x.done ? 'is-done' : ''}>
                        <td className="mono">{si + 1}</td>
                        <td className="mono muted">{p ? `${p.weight ? `${p.weight}×` : ''}${p.reps ?? '–'}` : '–'}</td>
                        {ex.loaded && <td><input type="number" inputMode="decimal" min={0} step={units === 'kg' ? 0.5 : 2.5} value={x.weight ?? ''} placeholder="0" onChange={ev => setSet(ei, si, { weight: num(ev.target.value) })} aria-label={`Set ${si + 1} weight`} /></td>}
                        <td><input type="number" inputMode="numeric" min={0} value={x.reps ?? ''} placeholder="0" onChange={ev => setSet(ei, si, { reps: num(ev.target.value) })} aria-label={`Set ${si + 1} ${ex.timed ? 'seconds' : 'reps'}`} /></td>
                        <td><button className="tick" aria-pressed={x.done} aria-label={`Set ${si + 1} done`} onClick={() => setSet(ei, si, { done: !x.done })}><CheckIcon /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="row" style={{ gap: 16 }}>
                <button className="linkbtn" onClick={() => addSet(ei)}>+ Add set</button>
                {e.sets.length > 1 && <button className="linkbtn" style={{ color: 'var(--muted)' }} onClick={() => removeSet(ei, e.sets.length - 1)}>Remove last set</button>}
              </div>
            </section>
          );
        })}
        <button className="btn ghost block" style={{ marginTop: 18 }} onClick={() => setPicking(true)}>+ Add exercise</button>
        <div className="field" style={{ marginTop: 18 }}>
          <label htmlFor="snote">Notes</label>
          <textarea id="snote" className="input" placeholder="How did it go?" value={session.note ?? ''} onChange={e => patchSession(id, s => ({ ...s, note: e.target.value }))} />
        </div>
        <button className="linkbtn danger" style={{ marginTop: 18 }} onClick={async () => { if (await ask('Discard this workout? Nothing from it will be saved.', { yes: 'Discard', danger: true })) { discardSession(id); onHide(); } }}>Discard workout</button>
      </div>
      {picking && <ExercisePicker tier={tier} picked={session.entries.map(e => e.ex)} onPick={ex => addExercise(id, ex)} onClose={() => setPicking(false)} />}
      {info && <ExerciseInfo ex={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

/* ---------- After a workout, and looking back at one ---------- */

export function SessionSummary({ id, state, justFinished, onClose }: { id: string; state: AppState; justFinished?: { xpBefore: number }; onClose: () => void }) {
  const s = state.sessions[id];
  const progress = useMemo(() => computeProgress(state), [state]);
  if (!s) return null;
  const rec = [...progress.byWorkout.entries()].find(([r]) => r.id === id);
  const xp = rec?.[1].xp ?? 0;
  const prs = rec?.[1].prs ?? [];
  const units = state.profile!.units;
  const volume = rec?.[0].volume ?? 0;
  const mins = s.completedAt ? Math.max(1, Math.round((new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)) : 0;
  const before = justFinished ? levelInfo(justFinished.xpBefore) : null;
  const after = levelInfo(progress.xp);
  const saved = state.workouts.some(w => w.id === s.workoutId);
  return (
    <Sheet title={justFinished ? 'Workout done' : s.name} onClose={onClose}>
      {justFinished && (
        <div className="xp-earned">
          <RankBadge level={after.level} size={56} />
          <div>
            <b className="mono">+{xp} XP</b>
            <span>{before && after.level > before.level ? `Up to ${after.name}!` : `${after.needed - after.into} XP to the next level`}</span>
          </div>
        </div>
      )}
      <div className="tiles">
        <div><b className="mono">{mins}</b><span>minutes</span></div>
        <div><b className="mono">{s.entries.reduce((a, e) => a + e.sets.filter(x => x.done).length, 0)}</b><span>sets</span></div>
        {volume > 0 && <div><b className="mono">{volume.toLocaleString()}</b><span>{units} lifted</span></div>}
        {!justFinished && <div className="xp-tile"><b className="mono">+{xp}</b><span>XP</span></div>}
      </div>
      {prs.length > 0 && <div className="prs">{prs.map(p => <span key={p} className="pill pr">New best · {EX[p].name}</span>)}</div>}
      {justFinished && (
        <div className="stack" style={{ gap: 8 }}>
          <b>How hard was it?</b>
          <div className="rpe" role="group" aria-label="Workout effort, 1 to 10">
            {Array.from({ length: 10 }, (_, k) => k + 1).map(n => (
              <button key={n} aria-pressed={s.rpe === n} onClick={() => patchSession(id, x => ({ ...x, rpe: n }))}>{n}</button>
            ))}
          </div>
        </div>
      )}
      <ul className="summary-list">
        {s.entries.map((e, i) => (
          <li key={i}>
            <b>{EX[e.ex]?.name}</b>
            <span className="mono">{e.sets.filter(x => x.done).map(x => `${x.weight ? `${x.weight}×` : ''}${x.reps ?? '–'}`).join('  ') || 'Not done'}</span>
          </li>
        ))}
      </ul>
      {s.note && <p className="fine">“{s.note}”</p>}
      <div className="row">
        <button className="btn" style={{ flex: 1 }} onClick={onClose}>{justFinished ? 'Done' : 'Close'}</button>
        {!saved && <button className="btn ghost" onClick={() => { const w = workoutFromSession(getState().sessions[id]); saveWorkout(w); patchSession(id, x => ({ ...x, workoutId: w.id })); }}>Save as workout</button>}
      </div>
      {!justFinished && <button className="linkbtn danger" onClick={async () => { if (await ask('Delete this workout from your history? Its XP goes too.', { yes: 'Delete', danger: true })) { discardSession(id); onClose(); } }}>Delete from history</button>}
    </Sheet>
  );
}
