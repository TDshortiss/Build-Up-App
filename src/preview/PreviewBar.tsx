import { useState } from 'react';
import { replaceState, emptyState } from '../state/store';
import { sampleState } from './seed';
import { previewInstallPrompt } from '../components/InstallPrompt';

/* Only in the review build: switch between a sample athlete and a brand-new user. */
export function PreviewBar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="preview-bar">
      {open && (
        <div className="preview-menu">
          <b>Preview build</b>
          <span>Nothing here is saved to a real account.</span>
          <button className="btn small" onClick={() => { replaceState(sampleState()); setOpen(false); window.scrollTo(0, 0); }}>Sample athlete (5 weeks in)</button>
          <button className="btn ghost small" onClick={() => { replaceState(emptyState()); setOpen(false); window.scrollTo(0, 0); }}>Start as a new user</button>
          <span>Home Screen prompt, as seen on:</span>
          <button className="btn ghost small" onClick={() => { previewInstallPrompt({ platform: 'ios-safari', can: false }); setOpen(false); }}>iPhone (Safari)</button>
          <button className="btn ghost small" onClick={() => { previewInstallPrompt({ platform: 'android', can: true }); setOpen(false); }}>Android (Chrome)</button>
          <button className="btn ghost small" onClick={() => { previewInstallPrompt({ platform: 'in-app', can: false }); setOpen(false); }}>Instagram's browser</button>
        </div>
      )}
      <button className="preview-pill" onClick={() => setOpen(o => !o)}>Preview</button>
    </div>
  );
}
