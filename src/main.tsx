import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { captureArrival } from './state/attribution';
import { captureInvite } from './state/referrals';
import { initSession } from './state/session';
import { applyTheme } from './state/theme';
import './styles.css';

const PREVIEW = import.meta.env.VITE_PREVIEW === '1';

applyTheme();
if (!PREVIEW) {
  captureArrival();
  // Cloudflare Web Analytics: cookieless visit counts, top pages, referring sites, countries and devices.
  // The token is public; it comes from the Cloudflare dashboard and is set as the VITE_CF_ANALYTICS_TOKEN repo variable.
  const cfToken = (import.meta.env.VITE_CF_ANALYTICS_TOKEN as string | undefined)?.trim();
  if (cfToken) {
    const s = document.createElement('script');
    s.type = 'module';
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.dataset.cfBeacon = JSON.stringify({ token: cfToken });
    document.head.appendChild(s);
  }
}
captureInvite();
initSession();
// Installed apps (iPhone especially) often resume from memory without reloading, so the browser never checks for a
// new version. Check whenever the app comes back to the foreground, and hourly while it stays open. With autoUpdate,
// a new version installs and the page reloads itself.
if (!PREVIEW) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {}); };
      document.addEventListener('visibilitychange', check);
      window.addEventListener('focus', check);
      setInterval(check, 60 * 60 * 1000);
    },
  });
}

async function start() {
  let extra = null;
  if (PREVIEW) {
    const [{ PreviewBar }, { sampleState }, store] = await Promise.all([import('./preview/PreviewBar'), import('./preview/seed'), import('./state/store')]);
    if (!store.getState().profile) store.replaceState(sampleState());
    extra = <PreviewBar />;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      {extra}
    </StrictMode>,
  );
}
void start();
