import { useMemo, useState } from 'react';
import { ExerciseInfo, SwapSheet } from '../components/ExerciseSheets';
import { CheckIcon, Chevron, Effort, PainSlider } from '../components/ui';
import { EX } from '../data/exercises';
import { INJURY } from '../data/injuries';
import { DAY_SHORT, daysBetween, fmtLong, fmtShort, parse, today } from '../engine/dates';
import { dateOf } from '../engine/generate';
import { currentStage, rehabItems, resolveItems, tierOf, type Dropped, type Resolved } from '../engine/resolve';
import type { AppState, DayLog, Exercise, Plan, PlanDay } from '../engine/types';
import { update, updateLog } from '../state/store';

export const PHASE_COLORS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];

export function planPosition(plan: Plan, date: string): { week: number; day: number; before: boolean; after: boolean } {
  const idx = daysBetween(plan.weekOneMonday, date);
  const last = plan.weeks.length * 7 - 1;
  const c = Math.min(Math.max(idx, 0), last);
  return { week: Math.floor(c / 7) + 1, day: c % 7, before: date < plan.startDate, after: idx > last };
}

export function isComplete(log: DayLog | undefined): boolean {
  return !!log?.completedAt;
}

export function Today({ state, focus, onFocus, onRebuild, onRehab }: {
  state: AppState; focus: { week: number; day: number } | null; onFocus: (f: { week: number; day: number }) => void;
  onRebuild: () => void; onRehab: () => void;
}) {
  const plan = state.plan!;
  const profile = state.profile!;
  const t = today();
  const pos = planPosition(plan, t < plan.startDate ? plan.startDate : t);
  const week = focus?.week ?? pos.week;
  const day = focus?.day ?? pos.day;
  const w = plan.weeks[week - 1];
  const date = dateOf(plan, week, day);
  const phase = plan.phases[w.phase];
  const pd = w.days[day];

  const trainingThisWeek = w.days.map((d, i) => ({ d, date: dateOf(plan, week, i) })).filter(x => x.d.kind === 'train' || x.d.kind === 'rehab' || x.d.kind === 'recovery');
  const doneThisWeek = trainingThisWeek.filter(x => isComplete(state.logs[x.date])).length;
  const allSessions = plan.weeks.flatMap((wk, wi) => wk.days.map((d, di) => ({ d, date: dateOf(plan, wi + 1, di) }))).filter(x => x.d.kind !== 'rest' && x.d.kind !== 'game');
  const doneAll = allSessions.filter(x => isComplete(state.logs[x.date])).length;
  const daysLeft = Math.max(0, daysBetween(t, dateOf(plan, plan.weeks.length, 6)));

  return (
    <div className="wrap">
      {pos.after && (
        <div className="banner"><span>You finished <b>{plan.title}</b>. Ready for the next block?</span><span className="spacer" /><button className="btn" onClick={onRebuild}>Build next plan</button></div>
      )}
      {t < plan.startDate && <p className="note" style={{ marginBottom: 14 }}>Your plan starts {fmtLong(plan.startDate)}. Here's your first week.</p>}
      <header className="mast">
        <div>
          <p className="label">{plan.title}</p>
          <h1>Hi {profile.name}</h1>
        </div>
        <div className="count">
          <span className="big">{week}</span>
          <span className="s"><strong>of {plan.weeks.length} weeks</strong>{daysLeft} days to go</span>
        </div>
      </header>

      <div className="layout">
        <main>
          <div className="weekbar">
            <div className="stepper">
              <button aria-label="Previous week" disabled={week <= 1} onClick={() => onFocus({ week: week - 1, day })}><Chevron dir="left" /></button>
              <span className="wkname">Week {week}</span>
              <button aria-label="Next week" disabled={week >= plan.weeks.length} onClick={() => onFocus({ week: week + 1, day })}><Chevron dir="right" /></button>
            </div>
            <span className="pill"><i style={{ background: PHASE_COLORS[w.phase % 4] }} />{phase.name}{w.deload ? ' · lighter week' : ''}</span>
          </div>
          <div className="days" role="tablist" aria-label="Days of the week">
            {w.days.map((d, i) => {
              const ds = dateOf(plan, week, i);
              const cls = ['day', ds === t ? 'is-today' : '', isComplete(state.logs[ds]) ? 'is-done' : '', d.kind === 'rest' || ds < plan.startDate ? 'off' : ''].join(' ');
              return (
                <button key={i} role="tab" className={cls} aria-current={i === day} aria-selected={i === day} onClick={() => onFocus({ week, day: i })}>
                  <span className="dn">{DAY_SHORT[i]}</span>
                  {d.kind === 'rest' ? <span className="fine">–</span> : <Effort level={d.effort} />}
                  <span className="dd">{parse(ds).getDate()}</span>
                </button>
              );
            })}
          </div>
          <Session key={date} state={state} day={pd} date={date} beforeStart={date < plan.startDate} onRehab={onRehab} />
        </main>

        <aside className="side">
          <div className="card">
            <h3>This week</h3>
            <div className="stat-row"><span className="muted">Sessions done</span><b>{doneThisWeek}/{trainingThisWeek.length}</b></div>
            <div className="meter"><i style={{ width: `${trainingThisWeek.length ? (doneThisWeek / trainingThisWeek.length) * 100 : 0}%` }} /></div>
            <div className="stat-row"><span className="muted">Whole plan</span><span className="mono">{doneAll}/{allSessions.length}</span></div>
          </div>
          {profile.injuries.length > 0 && (
            <div className="card">
              <h3>Rehab</h3>
              {profile.injuries.map(inj => (
                <div key={inj.id} className="stat-row">
                  <span>{INJURY[inj.id].name}</span>
                  <span className="pill">{inj.protectOnly && !state.rehab[inj.id]?.cleared ? 'Protecting' : `Stage ${(state.rehab[inj.id]?.stage ?? 0) + 1}: ${currentStage(state.rehab, inj.id).name}`}</span>
                </div>
              ))}
              <button className="linkbtn" onClick={onRehab}>Pain guide & progress checks</button>
            </div>
          )}
          <div className="card">
            <h3>{phase.name} phase</h3>
            <p className="muted" style={{ fontSize: 15 }}>{phase.goal}</p>
            <ul className="rules">{phase.notes.map(n => <li key={n}>{n}</li>)}</ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Session({ state, day, date, beforeStart, onRehab }: { state: AppState; day: PlanDay; date: string; beforeStart: boolean; onRehab: () => void }) {
  const profile = state.profile!;
  const tier = tierOf(state);
  const log: DayLog = state.logs[date] ?? { done: {}, weights: {}, pain: {}, updatedAt: 0 };
  const [info, setInfo] = useState<Exercise | null>(null);
  const [swap, setSwap] = useState<{ planned: Exercise; current: Exercise } | null>(null);

  const blocks = useMemo(() => {
    const rehabIds = day.blocks.flatMap((b, bi) => (b.rehab ? rehabItems(b.rehab, state.rehab, tier, `${bi}-`).map(r => r.ex.id) : []));
    return day.blocks.map((b, bi) => {
      if (b.rehab) {
        const st = state.rehab[b.rehab]?.stage ?? 0;
        return { b, items: rehabItems(b.rehab, state.rehab, tier, `${bi}-`), dropped: [] as Dropped[], stage: st };
      }
      const r = resolveItems(b.items, `${bi}-`, { rehab: state.rehab, swaps: state.swaps, injuries: profile.injuries, tier }, rehabIds);
      return { b, items: r.items, dropped: r.dropped, stage: -1 };
    });
  }, [day, state.rehab, state.swaps, profile.injuries, tier]);

  const allKeys = blocks.flatMap(x => x.items.map(i => i.key));
  const doneCount = allKeys.filter(k => log.done[k]).length;
  const complete = isComplete(log);

  if (day.kind === 'rest' || day.kind === 'game') {
    return (
      <div className="restday">
        <div className="sess-head">
          <p className="label">{fmtLong(date)}</p>
          <h2>{day.title}</h2>
          <p className="muted">{day.focus}</p>
        </div>
        {profile.injuries.length > 0 && <PainLog state={state} date={date} log={log} />}
      </div>
    );
  }

  const tick = (key: string) => updateLog(date, l => ({ ...l, done: { ...l.done, [key]: !l.done[key] } }));
  const setWeight = (exId: string, v: string) => {
    const n = v === '' ? NaN : Number(v);
    updateLog(date, l => {
      const weights = { ...l.weights };
      if (Number.isFinite(n)) weights[exId] = n; else delete weights[exId];
      return { ...l, weights };
    });
    if (Number.isFinite(n)) update(s => ({ ...s, lastWeight: { ...s.lastWeight, [exId]: n } }));
  };

  return (
    <>
      <div className="sess-head">
        <p className="label">{fmtLong(date)}{beforeStart ? ' · before your start date' : ''}</p>
        <h2>{day.title}</h2>
        <div className="meta">
          <span><Effort level={day.effort} />{['Easy', 'Moderate', 'Hard'][day.effort - 1]}</span>
          <span>About {day.minutes} min</span>
          <span>{doneCount}/{allKeys.length} done</span>
        </div>
        <p>{day.focus}</p>
      </div>

      {blocks.map(({ b, items, dropped, stage }, bi) => (
        <section key={bi} className={`block${b.rehab ? ' rehab' : ''}`}>
          <div className="block-h">
            <h3>{b.rehab ? `${INJURY[b.rehab].name} rehab` : b.title}</h3>
            {b.rehab
              ? <button className="linkbtn" onClick={onRehab}>Stage {stage + 1}: {INJURY[b.rehab].stages[stage].name}</button>
              : b.note && <span className="fine">{b.note}</span>}
          </div>
          {b.rehab && <p className="fine" style={{ marginBottom: 8, color: 'var(--ink)' }}>{INJURY[b.rehab].painNote}</p>}
          <ol className="exs">
            {items.map(r => (
              <ExRow key={r.key} r={r} done={!!log.done[r.key]} onTick={() => tick(r.key)}
                weight={log.weights[r.ex.id]} lastWeight={state.lastWeight[r.ex.id]} units={profile.units} onWeight={v => setWeight(r.ex.id, v)}
                onInfo={() => setInfo(r.ex)} onSwap={b.rehab ? undefined : () => setSwap({ planned: EX[r.planned], current: r.ex })} />
            ))}
          </ol>
          {dropped.map(dr => <p key={dr.key} className="dropped">{dr.from.name}: {dr.why.toLowerCase()}.</p>)}
        </section>
      ))}

      <div className="finish">
        <h3>{complete ? 'Session complete' : 'Finish up'}</h3>
        {profile.injuries.length > 0 && <PainLog state={state} date={date} log={log} />}
        <div className="stack" style={{ gap: 8 }}>
          <b>How hard was it overall?</b>
          <div className="rpe" role="group" aria-label="Session effort, 1 to 10">
            {Array.from({ length: 10 }, (_, k) => k + 1).map(n => (
              <button key={n} aria-pressed={log.rpe === n} onClick={() => updateLog(date, l => ({ ...l, rpe: n }))}>{n}</button>
            ))}
          </div>
          <span className="fine">1 is very easy, 10 is everything you had.</span>
        </div>
        <div className="field">
          <label htmlFor={`note-${date}`}>Notes</label>
          <textarea id={`note-${date}`} className="input" placeholder="Anything worth remembering for next time" value={log.note ?? ''} onChange={e => updateLog(date, l => ({ ...l, note: e.target.value }))} />
        </div>
        {complete
          ? <div className="row"><span className="pill green">Completed {fmtShort(log.completedAt!.slice(0, 10))}</span><button className="linkbtn warn" onClick={() => updateLog(date, l => ({ ...l, completedAt: undefined }))}>Mark as not done</button></div>
          : <button className="btn done block" onClick={() => updateLog(date, l => ({ ...l, completedAt: new Date().toISOString(), done: Object.fromEntries(allKeys.map(k => [k, l.done[k] ?? true])) }))}>Complete session</button>}
      </div>

      {info && <ExerciseInfo ex={info} onClose={() => setInfo(null)} />}
      {swap && <SwapSheet planned={swap.planned} current={swap.current} state={state} tier={tier} onClose={() => setSwap(null)} />}
    </>
  );
}

function ExRow({ r, done, onTick, weight, lastWeight, units, onWeight, onInfo, onSwap }: {
  r: Resolved; done: boolean; onTick: () => void; weight?: number; lastWeight?: number; units: string;
  onWeight: (v: string) => void; onInfo: () => void; onSwap?: () => void;
}) {
  const { item, ex } = r;
  return (
    <li className={`ex${done ? ' is-done' : ''}`}>
      <button className="tick" aria-pressed={done} aria-label={`Mark ${ex.name} done`} onClick={onTick}><CheckIcon /></button>
      <div>
        <div className="ex-top">
          <button className="ex-name" onClick={onInfo}>{ex.name}</button>
          <span className="ex-right">
            <span className="dose">{item.sets} × {item.reps}</span>
            {ex.loaded && (
              <label className="wt">
                <input type="number" inputMode="decimal" min={0} step={units === 'kg' ? 0.5 : 2.5} className={weight !== undefined ? 'is-set' : ''}
                  placeholder={lastWeight !== undefined ? String(lastWeight) : '–'} value={weight ?? ''} onChange={e => onWeight(e.target.value)} aria-label={`${ex.name} weight in ${units}`} />
                {units}
              </label>
            )}
          </span>
        </div>
        <div className="ex-sub">
          {item.effort && <span>{item.effort}</span>}
          {item.rest && <span>Rest {item.rest}</span>}
          {r.from && <span className="tag-swap" title={`Planned: ${r.from.name}`}>{r.why}</span>}
        </div>
        <div className="ex-actions">
          <button onClick={onInfo}>How to</button>
          {onSwap && <button onClick={onSwap}>Swap</button>}
        </div>
      </div>
    </li>
  );
}

function PainLog({ state, date, log }: { state: AppState; date: string; log: DayLog }) {
  const injuries = state.profile!.injuries;
  return (
    <div className="stack">
      {injuries.map(inj => (
        <PainSlider key={inj.id} label={`${date === today() ? 'Pain today' : 'Pain this day'}: ${INJURY[inj.id].name}`} value={log.pain[inj.id]}
          injuryName={INJURY[inj.id].name} onChange={n => updateLog(date, l => ({ ...l, pain: { ...l.pain, [inj.id]: n } }))} />
      ))}
      <span className="fine">Rate it again tomorrow morning on the next day's screen. Next-morning pain is the best guide.</span>
    </div>
  );
}
