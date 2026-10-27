import { useState, type FormEvent } from 'react';
import { Chevron, Effort } from '../components/ui';
import { sendReset, setNewPassword, signIn, signUp } from '../state/session';

export function Welcome({ onStart }: { onStart: (mode: 'signup' | 'signin') => void }) {
  return (
    <div className="hero">
      <div>
        <h1>Build <span>Up</span></h1>
        <p className="lede">A training plan built around you: your sport, your season, your schedule and whatever is hurting right now.</p>
        <ul>
          <li><Effort level={1} /><div><b>Tell us your goal</b><span className="t">Rehab, off-season, in-season or general training.</span></div></li>
          <li><Effort level={2} /><div><b>Get a plan made for you</b><span className="t">17 sports, gym, home or no equipment, 1 to 6 days a week.</span></div></li>
          <li><Effort level={3} /><div><b>Train around injuries</b><span className="t">Rehab with a pain guide and progress checks that decide when you move on.</span></div></li>
        </ul>
      </div>
      <div className="stack">
        <button className="btn block" onClick={() => onStart('signup')}>Get started</button>
        <button className="btn ghost block" onClick={() => onStart('signin')}>I already have an account</button>
        <p className="fine" style={{ textAlign: 'center' }}>
          <a href="#terms">Terms</a> · <a href="#privacy">Privacy</a> · Not medical advice
        </p>
      </div>
    </div>
  );
}

type Mode = 'signup' | 'signin' | 'reset' | 'newpass';

export function AuthScreen({ initial, onBack }: { initial: Mode; onBack?: () => void }) {
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<'confirm' | 'reset' | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode !== 'reset' && password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const r = await signUp(email.trim(), password);
        if (r.error) setError(r.error); else if (r.needsConfirm) setSent('confirm');
      } else if (mode === 'signin') {
        const err = await signIn(email.trim(), password);
        if (err) setError(err);
      } else if (mode === 'reset') {
        const err = await sendReset(email.trim());
        if (err) setError(err); else setSent('reset');
      } else {
        const err = await setNewPassword(password);
        if (err) setError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="auth">
        <h2>Check your email</h2>
        <p>{sent === 'confirm'
          ? <>We sent a confirmation link to <b>{email}</b>. Open it on this device to finish creating your account.</>
          : <>If an account exists for <b>{email}</b>, a link to reset your password is on its way.</>}</p>
        <p className="fine">Nothing there after a minute? Check spam, or try again.</p>
        <button className="btn ghost" onClick={() => { setSent(null); setMode('signin'); }}>Back to sign in</button>
      </div>
    );
  }

  const titles: Record<Mode, string> = { signup: 'Create your account', signin: 'Welcome back', reset: 'Reset password', newpass: 'Choose a new password' };
  return (
    <form className="auth" onSubmit={submit}>
      {onBack && mode !== 'newpass' && <button type="button" className="back" onClick={onBack}><Chevron dir="left" /> Back</button>}
      <h2>{titles[mode]}</h2>
      {mode === 'signup' && <p className="muted">Your plan and progress save to your account, so they follow you to any device.</p>}
      {mode !== 'newpass' && (
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      )}
      {mode !== 'reset' && (
        <div className="field">
          <label htmlFor="pw">{mode === 'newpass' ? 'New password' : 'Password'}</label>
          <input id="pw" className="input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
          {mode !== 'signin' && <small>At least 8 characters.</small>}
        </div>
      )}
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn block" disabled={busy}>{busy ? 'One moment…' : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : mode === 'reset' ? 'Send reset link' : 'Save password'}</button>
      {mode === 'signup' && <p className="fine">By creating an account you agree to the <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>. You must be 13 or older.</p>}
      {mode === 'signin' && (
        <div className="row">
          <button type="button" className="linkbtn" onClick={() => { setMode('reset'); setError(null); }}>Forgot password?</button>
          <span className="spacer" />
          <button type="button" className="linkbtn" onClick={() => { setMode('signup'); setError(null); }}>Create an account</button>
        </div>
      )}
      {mode === 'signup' && <button type="button" className="linkbtn" onClick={() => { setMode('signin'); setError(null); }}>Already have an account? Sign in</button>}
      {mode === 'reset' && <button type="button" className="linkbtn" onClick={() => { setMode('signin'); setError(null); }}>Back to sign in</button>}
    </form>
  );
}
