import { useEffect, useState, type ReactNode } from 'react';
import { isNative } from '../state/native';
import { Sheet } from './ui';

/*
 * "Add Build Up to your Home Screen", shown once per device after someone has an account.
 *
 * When Build Up is in the app stores, put the links here. A platform with a link gets a store button in place of the
 * Home Screen steps, and everything else (when it shows, dismissing, hiding inside the installed app) stays the same.
 */
export const STORE_LINKS: { ios: string | null; android: string | null } = {
  ios: null,
  android: null,
};

/** Set once the prompt has been shown and closed on this device, so it never nags. */
const SEEN_KEY = 'build-up:install-prompted';
/** The smaller reminder banner on Home uses this key; closing the big prompt hides it too. */
export const BANNER_KEY = 'build-up:install-dismissed';

export type Platform = 'ios-safari' | 'ios-other' | 'in-app' | 'android' | 'desktop';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }> }

function detect(): Platform {
  const ua = navigator.userAgent;
  // Instagram, Facebook, TikTok and similar open links in their own browser, which can't add to the Home Screen.
  if (/Instagram|FBAN|FBAV|FB_IAB|musical_ly|TikTok|Snapchat|Line\/|LinkedInApp|Twitter/i.test(ua)) return 'in-app';
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isStandalone(): boolean {
  // The App Store app is already installed.
  return isNative()
    || window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// The review build can show the prompt as an iPhone or Android user would see it.
type Forced = { platform: Platform; can: boolean } | null;
let forced: Forced = null;
const forcedListeners = new Set<() => void>();
export function previewInstallPrompt(f: Forced) {
  forced = f;
  try { localStorage.removeItem(SEEN_KEY); } catch { /* ignore */ }
  forcedListeners.forEach(l => l());
}

export interface Install {
  platform: Platform;
  /** True inside the installed app. */
  standalone: boolean;
  /** Chrome/Edge/Samsung offered a one-tap install. */
  can: boolean;
  /** Something useful to show: a store link, an install button or the steps for this browser. */
  available: boolean;
  /** Ask the browser to install. Resolves true if the person accepted. */
  prompt: () => Promise<boolean>;
  forcedTick: number;
}

export function useInstall(): Install {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const done = () => { setInstalled(true); setEvt(null); };
    const f = () => setTick(t => t + 1);
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', done);
    forcedListeners.add(f);
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', done); forcedListeners.delete(f); };
  }, []);
  const platform = forced?.platform ?? detect();
  const standalone = !forced && (installed || isStandalone());
  const can = forced ? forced.can : !!evt && !standalone;
  const store = platform.startsWith('ios') ? STORE_LINKS.ios : platform === 'android' ? STORE_LINKS.android : null;
  const available = !standalone && (!!store || can || platform !== 'desktop');
  return {
    platform, standalone, can, available, forcedTick: tick,
    prompt: async () => {
      if (!evt) return false;
      await evt.prompt();
      const choice = await evt.userChoice?.catch(() => undefined);
      setEvt(null);
      return choice?.outcome === 'accepted';
    },
  };
}

export function hasSeenInstallPrompt(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); localStorage.setItem(BANNER_KEY, '1'); } catch { /* private mode */ }
}

