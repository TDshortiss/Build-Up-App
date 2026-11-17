import { useEffect, useMemo, useState } from 'react';
import { ConfirmHost, ask } from './components/ConfirmHost';
import { LevelUp, RankSheet, StreakSheet } from './components/RankSheet';
import { Close, Logo, Seg, TabIcon } from './components/ui';
import { Flame, RankBadge } from './components/visuals';
import { computeProgress, levelInfo, type WorkoutRecord } from './engine/progress';
import type { CustomWorkout } from './engine/types';
import { Home } from './screens/Home';
import { ActiveWorkout, SessionSummary, Workouts } from './screens/Workouts';
import { update } from './state/store';
import { activeSession, startSession } from './state/workouts';
import { tierOf } from './engine/resolve';
import { Library } from './screens/Library';
import { Legal, type LegalPage } from './screens/Legal';
import { Me } from './screens/Me';
import { Onboarding } from './screens/Onboarding';
import { PlanView } from './screens/PlanView';
import { Rehab } from './screens/Rehab';
import { planPosition, Today } from './screens/Today';
import { AuthScreen, Welcome } from './screens/Welcome';
import { retrySync, useSession } from './state/session';
import { useAppState } from './state/store';

type Tab = 'home' | 'plan' | 'workouts' | 'rehab' | 'library' | 'me';
const LEGAL: LegalPage[] = ['terms', 'privacy', 'disclaimer'];

interface InstallEvent extends Event { prompt: () => Promise<void> }

function useInstall() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone;
  return { can: !!evt && !standalone, ios, prompt: () => { void evt?.prompt(); setEvt(null); } };
}

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    const on = () => setHash(window.location.hash.slice(1));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

