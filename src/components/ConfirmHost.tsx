import { useSyncExternalStore } from 'react';

/* In-app confirm dialog, used instead of window.confirm so it looks like the app and works everywhere. */

interface Ask { message: string; yes: string; danger: boolean; resolve: (ok: boolean) => void }
let current: Ask | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function ask(message: string, opts: { yes?: string; danger?: boolean } = {}): Promise<boolean> {
  current?.resolve(false);
  return new Promise(resolve => {
    current = { message, yes: opts.yes ?? 'OK', danger: !!opts.danger, resolve };
    emit();
  });
}

function close(ok: boolean) {
  const c = current;
  current = null;
  emit();
  c?.resolve(ok);
}

export function ConfirmHost() {
  const c = useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => current);
  if (!c) return null;
  return (
    <div className="scrim confirm" onClick={e => { if (e.target === e.currentTarget) close(false); }}>
      <div className="sheet" role="alertdialog" aria-modal="true" aria-label={c.message}>
        <p style={{ fontSize: 17 }}>{c.message}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost small" onClick={() => close(false)} autoFocus>Cancel</button>
          <button className={`btn small${c.danger ? ' danger' : ''}`} onClick={() => close(true)}>{c.yes}</button>
        </div>
      </div>
    </div>
  );
}
