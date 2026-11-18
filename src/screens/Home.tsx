import { useMemo, useState } from 'react';
import { streakLine, XpBar } from '../components/RankSheet';
import { Effort } from '../components/ui';
import { Flame, LineChart, MonthCalendar, RankBadge, type DayMark } from '../components/visuals';
import { EX } from '../data/exercises';
import { daysBetween, fmtLong, fmtShort, today } from '../engine/dates';
import { isRestDay, REFERRAL, levelInfo, levelName, liftHistory, plannedTrainingDays, type Progress, type WorkoutRecord } from '../engine/progress';
import type { AppState, CustomWorkout } from '../engine/types';
import { planPosition } from './Today';

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function ago(date: string): string {
  const n = daysBetween(date, today());
  return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : n < 7 ? `${n} days ago` : fmtShort(date);
}

export function Home({ state, progress, onInvite, onRank, onStreak, onPlan, onStartWorkout, onWorkouts, onOpenRecord, onGetPlan }: {
  state: AppState; progress: Progress; onInvite: () => void;
  onRank: () => void; onStreak: () => void; onPlan: () => void;
  onStartWorkout: (w: CustomWorkout | null) => void; onWorkouts: () => void;
  onOpenRecord: (r: WorkoutRecord) => void; onGetPlan: () => void;
}) {
  const profile = state.profile!;
  const t = today();
  const info = levelInfo(progress.xp);
  const planned = useMemo(() => plannedTrainingDays(state), [state]);
  const lifts = useMemo(() => liftHistory(state), [state]);
  const liftIds = useMemo(() => Object.keys(lifts).sort((a, b) => lifts[b].length - lifts[a].length || EX[a].name.localeCompare(EX[b].name)), [lifts]);
  const [lift, setLift] = useState<string | null>(null);
  const shown = lift && lifts[lift] ? lift : liftIds[0] ?? null;
  const last = progress.records[progress.records.length - 1] ?? null;

  const mark = (d: string): DayMark => {
    if (progress.workoutDays.has(d)) return 'done';
    if (planned.has(d)) return d < t ? 'missed' : 'planned';
    if (isRestDay(state, d)) return 'rest';
    return null;
  };

  return (
    <div className="wrap home">
      <header className="mast">
        <div>
          <p className="label">{fmtLong(t)}</p>
          <h1>{greeting()}, {profile.name}</h1>
        </div>
      </header>

      <div className="home-grid">
        <button className="card status rank-card" onClick={onRank}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <RankBadge level={info.level} size={52} />
            <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
              <span className="label">Rank</span>
              <b className="status-big">{info.name}</b>
            </div>
          </div>
          <XpBar into={info.into} needed={info.needed} />
          <span className="fine">{(info.needed - info.into).toLocaleString()} XP to {levelName(info.level + 1)}</span>
        </button>
        <button className={`card status streak-card ${progress.streak.status}`} onClick={onStreak}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Flame lit={progress.streak.count > 0} size={48} warn={progress.streak.status === 'last-chance'} />
            <div className="stack" style={{ gap: 4, flex: 1 }}>
              <span className="label">Streak</span>
              <b className="status-big">{progress.streak.count} day{progress.streak.count === 1 ? '' : 's'}</b>
            </div>
          </div>
          <span className="fine">{streakLine(progress)}</span>
        </button>

        <TodayCard state={state} onPlan={onPlan} onStartWorkout={onStartWorkout} onWorkouts={onWorkouts} done={progress.workoutDays.has(t)} />

        <section className="card cal-card">
          <h3>Your training</h3>
          <MonthCalendar mark={mark} />
        </section>

        <section className="card chart-card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>Strength</h3>
            {liftIds.length > 1 && (
              <select className="input select" value={shown ?? ''} onChange={e => setLift(e.target.value)} aria-label="Pick a lift">
                {liftIds.map(id => <option key={id} value={id}>{EX[id].name}</option>)}
              </select>
            )}
          </div>
          {shown ? <StrengthChart name={EX[shown].name} points={lifts[shown]} unit={profile.units} /> : (
            <div className="empty">
              <svg viewBox="0 0 120 50" aria-hidden="true"><path d="M4 44 L30 36 L52 38 L76 22 L98 18 L116 6" fill="none" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 7" /></svg>
              <p className="muted">Log the weight you use on any lift and you'll see it climb here.</p>
            </div>
          )}
        </section>

        <section className="card recap">
          <h3>Last workout</h3>
          {last ? <Recap r={last} progress={progress} units={profile.units} onOpen={() => onOpenRecord(last)} /> : (
            <p className="muted">Nothing logged yet. Your last workout will show up here with what you did and the XP you earned.</p>
          )}
        </section>

        <button className="card invite-strip" onClick={onInvite}>
          <span className="invite-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M18 8v6M15 11h6" /></svg>
          </span>
          <span className="stack" style={{ gap: 2, flex: 1, textAlign: 'left' }}>
            <b>Train with a friend</b>
            <span className="fine">Invite someone. When they finish a workout you get +{REFERRAL.inviter} XP and they get +{REFERRAL.friend}.</span>
          </span>
          <span className="linkbtn">Invite</span>
        </button>

        {profile.goal === 'free' && (
          <section className="card plan-cta">
            <span className="label">Want a plan?</span>
            <h3>Get a plan built for you</h3>
            <p className="muted" style={{ fontSize: 15 }}>Answer a few questions about your sport, season or injury and Build Up writes your sessions for you. Your workouts, XP and streak stay.</p>
            <button className="btn ghost small" onClick={onGetPlan}>Build my plan</button>
          </section>
        )}
      </div>
    </div>
  );
}

