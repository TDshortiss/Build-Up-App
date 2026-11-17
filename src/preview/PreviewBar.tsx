import { useState } from 'react';
import { replaceState, emptyState } from '../state/store';
import { sampleState } from './seed';

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
        </div>
      )}
      <button className="preview-pill" onClick={() => setOpen(o => !o)}>Preview</button>
    </div>
  );
}
