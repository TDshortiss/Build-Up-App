import { useState } from 'react';
import { Seg } from '../components/ui';
import { INJURY } from '../data/injuries';
import { SPORT } from '../data/sports';
import { DAY_SHORT, fmtShort } from '../engine/dates';
import type { AppState, Units } from '../engine/types';
import { deleteAccount, signOut, type Session } from '../state/session';
import { update } from '../state/store';
import { cloudEnabled } from '../state/supabase';

const GOAL_LABEL = { rehab: 'Injury rehab', offseason: 'Off-season', inseason: 'In-season', general: 'General training' };

export function Me({ state, session, onEdit, install }: { state: AppState; session: Session; onEdit: () => void; install: { can: boolean; prompt: () => void; ios: boolean } }) {
  const p = state.profile!;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `build-up-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const doDelete = async () => {
    if (!confirm(cloudEnabled ? 'Delete your account and all your training data? This can\'t be undone.' : 'Delete all your training data from this device? This can\'t be undone.')) return;
    setBusy(true);
    const e = await deleteAccount();
    setBusy(false);
    if (e) setErr(e);
  };

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <p className="label">Me</p>
          <h1>{p.name}</h1>
        </div>
      </header>
      <div className="me-grid">
        <section className="card">
          <h3>Your answers</h3>
          <dl className="kv">
            <dt>Goal</dt><dd>{GOAL_LABEL[p.goal]}{p.goal === 'general' ? ` · ${{ muscle: 'muscle', strength: 'strength', fitness: 'fitness' }[p.generalFocus]}` : ''}</dd>
            {p.sport && <><dt>Sport</dt><dd>{SPORT[p.sport].name}</dd></>}
            <dt>Injuries</dt><dd>{p.injuries.length ? p.injuries.map(i => INJURY[i.id].name).join(', ') : 'None'}</dd>
            <dt>Days</dt><dd>{p.trainingDays.map(d => DAY_SHORT[d]).join(', ')}</dd>
            <dt>Session</dt><dd>{p.sessionMinutes} min</dd>
            <dt>Equipment</dt><dd>{{ gym: 'Full gym', home: 'Home gear', bodyweight: 'No equipment' }[p.equipment]}</dd>
            <dt>Started</dt><dd>{fmtShort(p.startDate)}</dd>
          </dl>
          <button className="btn ghost" onClick={onEdit}>Change answers & rebuild plan</button>
          <p className="fine">Your workout history and rehab progress are kept when you rebuild.</p>
        </section>

        <section className="card">
          <h3>Settings</h3>
          <div className="row"><span style={{ flex: 1 }}>Weights</span>
            <Seg<Units> label="Weight units" value={p.units} options={[['lb', 'lb'], ['kg', 'kg']]} onChange={units => update(s => ({ ...s, profile: { ...s.profile!, units } }))} />
          </div>
          {Object.keys(state.swaps).length > 0 && (
            <div className="row"><span style={{ flex: 1 }}>{Object.keys(state.swaps).length} exercise swaps</span>
              <button className="linkbtn" onClick={() => update(s => ({ ...s, swaps: {} }))}>Reset swaps</button>
            </div>
          )}
          {install.can && <button className="btn dark" onClick={install.prompt}>Install the app</button>}
          {install.ios && <p className="note">To install on iPhone: tap the Share button in Safari, then <b>Add to Home Screen</b>.</p>}
        </section>

        <section className="card pro">
          <div className="row"><h3 style={{ flex: 1 }}>{session.tier === 'pro' ? 'Pro' : 'Free plan'}</h3><span className="pill">{session.tier === 'pro' ? 'Active' : 'Pro coming soon'}</span></div>
          <p style={{ fontSize: 15 }}>Everything you're using now stays free: custom plans, rehab with progress checks, tracking and sync.</p>
          {session.tier !== 'pro' && (<>
            <b>Pro will add:</b>
            <ul>
              <li>An AI coach that adjusts your plan as you log sessions</li>
              <li>Ask questions about any exercise or injury</li>
              <li>Progress charts for every lift</li>
              <li>More sports and injuries, and multiple plans at once</li>
            </ul>
          </>)}
        </section>

        <section className="card">
          <h3>Account</h3>
          {session.user ? <p>Signed in as <b>{session.user.email}</b></p> : <p className="muted">Device-only mode: your data is saved on this device.</p>}
          {session.user && <p className="fine">Sync: {{ idle: 'waiting', syncing: 'saving…', synced: 'up to date', offline: 'offline, will sync when you reconnect', error: 'couldn\'t sync, will retry' }[session.sync]}</p>}
          <div className="row">
            <button className="btn ghost small" onClick={exportData}>Download my data</button>
            {session.user && <button className="btn ghost small" disabled={busy} onClick={async () => { setBusy(true); await signOut(); setBusy(false); }}>Sign out</button>}
          </div>
          <button className="linkbtn danger" disabled={busy} onClick={doDelete}>{cloudEnabled ? 'Delete my account' : 'Delete my data'}</button>
          {err && <p className="err">{err}</p>}
          <p className="fine"><a href="#terms">Terms</a> · <a href="#privacy">Privacy</a> · <a href="#disclaimer">Medical disclaimer</a></p>
        </section>
      </div>
    </div>
  );
}