function TodayCard({ state, onPlan, onStartWorkout, onWorkouts, done }: {
  state: AppState; onPlan: () => void; onStartWorkout: (w: CustomWorkout | null) => void; onWorkouts: () => void; done: boolean;
}) {
  const plan = state.plan;
  const t = today();
  if (plan && t >= plan.startDate) {
    const pos = planPosition(plan, t);
    const day = pos.after ? null : plan.weeks[pos.week - 1].days[pos.day];
    if (day) {
      const rest = day.kind === 'rest' || day.kind === 'game';
      const logged = !!state.logs[t]?.completedAt;
      return (
        <section className="card today-card">
          <span className="label">Today · Week {pos.week}</span>
          <h3 className="today-title">{day.title}</h3>
          {!rest && <div className="meta"><span><Effort level={day.effort} />{['Easy', 'Moderate', 'Hard'][day.effort - 1]}</span><span>About {day.minutes} min</span></div>}
          <p className="muted" style={{ fontSize: 15 }}>{day.focus}</p>
          <div className="row">
            {rest
              ? <button className="btn ghost small" onClick={onWorkouts}>Do your own workout</button>
              : <button className={`btn small${logged ? ' done' : ''}`} onClick={onPlan}>{logged ? 'Done. View session' : 'Start session'}</button>}
          </div>
        </section>
      );
    }
  }
  const mine = state.workouts.slice(0, 3);
  return (
    <section className="card today-card">
      <span className="label">Today</span>
      <h3 className="today-title">{done ? 'Nice work today' : 'Ready to train?'}</h3>
      {mine.length > 0 ? (
        <div className="quick">
          {mine.map(w => (
            <button key={w.id} className="quick-w" onClick={() => onStartWorkout(w)}>
              <b>{w.name}</b><span>{w.items.length} exercises</span>
            </button>
          ))}
        </div>
      ) : <p className="muted" style={{ fontSize: 15 }}>Pick a ready-made workout or build your own.</p>}
      <div className="row">
        <button className="btn small" onClick={() => onStartWorkout(null)}>Start empty workout</button>
        <button className="btn ghost small" onClick={onWorkouts}>{mine.length ? 'All workouts' : 'Browse workouts'}</button>
      </div>
    </section>
  );
}

function StrengthChart({ name, points, unit }: { name: string; points: { date: string; weight: number }[]; unit: string }) {
  const first = points[0];
  const lastP = points[points.length - 1];
  const best = Math.max(...points.map(p => p.weight));
  const diff = Math.round((lastP.weight - first.weight) * 10) / 10;
  const pct = first.weight ? Math.round((diff / first.weight) * 100) : 0;
  return (
    <>
      <div className="hero-num">
        <b className="mono">{lastP.weight}<small> {unit}</small></b>
        <span className={diff > 0 ? 'up' : diff < 0 ? 'down' : ''}>
          {points.length < 2 ? 'Log it again to see your trend' : diff === 0 ? `Same as ${fmtShort(first.date)}` : `${diff > 0 ? '+' : ''}${diff} ${unit} (${pct > 0 ? '+' : ''}${pct}%) since ${fmtShort(first.date)}`}
        </span>
      </div>
      <LineChart points={points.map(p => ({ date: p.date, value: p.weight }))} unit={unit} label={`${name}, best weight per workout`} />
      <span className="fine">{name} · best weight each workout · all-time best {best} {unit}</span>
    </>
  );
}

function Recap({ r, progress, units, onOpen }: { r: WorkoutRecord; progress: Progress; units: string; onOpen: () => void }) {
  const x = progress.byWorkout.get(r);
  const prs = x?.prs ?? [];
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <b className="recap-title">{r.title}</b>
        <span className="fine">{ago(r.date)}</span>
      </div>
      <div className="tiles">
        <div><b className="mono">{r.exercises}</b><span>exercises</span></div>
        {r.kind === 'custom' && <div><b className="mono">{r.sets}</b><span>sets</span></div>}
        {r.volume > 0 && <div><b className="mono">{r.volume >= 10000 ? `${Math.round(r.volume / 100) / 10}k` : r.volume.toLocaleString()}</b><span>{units} lifted</span></div>}
        {r.rpe && <div><b className="mono">{r.rpe}/10</b><span>effort</span></div>}
        <div className="xp-tile"><b className="mono">+{x?.xp ?? 0}</b><span>XP</span></div>
      </div>
      {prs.length > 0 && (
        <div className="prs">
          {prs.slice(0, 3).map(id => <span key={id} className="pill pr">PR · {EX[id].name} {r.weights[id]} {units}</span>)}
          {prs.length > 3 && <span className="pill pr">+{prs.length - 3} more PRs</span>}
        </div>
      )}
      {r.note && <p className="fine">“{r.note}”</p>}
      <button className="linkbtn" onClick={onOpen}>See the whole workout</button>
    </div>
  );
}
