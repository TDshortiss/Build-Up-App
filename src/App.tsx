import { useEffect, useState } from 'react';
import { Close, Logo, TabIcon } from './components/ui';
import { tierOf } from './engine/resolve';
import { Library } from './screens/Library';
import { Legal, type LegalPage } from './screens/Legal';
import { Me } from './screens/Me';
import { Onboarding } from './screens/Onboarding';
import { PlanView } from './screens/PlanView';
import { Rehab } from './screens/Rehab';
import { Today } from './screens/Today';
import { AuthScreen, Welcome } from './screens/Welcome';
import { retrySync, useSession } from './state/session';
import { useAppState } from './state/store';

type Tab = 'today' | 'plan' | 'rehab' | 'library' | 'me';
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
  const [tab, setTab] = useState<Tab>('today');
  const [focus, setFocus] = useState<{ week: number; day: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [auth, setAuth] = useState<'signup' | 'signin' | null>(null);
  const [installDismissed, setInstallDismissed] = useState(() => readFlag('build-up:install-dismissed'));

  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

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
  if (!state.profile || !state.plan || editing) {
    return (
      <Onboarding existing={editing ? state.profile : null}
        onDone={() => { setEditing(false); setTab('today'); setFocus(null); }}
        onCancel={editing ? () => setEditing(false) : undefined} />
    );
  }

  const tabs: [Tab, string][] = [['today', 'Today'], ['plan', 'Plan'], ...(state.profile.injuries.length ? [['rehab', 'Rehab'] as [Tab, string]] : []), ['library', 'Exercises'], ['me', 'Me']];
  const showInstall = !installDismissed && (install.can || install.ios) && tab === 'today';
  const dismissInstall = () => {
    setInstallDismissed(true);
    try { localStorage.setItem('build-up:install-dismissed', '1'); } catch { /* ignore */ }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <Logo />
          <span className="spacer" />
          {session.status === 'signed-in'
            ? <span className="sync" data-s={session.sync}>{{ idle: 'Saved', syncing: 'Saving…', synced: 'Synced', offline: 'Offline', error: 'Not synced' }[session.sync]}</span>
            : <span className="sync">On this device</span>}
        </div>
      </header>
      <nav className="bottom" aria-label="Main">
        <div className="in">
          {tabs.map(([k, label]) => (
            <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => { setTab(k); if (k === 'today') setFocus(null); }}>
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

      {tab === 'today' && <Today state={state} focus={focus} onFocus={setFocus} onRebuild={() => setEditing(true)} onRehab={() => setTab('rehab')} />}
      {tab === 'plan' && <PlanView state={state} onOpen={f => { setFocus(f); setTab('today'); }} />}
      {tab === 'rehab' && <Rehab state={state} />}
      {tab === 'library' && <Library tier={tierOf(state)} />}
      {tab === 'me' && <Me state={state} session={session} onEdit={() => setEditing(true)} install={install} />}
    </div>
  );
}
