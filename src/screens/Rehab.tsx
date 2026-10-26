import { useState } from 'react';
import { GENERAL_RED_FLAGS, INJURY, PAIN_GUIDE, PAIN_RULES } from '../data/injuries';
import { fmtShort, today } from '../engine/dates';
import { painHistory, rehabStatus } from '../engine/resolve';
import type { AppState, InjuryEntry, InjuryId, RehabState } from '../engine/types';
import { update } from '../state/store';

export function Rehab({ state }: { state: AppState }) {
  const injuries = state.profile?.injuries ?? [];
  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <p className="label">Rehab</p>
          <h1>Pain guide & progress</h1>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 20 }}>
        <h3>The pain guide</h3>
        <div className="guide">
          {PAIN_GUIDE.map(g => <div key={g.range} className={g.tone}><b>{g.range} · {g.name}</b><span>{g.body}</span></div>)}
        </div>
        <ul className="rules">{PAIN_RULES.map(r => <li key={r}>{r}</li>)}</ul>
      </section>

      {injuries.length === 0 && <p className="note">No injuries in your plan. If something starts hurting, add it from the Me tab and your plan will adjust.</p>}
      <div className="stack" style={{ gap: 20 }}>
        {injuries.map(inj => <InjuryCard key={inj.id} inj={inj} state={state} />)}
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <h3>Stop and see a professional if</h3>
        <ul className="flags">{GENERAL_RED_FLAGS.map(f => <li key={f}>{f}</li>)}</ul>
        <p className="fine">Build Up gives general training information and is not a substitute for a doctor, physio or athletic trainer.</p>
      </section>
    </div>
  );
}

function setRehab(id: InjuryId, fn: (r: RehabState) => RehabState) {
  update(s => {
    const prev = s.rehab[id] ?? { stage: 0, stageStartedAt: today(), checks: [] };
    return { ...s, rehab: { ...s.rehab, [id]: fn(prev) } };
  });
}