/* ---------- Icons that match what people see in their browser ---------- */
const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4M7 10H5.5A1.5 1.5 0 004 11.5v8A1.5 1.5 0 005.5 21h13a1.5 1.5 0 001.5-1.5v-8a1.5 1.5 0 00-1.5-1.5H17" />
  </svg>
);
const AddSquareIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
);
const DotsIcon = ({ vertical }: { vertical?: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    {(vertical ? [[12, 5], [12, 12], [12, 19]] : [[5, 12], [12, 12], [19, 12]]).map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.9" />)}
  </svg>
);
const CheckBadge = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

function Steps({ items }: { items: { icon: ReactNode; text: ReactNode }[] }) {
  return (
    <ol className="install-steps">
      {items.map((s, i) => (
        <li key={i}><span className="n mono">{i + 1}</span><span className="t">{s.text}</span><span className="ic">{s.icon}</span></li>
      ))}
    </ol>
  );
}

/** A small picture of the Build Up icon sitting on a Home Screen. */
function HomeScreenArt() {
  return (
    <div className="install-art" aria-hidden="true">
      <div className="ia-grid">
        {Array.from({ length: 7 }, (_, i) => <i key={i} />)}
        <b className="ia-app"><img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" /></b>
      </div>
    </div>
  );
}

export function InstallSheet({ install, onClose }: { install: Install; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const close = () => { markSeen(); onClose(); };
  const { platform } = install;
  const store = platform.startsWith('ios') ? STORE_LINKS.ios : platform === 'android' ? STORE_LINKS.android : null;

  let body: ReactNode;
  if (store) {
    body = (
      <a className="btn block" href={store} target="_blank" rel="noreferrer" onClick={close}>
        {platform === 'android' ? 'Get it on Google Play' : 'Download on the App Store'}
      </a>
    );
  } else if (install.can) {
    body = (
      <button className="btn block" disabled={busy} onClick={async () => {
        setBusy(true);
        const ok = await install.prompt();
        setBusy(false);
        if (ok) close();
      }}>Add to Home Screen</button>
    );
  } else if (platform === 'ios-safari') {
    body = <Steps items={[
      { icon: <ShareIcon />, text: <>Tap <b>Share</b> in Safari's toolbar. <span className="fine">On newer iPhones it's under <b>•••</b> first.</span></> },
      { icon: <AddSquareIcon />, text: <>Scroll down and tap <b>Add to Home Screen</b>.</> },
      { icon: <CheckBadge />, text: <>Tap <b>Add</b>. Build Up is now on your Home Screen.</> },
    ]} />;
  } else if (platform === 'ios-other') {
    body = <Steps items={[
      { icon: <ShareIcon />, text: <>Tap <b>Share</b> next to the address bar. <span className="fine">Or open builduptraining.com in Safari.</span></> },
      { icon: <AddSquareIcon />, text: <>Tap <b>Add to Home Screen</b>.</> },
      { icon: <CheckBadge />, text: <>Tap <b>Add</b>.</> },
    ]} />;
  } else if (platform === 'in-app') {
    body = <Steps items={[
      { icon: <DotsIcon />, text: <>This browser can't add apps. Tap <b>•••</b> (top corner) and choose <b>Open in browser</b> (or <b>Open in Safari</b>).</> },
      { icon: <ShareIcon />, text: <>Sign in there, tap <b>Share</b>, then <b>Add to Home Screen</b>.</> },
    ]} />;
  } else {
    // Android browsers that don't offer a one-tap install, and desktop.
    body = <Steps items={[
      { icon: <DotsIcon vertical />, text: <>Open your browser's menu <b>⋮</b>.</> },
      { icon: <AddSquareIcon />, text: <>Tap <b>Add to Home screen</b> or <b>Install app</b>.</> },
      { icon: <CheckBadge />, text: <>Tap <b>Add</b> or <b>Install</b>.</> },
    ]} />;
  }

  return (
    <Sheet title={store ? 'Get the app' : 'Add to Home Screen'} onClose={close}>
      <div className="install-hero">
        <HomeScreenArt />
        <div className="stack" style={{ gap: 6 }}>
          <p className="install-lead">Train from your Home Screen.</p>
          <ul className="install-why">
            <li>Opens full screen, one tap away</li>
            <li>Works offline at the gym</li>
            <li>Your streak is right there every day</li>
          </ul>
        </div>
      </div>
      {body}
      <button className="linkbtn install-later" onClick={close}>{install.can || store ? 'Not now' : 'Done'}</button>
      <p className="fine" style={{ textAlign: 'center', marginTop: -6 }}>You can find this again in Profile.</p>
    </Sheet>
  );
}