export function App() {
  const session = useSession();
  const state = useAppState();
  const hash = useHash();
  const install = useInstall();
  const [tab, setTab] = useState<Tab>('home');
  const [planView, setPlanView] = useState<'week' | 'plan'>('week');
  const [focus, setFocus] = useState<{ week: number; day: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [auth, setAuth] = useState<'signup' | 'signin' | null>(null);
  const [installDismissed, setInstallDismissed] = useState(() => readFlag('build-up:install-dismissed'));
  const [sheet, setSheet] = useState<'rank' | 'streak' | null>(null);
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [summary, setSummary] = useState<{ id: string; xpBefore?: number } | null>(null);
  const progress = useMemo(() => computeProgress(state), [state]);
  const level = levelInfo(progress.xp).level;
  const active = activeSession(state);

  useEffect(() => { window.scrollTo(0, 0); }, [tab]);
  // Nobody needs a "level up" for the starting rank.
  useEffect(() => {
    if (state.profile && state.seenLevel === undefined && level === 0) update(s => ({ ...s, seenLevel: 0 }));
  }, [state.profile, state.seenLevel, level]);

  if (LEGAL.includes(hash as LegalPage)) {
    return <Legal page={hash as LegalPage} onBack={() => { window.location.hash = ''; }} />;
  }
  if (session.status === 'loading') return <div className="center"><Logo /></div>;
  if (session.recovery) return <AuthScreen initial="newpass" />;
  if (session.status === 'signed-out') {
    return auth ? <AuthScreen initial={auth} onBack={() => setAuth(null)} /> : <Welcome onStart={setAuth} />;
  }
  if (!state.profile && session.status === 'signed-in' && session.sync === 'syncing') return <div className="center"><Logo /></div>;
  if (!state.profile && session.status === 'signed-in' && (session.sync === 'error' || session.sync === 'offline')) {
    return (
      <div className="center"><div className="stack" style={{ alignItems: 'center', padding: 20 }}>
        <Logo />
        <p>We couldn't load your account{session.sync === 'offline' ? ' because you\'re offline' : ''}.</p>
        <button className="btn" onClick={retrySync}>Try again</button>
      </div></div>
    );
  }
  if (!state.profile || (!state.plan && state.profile.goal !== 'free') || editing) {
    return (
      <Onboarding existing={editing ? state.profile : null}
        onDone={() => { setEditing(false); setTab('home'); setFocus(null); }}
        onCancel={editing ? () => setEditing(false) : undefined} />
    );
  }

  const profile = state.profile;
  const tier = tierOf(state);
  const tabs: [Tab, string][] = [
    ['home', 'Home'],
    ...(state.plan ? [['plan', 'Plan'] as [Tab, string]] : []),
    ['workouts', 'Workouts'],
    ...(profile.injuries.length && state.plan ? [['rehab', 'Rehab'] as [Tab, string]] : []),
    ['library', 'Exercises'],
  ];
  const current: Tab = tab === 'plan' && !state.plan ? 'home' : tab;
  const showInstall = !installDismissed && (install.can || install.ios) && current === 'home';
  const dismissInstall = () => {
    setInstallDismissed(true);
    try { localStorage.setItem('build-up:install-dismissed', '1'); } catch { /* ignore */ }
  };
  const go = (t: Tab) => { setTab(t); if (t === 'plan') { setFocus(null); setPlanView('week'); } };
  const startWorkout = async (w: CustomWorkout | null) => {
    if (active && !(w && active.workoutId === w.id) && !(await ask(`You already have "${active.name}" in progress. Finish or discard it before starting another.`, { yes: 'Open it' }))) return;
    startSession(w);
    setWorkoutOpen(true);
  };
  const openRecord = (r: WorkoutRecord) => {
    if (r.kind === 'custom' && r.id) { setSummary({ id: r.id }); return; }
    if (state.plan) {
      const pos = planPosition(state.plan, r.date);
      setFocus({ week: pos.week, day: pos.day });
      setPlanView('week');
      setTab('plan');
    }
  };
  const info = levelInfo(progress.xp);
  const showLevelUp = !workoutOpen && !summary && (state.seenLevel === undefined ? level > 0 : level > state.seenLevel);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <Logo />
          <span className="spacer" />
          <button className={`chip-btn streak ${progress.streak.status}`} onClick={() => setSheet('streak')} aria-label={`Streak: ${progress.streak.count} days`}>
            <Flame lit={progress.streak.count > 0} size={20} warn={progress.streak.status === 'last-chance'} />
            <span className="mono">{progress.streak.count}</span>
          </button>
          <button className="chip-btn rank" onClick={() => setSheet('rank')} aria-label={`Rank: ${info.name}`}>
            <RankBadge level={info.level} size={20} />
            <span className="rank-label">{info.name}</span>
          </button>
          <button className={`avatar${current === 'me' ? ' on' : ''}`} onClick={() => setTab('me')} aria-label="Profile and settings">
            {profile.name.trim()[0]?.toUpperCase() ?? '?'}
            {session.status === 'signed-in' && <i className="sync-dot" data-s={session.sync} />}
          </button>
        </div>
      </header>
      <nav className="bottom" aria-label="Main">
        <div className="in">
          {tabs.map(([k, label]) => (
            <button key={k} aria-current={current === k ? 'page' : undefined} onClick={() => go(k)}>
              <TabIcon name={k} />{label}
            </button>
          ))}
        </div>
      </nav>

      {showInstall && (
        <div className="wrap" style={{ paddingBottom: 0 }}>
          <div className="banner" style={{ marginBottom: 0 }}>
            <span style={{ flex: 1 }}>{install.ios ? <>Install Build Up: tap <b>Share</b>, then <b>Add to Home Screen</b>.</> : 'Install Build Up on your home screen for quick access.'}</span>
            {install.can && <button className="btn" onClick={install.prompt}>Install</button>}
            <button className="x" onClick={dismissInstall} aria-label="Dismiss"><Close /></button>
          </div>
        </div>
      )}

      {current === 'home' && (
        <Home state={state} progress={progress} onRank={() => setSheet('rank')} onStreak={() => setSheet('streak')}
          onPlan={() => go('plan')} onStartWorkout={startWorkout} onWorkouts={() => go('workouts')} onOpenRecord={openRecord} onGetPlan={() => setEditing(true)} />
      )}
      {current === 'plan' && (<>
        <div className="wrap" style={{ paddingBottom: 0 }}>
          <Seg<'week' | 'plan'> label="Plan view" value={planView} options={[['week', 'Sessions'], ['plan', 'Whole plan']]} onChange={setPlanView} />
        </div>
        {planView === 'week'
          ? <Today state={state} focus={focus} onFocus={setFocus} onRebuild={() => setEditing(true)} onRehab={() => go('rehab')} />
          : <PlanView state={state} onOpen={f => { setFocus(f); setPlanView('week'); }} />}
      </>)}
      {current === 'workouts' && <Workouts state={state} progress={progress} tier={tier} onStart={startWorkout} onOpenSession={id => setSummary({ id })} />}
      {current === 'rehab' && <Rehab state={state} />}
      {current === 'library' && <Library tier={tier} />}
      {current === 'me' && <Me state={state} session={session} progress={progress} onEdit={() => setEditing(true)} onRank={() => setSheet('rank')} onStreak={() => setSheet('streak')} install={install} />}

      {active && !workoutOpen && (
        <button className="resume" onClick={() => setWorkoutOpen(true)}>
          <span className="pulse" aria-hidden="true" /><span><b>{active.name}</b> in progress</span><span className="spacer" /><span className="linkbtn">Resume</span>
        </button>
      )}
      {active && workoutOpen && (
        <ActiveWorkout session={active} state={state} tier={tier} onHide={() => setWorkoutOpen(false)}
          onFinished={id => { setWorkoutOpen(false); setSummary({ id, xpBefore: progress.xp }); }} />
      )}
      {summary && <SessionSummary id={summary.id} state={state} justFinished={summary.xpBefore !== undefined ? { xpBefore: summary.xpBefore } : undefined} onClose={() => setSummary(null)} />}
      {sheet === 'rank' && <RankSheet progress={progress} onClose={() => setSheet(null)} />}
      {sheet === 'streak' && <StreakSheet progress={progress} onClose={() => setSheet(null)} />}
      <ConfirmHost />
      {showLevelUp && <LevelUp level={level} first={state.seenLevel === undefined} onClose={() => update(s => ({ ...s, seenLevel: level }))} />}
    </div>
  );
}
