import { Effort } from '../components/ui';
import { DAY_SHORT, fmtShort, today } from '../engine/dates';
import { dateOf } from '../engine/generate';
import type { AppState } from '../engine/types';
import { isComplete, PHASE_COLORS, planPosition } from './Today';

export function PlanView({ state, onOpen }: { state: AppState; onOpen: (f: { week: number; day: number }) => void }) {
  const plan = state.plan!;
  const t = today();
  const now = planPosition(plan, t);
  const maxLoad = Math.max(...plan.weeks.map(w => w.load), 1);

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <p className="label">Your plan</p>
          <h1>{plan.title}</h1>
          <p className="sub" style={{ maxWidth: '62ch', marginTop: 6 }}>{plan.summary}</p>
        </div>
      </header>

      <section aria-label="Weekly load">
        <div className="profile">
          {plan.weeks.map(w => (
            <button key={w.n} className={`wk${w.n === now.week && !now.before && !now.after ? ' now' : ''}`} onClick={() => onOpen({ week: w.n, day: 0 })} aria-label={`Week ${w.n}, load ${w.load} of 10${w.deload ? ', lighter week' : ''}`}>
              <span className="bar-track"><span className="bar" style={{ height: `${(w.load / maxLoad) * 100}%`, background: PHASE_COLORS[w.phase % 4], opacity: w.deload ? 0.55 : 1 }} /></span>
              <span className="wl">{w.n}</span>
            </button>
          ))}
        </div>
        <div className="phases" style={{ gridTemplateColumns: plan.phases.map(p => `${p.end - p.start + 1}fr`).join(' ') }}>
          {plan.phases.map((p, i) => <div key={i} style={{ borderColor: PHASE_COLORS[i % 4] }}>{p.name}</div>)}
        </div>
      </section>

      <div className="phase-cards">
        {plan.phases.map((p, i) => (
          <div key={i} className="card" style={{ borderTopColor: PHASE_COLORS[i % 4] }}>
            <span className="label">Weeks {p.start}{p.end > p.start ? `–${p.end}` : ''}</span>
            <h3>{p.name}</h3>
            <p style={{ fontSize: 15 }}>{p.goal}</p>
            <ul>{p.notes.map(n => <li key={n}>{n}</li>)}</ul>
          </div>
        ))}
      </div>

      <div className="scroll-x">
        <table className="grid">
          <thead>
            <tr><th scope="col"><span className="sr">Week</span></th>{DAY_SHORT.map(d => <th key={d} scope="col">{d}</th>)}</tr>
          </thead>
          <tbody>
            {plan.weeks.map(w => (
              <tr key={w.n}>
                <th scope="row" style={{ borderLeftColor: PHASE_COLORS[w.phase % 4] }}>
                  <b>Wk {w.n}</b>
                  <small>{fmtShort(dateOf(plan, w.n, 0))}{w.deload ? ' · light' : ''}</small>
                </th>
                {w.days.map((d, i) => {
                  const ds = dateOf(plan, w.n, i);
                  const cls = ['cell', ds === t ? 'is-today' : '', isComplete(state.logs[ds]) ? 'is-done' : '', d.kind === 'rest' ? 'rest' : ''].join(' ');
                  return (
                    <td key={i}>
                      <button className={cls} onClick={() => onOpen({ week: w.n, day: i })}>
                        <span className="ct">{d.kind !== 'rest' && <Effort level={d.effort} />}{d.title}</span>
                        <span className="cd">{d.minutes ? `${d.minutes} min` : ' '}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>How this plan works</h3>
        <ul className="rules">
          {plan.rules.map(r => <li key={r.title}><b>{r.title}</b><span>{r.body}</span></li>)}
        </ul>
        <div className="row fine" style={{ marginTop: 6 }}>
          <span className="row" style={{ gap: 6 }}><Effort level={1} /> Easy</span>
          <span className="row" style={{ gap: 6 }}><Effort level={2} /> Moderate</span>
          <span className="row" style={{ gap: 6 }}><Effort level={3} /> Hard</span>
        </div>
      </div>
    </div>
  );
}