function InjuryCard({ inj, state }: { inj: InjuryEntry; state: AppState }) {
  const def = INJURY[inj.id];
  const st = rehabStatus(state, inj.id, today());
  const stage = def.stages[st.stage];
  const r = state.rehab[inj.id];
  const protecting = inj.protectOnly && !r?.cleared;
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const history = painHistory(state, inj.id).slice(-21);

  const submitCheck = () => {
    const passed = stage.checks.every(c => results[c.id]);
    setRehab(inj.id, prev => ({
      ...prev,
      checks: [...prev.checks, { date: today(), stage: st.stage, results, passed }],
      ...(passed ? { stage: Math.min(3, prev.stage + 1), stageStartedAt: today() } : {}),
    }));
    setResults({});
    setMsg(passed
      ? `Passed. You're on to stage ${st.stage + 2}: ${def.stages[Math.min(3, st.stage + 1)].name}. Your sessions have been updated.`
      : 'Not quite yet. That\'s normal. Keep going with this stage and try again in a few days.');
  };

  const moveStage = (delta: number) => {
    setRehab(inj.id, prev => ({ ...prev, stage: Math.min(3, Math.max(0, prev.stage + delta)), stageStartedAt: today() }));
    setMsg(delta < 0 ? 'Moved back a stage. Give it a week, then check again.' : null);
  };

  return (
    <section className="card">
      <div className="row">
        <h3 style={{ flex: 1 }}>{def.name}</h3>
        <span className="pill">{def.aka}</span>
      </div>
      <p className="muted" style={{ fontSize: 15 }}>{def.summary}</p>

      {protecting ? (<>
        <p className="dangerbox">You told us about a warning sign, so your plan is protecting this area and skipping rehab exercises. Once a doctor or physio has checked it and cleared you for exercise, turn rehab on.</p>
        <button className="btn dark" onClick={() => setRehab(inj.id, prev => ({ ...prev, cleared: true, stageStartedAt: today() }))}>I've been cleared. Start rehab</button>
      </>) : (<>
        <div className="stages">
          {def.stages.map((s, i) => <div key={i} className={i < st.stage ? 'done' : i === st.stage ? 'now' : ''}>{i + 1}. {s.name}</div>)}
        </div>
        <div>
          <p><b>Stage {st.stage + 1}: {stage.name}.</b> {stage.goal}</p>
          <p className="fine" style={{ marginTop: 4 }}>Day {st.daysAtStage + 1} at this stage. {stage.conditioning}</p>
        </div>
        <p className="note">{def.painNote}</p>

        {st.suggestRegress && (
          <div className="warnbox">
            Your last two pain ratings were 6 or higher. Drop back a stage for about a week to let it settle.
            <div style={{ marginTop: 8 }}><button className="btn small dark" onClick={() => moveStage(-1)}>Drop back a stage</button></div>
          </div>
        )}

        <PainChart history={history} />

        {!st.isLast && (
          <div className="stack" style={{ gap: 10 }}>
            <b>Progress check: stage {st.stage + 1} to {st.stage + 2}</b>
            {!st.checkUnlocked && (
              <p className="fine">
                {st.waitDays > 0 ? `Unlocks in ${st.waitDays} ${st.waitDays === 1 ? 'day' : 'days'}. Tissues need time at each stage, even when it feels good.` : 'Unlocks when your recent pain ratings average 3/10 or less.'}
              </p>
            )}
            <div className="checks">
              {stage.checks.map(c => (
                <label key={c.id}>
                  <input type="checkbox" disabled={!st.checkUnlocked} checked={!!results[c.id]} onChange={e => setResults(p => ({ ...p, [c.id]: e.target.checked }))} />
                  <span>{c.label}{c.how && <small>{c.how}</small>}</span>
                </label>
              ))}
            </div>
            <div className="row">
              <button className="btn small" disabled={!st.checkUnlocked} onClick={submitCheck}>Save check</button>
              {st.stage > 0 && !st.suggestRegress && <button className="linkbtn warn" onClick={() => moveStage(-1)}>It's getting worse: drop back a stage</button>}
            </div>
          </div>
        )}
        {st.isLast && <p className="ok">You're at the final stage. Keep these exercises in as maintenance; they're what stops it coming back.</p>}
        {msg && <p className="ok" role="status">{msg}</p>}
      </>)}

      <details>
        <summary className="linkbtn" style={{ cursor: 'pointer' }}>Warning signs for {def.name.toLowerCase()}</summary>
        <ul className="flags" style={{ marginTop: 8 }}>{def.redFlags.map(f => <li key={f}>{f}</li>)}</ul>
      </details>
    </section>
  );
}

function PainChart({ history }: { history: { date: string; pain: number }[] }) {
  if (history.length < 2) return <p className="fine">Rate your pain after each session and a trend chart will show up here.</p>;
  const W = 300, H = 72, pad = 4;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (history.length - 1);
  const y = (p: number) => H - pad - (p / 10) * (H - 2 * pad);
  const pts = history.map((h, i) => `${x(i)},${y(h.pain)}`).join(' ');
  return (
    <figure style={{ margin: 0 }}>
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Pain over your last ${history.length} ratings, most recently ${history.at(-1)!.pain} out of 10`}>
        <rect x="0" y={y(10)} width={W} height={y(6) - y(10)} fill="var(--red-soft)" />
        <rect x="0" y={y(5)} width={W} height={y(3) - y(5)} fill="var(--warn-soft)" />
        <rect x="0" y={y(2)} width={W} height={y(0) - y(2)} fill="var(--green-soft)" />
        <polyline points={pts} fill="none" stroke="var(--ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <figcaption className="fine row"><span>{fmtShort(history[0].date)}</span><span className="spacer" /><span>Latest {history.at(-1)!.pain}/10</span></figcaption>
    </figure>
  );
}
