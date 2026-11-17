import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { initSession } from './state/session';
import { applyTheme } from './state/theme';
import './styles.css';

const PREVIEW = import.meta.env.VITE_PREVIEW === '1';

applyTheme();
initSession();
if (!PREVIEW) registerSW({ immediate: true });

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
