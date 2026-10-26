import { useMemo, useState } from 'react';
import { Chevron, Chip, Opt, PainSlider } from '../components/ui';
import { GENERAL_RED_FLAGS, INJURIES, INJURY } from '../data/injuries';
import { SPORT, SPORTS } from '../data/sports';
import { addDays, DAY_SHORT, mondayOf, today } from '../engine/dates';
import { generatePlan } from '../engine/generate';
import type { AgeGroup, Equipment, Experience, GeneralFocus, Goal, InjuryEntry, InjuryId, Profile, RehabState, SportId, Units } from '../engine/types';
import { update } from '../state/store';

type Draft = Omit<Profile, 'goal'> & { goal: Goal | null; under13?: boolean; agreed: boolean; redFlags: Partial<Record<InjuryId, string[]>> };
type Step = 'name' | 'goal' | 'sport' | 'focus' | 'injuries' | 'injury-detail' | 'timeline' | 'schedule' | 'equipment' | 'about' | 'review';

const DEFAULT_DAYS: Record<number, number[]> = { 1: [2], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

function fresh(): Draft {
  return {
    name: '', goal: null, sport: null, generalFocus: 'muscle', injuries: [], experience: 'intermediate', ageGroup: 'adult',
    equipment: 'gym', trainingDays: DEFAULT_DAYS[4], gameDays: [], sessionMinutes: 60, startDate: today(), targetDate: null,
    weeks: 12, units: 'lb', agreed: false, redFlags: {},
  };
}

const STAGE_OPTIONS = [
  { title: 'It just happened, or it\'s very sore', sub: 'Hurts with everyday things like walking or stairs.' },
  { title: 'Getting better, but sore with exercise', sub: 'Everyday life is mostly fine.' },
  { title: 'Mostly better', sub: 'Only bothers me during hard training or sport.' },
];

export function Onboarding({ existing, onDone, onCancel }: { existing?: Profile | null; onDone: () => void; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>(() => (existing ? { ...existing, agreed: true, redFlags: {} } : fresh()));
  const [i, setI] = useState(0);
  const set = (p: Partial<Draft>) => setD(prev => ({ ...prev, ...p }));

  const steps = useMemo<Step[]>(() => {
    const s: Step[] = ['name', 'goal', d.goal === 'general' ? 'focus' : 'sport', 'injuries'];
    if (d.injuries.length) s.push('injury-detail');
    s.push('timeline', 'schedule', 'equipment', 'about', 'review');
    return s;
  }, [d.goal, d.injuries.length]);
  const step = steps[Math.min(i, steps.length - 1)];

  const valid: Record<Step, boolean> = {
    name: d.name.trim().length > 0,
    goal: d.goal !== null,
    sport: d.goal === 'rehab' || d.sport !== null,
    focus: true,
    injuries: d.goal !== 'rehab' || d.injuries.length > 0,
    'injury-detail': true,
    timeline: true,
    schedule: d.trainingDays.length > 0,
    equipment: true,
    about: !d.under13,
    review: d.agreed,
  };

  const next = () => {
    if (step === 'review') return finish();
    setI(n => Math.min(n + 1, steps.length - 1));
    window.scrollTo(0, 0);
  };
  const back = () => {
    if (i === 0) { onCancel?.(); return; }
    setI(n => n - 1);
    window.scrollTo(0, 0);
  };

  function finish() {
    const profile: Profile = {
      name: d.name.trim(), goal: d.goal ?? 'general', sport: d.goal === 'general' ? null : d.sport, generalFocus: d.generalFocus,
      injuries: d.injuries, experience: d.experience, ageGroup: d.ageGroup, equipment: d.equipment,
      trainingDays: [...d.trainingDays].sort((a, b) => a - b), gameDays: d.goal === 'inseason' ? d.gameDays : [],
      sessionMinutes: d.sessionMinutes, startDate: d.startDate,
      targetDate: d.goal === 'offseason' || d.goal === 'inseason' ? d.targetDate : null, weeks: d.weeks, units: d.units,
    };
    const plan = generatePlan(profile);
    const now = today();
    update(s => {
      const rehab: Partial<Record<InjuryId, RehabState>> = {};
      for (const inj of profile.injuries) {
        const prev = s.rehab[inj.id];
        rehab[inj.id] = prev && existing?.injuries.some(e => e.id === inj.id && e.startStage === inj.startStage)
          ? prev : { stage: inj.startStage, stageStartedAt: now, checks: [] };
      }
      return { ...s, profile, plan, rehab, acceptedTermsAt: s.acceptedTermsAt ?? new Date().toISOString() };
    });
    onDone();
  }

  const sport = d.sport ? SPORT[d.sport] : null;
  const pct = ((i + 1) / steps.length) * 100;

  return (
    <div className="ob">
      <div className="ob-top">
        <button className="x" onClick={back} aria-label={i === 0 ? 'Cancel' : 'Back'} style={{ visibility: i === 0 && !onCancel ? 'hidden' : 'visible' }}><Chevron dir="left" /></button>
        <div className="ob-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
        <span className="fine mono">{i + 1}/{steps.length}</span>
      </div>

      {step === 'name' && (<>
        <h2>Let's build your plan</h2>
        <p className="sub">A few questions about you, your goal and your schedule. It takes about two minutes.</p>
        <div className="field">
          <label htmlFor="name">What should we call you?</label>
          <input id="name" className="input" autoComplete="given-name" value={d.name} onChange={e => set({ name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && valid.name) next(); }} autoFocus />
        </div>
      </>)}

      {step === 'goal' && (<>
        <h2>What's your goal, {d.name.trim() || 'friend'}?</h2>
        <p className="sub">Pick the one that matters most right now. You can change it later.</p>
        <div className="options">
          <Opt big pressed={d.goal === 'rehab'} onClick={() => set({ goal: 'rehab' })} title="Come back from an injury" sub="A step-by-step rehab plan with a pain guide and progress checks." />
          <Opt big pressed={d.goal === 'offseason'} onClick={() => set({ goal: 'offseason' })} title="Off-season: get better" sub="Build strength, speed and power for your sport before the season starts." />
          <Opt big pressed={d.goal === 'inseason'} onClick={() => set({ goal: 'inseason' })} title="In-season: stay strong" sub="Short sessions around games and practice that keep you healthy all season." />
          <Opt big pressed={d.goal === 'general'} onClick={() => set({ goal: 'general', sport: null })} title="General training" sub="Build muscle, get stronger or get fitter. No sport needed." />
        </div>
      </>)}

      {step === 'sport' && (<>
        <h2>{d.goal === 'rehab' ? 'Which sport are you getting back to?' : 'What\'s your sport?'}</h2>
        <p className="sub">{d.goal === 'rehab' ? 'Optional. We use it for the final return-to-sport stage.' : 'Your plan targets what your sport demands, plus the injuries common in it.'}</p>
        <div className="options two">
          {d.goal === 'rehab' && <Opt pressed={d.sport === null} onClick={() => set({ sport: null })} title="No sport" sub="Just everyday life and training." />}
          {SPORTS.map(s => <Opt key={s.id} pressed={d.sport === s.id} onClick={() => set({ sport: s.id as SportId })} title={s.name} sub={s.blurb} />)}
        </div>
      </>)}

      {step === 'focus' && (<>
        <h2>What do you want most?</h2>
        <p className="sub">This sets your reps, rest and how much cardio you do.</p>
        <div className="options">
          {([['muscle', 'Build muscle', 'Hypertrophy. Moderate weights, more sets, close to failure.'],
            ['strength', 'Get stronger', 'Heavier weights on the big lifts, fewer reps.'],
            ['fitness', 'Get fitter & leaner', 'Strength circuits plus cardio and intervals.']] as [GeneralFocus, string, string][])
            .map(([v, t, s]) => <Opt big key={v} pressed={d.generalFocus === v} onClick={() => set({ generalFocus: v })} title={t} sub={s} />)}
        </div>
      </>)}

      {step === 'injuries' && <InjuryPicker d={d} set={set} />}

      {step === 'injury-detail' && (<>
        <h2>Tell us how it feels</h2>
        <p className="sub">This decides where your rehab starts. Be honest: starting too far ahead is the most common way to get hurt again.</p>
        {d.injuries.map(inj => <InjuryDetail key={inj.id} inj={inj} d={d} set={set} />)}
      </>)}

      {step === 'timeline' && <Timeline d={d} set={set} />}

      {step === 'schedule' && (<>
        <h2>Your week</h2>
        <p className="sub">Which days can you train? {d.goal === 'inseason' ? 'We\'ll use up to 3 of them and keep hard work away from games.' : 'Pick 1 to 6 days.'}</p>
        <div className="days7">
          {DAY_SHORT.map((n, idx) => (
            <Chip key={n} pressed={d.trainingDays.includes(idx)} onClick={() => {
              const has = d.trainingDays.includes(idx);
              if (!has && d.trainingDays.length >= 6) return;
              set({ trainingDays: has ? d.trainingDays.filter(x => x !== idx) : [...d.trainingDays, idx] });
            }}>{n}</Chip>
          ))}
        </div>
        <p className="fine" style={{ marginTop: 8 }}>{d.trainingDays.length} {d.trainingDays.length === 1 ? 'day' : 'days'} a week</p>
        {d.goal === 'inseason' && (<>
          <h3 className="label grouph">Game days</h3>
          <div className="days7">
            {DAY_SHORT.map((n, idx) => (
              <Chip key={n} pressed={d.gameDays.includes(idx)} onClick={() => set({ gameDays: d.gameDays.includes(idx) ? d.gameDays.filter(x => x !== idx) : [...d.gameDays, idx] })}>{n}</Chip>
            ))}
          </div>
          <p className="fine" style={{ marginTop: 8 }}>Games change week to week? Pick your usual days. You can move sessions any time.</p>
        </>)}
        <h3 className="label grouph">How long per session?</h3>
        <div className="chips">
          {([30, 45, 60, 75, 90] as const).map(m => <Chip key={m} pressed={d.sessionMinutes === m} onClick={() => set({ sessionMinutes: m })}>{m} min</Chip>)}
        </div>
      </>)}

      {step === 'equipment' && (<>
        <h2>Where do you train?</h2>
        <p className="sub">Every exercise in your plan will work with what you have.</p>
        <div className="options">
          {([['gym', 'Full gym', 'Barbells, racks, cables and machines.'],
            ['home', 'Home with some gear', 'Dumbbells or kettlebells, bands and a bench.'],
            ['bodyweight', 'No equipment', 'Bodyweight, a wall, a step and a chair.']] as [Equipment, string, string][])
            .map(([v, t, s]) => <Opt big key={v} pressed={d.equipment === v} onClick={() => set({ equipment: v })} title={t} sub={s} />)}
        </div>
      </>)}

      {step === 'about' && (<>
        <h2>About you</h2>
        <h3 className="label grouph">Training experience</h3>
        <div className="options">
          {([['beginner', 'Beginner', 'New to lifting, or under a year of regular training.'],
            ['intermediate', 'Intermediate', '1–3 years. Comfortable with squats, deadlifts and presses.'],
            ['advanced', 'Advanced', '3+ years of structured training.']] as [Experience, string, string][])
            .map(([v, t, s]) => <Opt key={v} pressed={d.experience === v} onClick={() => set({ experience: v })} title={t} sub={s} />)}
        </div>
        <h3 className="label grouph">Age</h3>
        <div className="chips">
          <Chip pressed={!!d.under13} onClick={() => set({ under13: true })}>Under 13</Chip>
          {([['teen', '13–17'], ['adult', '18–49'], ['masters', '50+']] as [AgeGroup, string][])
            .map(([v, l]) => <Chip key={v} pressed={!d.under13 && d.ageGroup === v} onClick={() => set({ ageGroup: v, under13: false })}>{l}</Chip>)}
        </div>
        {d.under13 && <p className="warnbox" style={{ marginTop: 12 }}>Build Up is for ages 13 and up. Young athletes do best with a coach in person.</p>}
        {!d.under13 && d.ageGroup === 'teen' && <p className="note" style={{ marginTop: 12 }}>Your plan keeps reps at 5 or more and skips the most intense jumps. Have a parent or coach check your technique on the big lifts.</p>}
        <h3 className="label grouph">Weights in</h3>
        <div className="chips">
          {([['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']] as [Units, string][]).map(([v, l]) => <Chip key={v} pressed={d.units === v} onClick={() => set({ units: v })}>{l}</Chip>)}
        </div>
      </>)}

      {step === 'review' && (<>
        <h2>Ready to build</h2>
        <div className="card review">
          <dl>
            <dt>Goal</dt><dd>{{ rehab: 'Injury rehab', offseason: 'Off-season performance', inseason: 'In-season support', general: { muscle: 'Build muscle', strength: 'Get stronger', fitness: 'Get fitter' }[d.generalFocus] }[d.goal ?? 'general']}</dd>
            {sport && d.goal !== 'general' && <><dt>Sport</dt><dd>{sport.name}</dd></>}
            <dt>Injuries</dt><dd>{d.injuries.length ? d.injuries.map(x => INJURY[x.id].name).join(', ') : 'None'}</dd>
            <dt>Schedule</dt><dd>{d.trainingDays.length} days, {d.sessionMinutes} min</dd>
            <dt>Equipment</dt><dd>{{ gym: 'Full gym', home: 'Home gear', bodyweight: 'No equipment' }[d.equipment]}</dd>
          </dl>
        </div>
        <label className="agree" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={d.agreed} onChange={e => set({ agreed: e.target.checked })} />
          <span>I understand Build Up gives general training information, not medical advice, and that I should see a doctor or physio for injuries that are severe or not improving. I agree to the <a href="#terms" target="_blank">Terms</a>.</span>
        </label>
      </>)}

      <div className="ob-foot">
        <div className="in">
          {step === 'injuries' && d.goal !== 'rehab' && d.injuries.length === 0
            ? <button className="btn" onClick={next}>Nothing hurts. Next</button>
            : <button className="btn" disabled={!valid[step]} onClick={next}>{step === 'review' ? (existing ? 'Rebuild my plan' : 'Build my plan') : 'Next'}</button>}
        </div>
      </div>
    </div>
  );
}

function InjuryPicker({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const sport = d.sport ? SPORT[d.sport] : null;
  const common = sport ? sport.injuries.map(id => INJURY[id]) : [];
  const rest = INJURIES.filter(x => !common.includes(x));
  const toggle = (id: InjuryId) => {
    const has = d.injuries.some(x => x.id === id);
    if (has) set({ injuries: d.injuries.filter(x => x.id !== id) });
    else if (d.injuries.length < 2) set({ injuries: [...d.injuries, { id, pain: 3, startStage: 0, protectOnly: false }] });
  };
  const item = (x: (typeof INJURIES)[number]) => (
    <Opt check key={x.id} pressed={d.injuries.some(i => i.id === x.id)} onClick={() => toggle(x.id)} title={x.name} sub={x.aka} />
  );
  return (<>
    <h2>{d.goal === 'rehab' ? 'What are you recovering from?' : 'Anything hurting right now?'}</h2>
    <p className="sub">{d.goal === 'rehab' ? 'Pick up to two.' : 'Pick up to two and we\'ll build rehab into your sessions and swap out anything that could aggravate it.'}</p>
    {common.length > 0 && <><h3 className="label grouph">Common in {sport!.name}</h3><div className="options">{common.map(item)}</div></>}
    <h3 className="label grouph">{common.length ? 'Other' : 'Injuries'}</h3>
    <div className="options">{rest.map(item)}</div>
    <p className="fine" style={{ marginTop: 14 }}>Don't see yours? Pick the closest match by area, or talk to a physio. More injuries are coming.</p>
  </>);
}

function InjuryDetail({ inj, d, set }: { inj: InjuryEntry; d: Draft; set: (p: Partial<Draft>) => void }) {
  const def = INJURY[inj.id];
  const flags = d.redFlags[inj.id] ?? [];
  const patch = (p: Partial<InjuryEntry>) => set({ injuries: d.injuries.map(x => (x.id === inj.id ? { ...x, ...p } : x)) });
  const toggleFlag = (f: string) => {
    const next = flags.includes(f) ? flags.filter(x => x !== f) : [...flags, f];
    set({ redFlags: { ...d.redFlags, [inj.id]: next }, injuries: d.injuries.map(x => (x.id === inj.id ? { ...x, protectOnly: next.length > 0 } : x)) });
  };
  return (
    <div className="injury-detail">
      <h3>{def.name}</h3>
      <p className="muted" style={{ fontSize: 15 }}>{def.summary}</p>
      <div className="options">
        {STAGE_OPTIONS.map((o, idx) => <Opt key={idx} pressed={inj.startStage === idx} onClick={() => patch({ startStage: idx })} title={o.title} sub={o.sub} />)}
      </div>
      <PainSlider label="Pain on a normal day" value={inj.pain} onChange={pain => patch({ pain, startStage: pain >= 6 ? 0 : inj.startStage })} injuryName={def.name} />
      <div className="stack" style={{ gap: 8 }}>
        <b>Do any of these apply?</b>
        <div className="options">
          {[...def.redFlags, ...GENERAL_RED_FLAGS].map(f => <Opt check key={f} pressed={flags.includes(f)} onClick={() => toggleFlag(f)} title={f} />)}
        </div>
      </div>
      {inj.protectOnly && (
        <p className="dangerbox">Please get this checked by a doctor or physio before starting rehab. Until you tell us you've been cleared, your plan keeps this area protected and skips the rehab exercises.</p>
      )}
    </div>
  );
}

function Timeline({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  const t = today();
  const nextMon = addDays(mondayOf(t), 7);
  const dated = d.goal === 'offseason' || d.goal === 'inseason';
  const lengths = d.goal === 'rehab' ? [6, 8, 12] : [8, 12, 16];
  return (<>
    <h2>{d.goal === 'offseason' ? 'When does your season start?' : d.goal === 'inseason' ? 'When does your season end?' : 'How long a plan?'}</h2>
    <p className="sub">{d.goal === 'offseason' ? 'We\'ll time your phases so you peak for the first game.' : d.goal === 'inseason' ? 'Your plan runs until then, with a lighter week every fourth week.' : 'You can rebuild or extend it when it ends.'}</p>
    {dated && (
      <div className="field" style={{ marginBottom: 18 }}>
        <label htmlFor="target">{d.goal === 'offseason' ? 'First game or season start' : 'Last game of the season'}</label>
        <input id="target" className="input" type="date" min={addDays(t, 28)} value={d.targetDate ?? ''} onChange={e => set({ targetDate: e.target.value || null })} />
        <small>{d.targetDate ? <button type="button" className="linkbtn" onClick={() => set({ targetDate: null })}>Not sure? Clear the date</button> : 'Not sure? Leave it blank and pick a length below.'}</small>
      </div>
    )}
    {(!dated || !d.targetDate) && (
      <div className="chips">
        {lengths.map(w => <Chip key={w} pressed={d.weeks === w} onClick={() => set({ weeks: w })}>{w} weeks</Chip>)}
      </div>
    )}
    <h3 className="label grouph">Start</h3>
    <div className="chips">
      <Chip pressed={d.startDate === t} onClick={() => set({ startDate: t })}>Today</Chip>
      {nextMon !== t && <Chip pressed={d.startDate === nextMon} onClick={() => set({ startDate: nextMon })}>Next Monday</Chip>}
    </div>
  </>);
}
