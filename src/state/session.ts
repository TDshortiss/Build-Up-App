import { useSyncExternalStore } from 'react';
import type { Session as SbSession } from '@supabase/supabase-js';
import { appUrl, cloudEnabled, supabase } from './supabase';
import { emptyState, getState, loadFor, mergeStates, migrate, onLocalChange, replaceState, unload } from './store';
import type { AppState } from '../engine/types';

/*
 * Account session and cloud sync. When Supabase isn't configured the app runs in "local" mode:
 * no login, data saved on this device only.
 */

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface Session {
  status: 'loading' | 'signed-out' | 'signed-in' | 'local';
  user: { id: string; email: string } | null;
  /** The user arrived from a password-reset email and needs to choose a new password. */
  recovery: boolean;
  sync: SyncStatus;
  tier: 'free' | 'pro';
}

let snap: Session = { status: cloudEnabled ? 'loading' : 'local', user: null, recovery: false, sync: 'idle', tier: 'free' };
const listeners = new Set<() => void>();
function set(p: Partial<Session>) {
  snap = { ...snap, ...p };
  listeners.forEach(l => l());
}

export function useSession(): Session {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => snap);
}

let started = false;
let userId: string | null = null;

export function initSession() {
  if (started) return;
  started = true;
  if (!supabase) {
    loadFor('local');
    set({ status: 'local' });
    return;
  }
  supabase.auth.getSession().then(({ data }) => handleSession(data.session));
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') set({ recovery: true });
    // Defer so Supabase finishes its own bookkeeping before we query.
    setTimeout(() => handleSession(session), 0);
  });
  onLocalChange(() => schedulePush());
  window.addEventListener('online', () => { if (userId) void push(); });
}

async function handleSession(session: SbSession | null) {
  const user = session?.user ?? null;
  if (!user) {
    userId = null;
    unload();
    set({ status: 'signed-out', user: null, sync: 'idle', tier: 'free' });
    return;
  }
  if (user.id === userId) return;
  userId = user.id;
  loadFor(user.id);
  set({ status: 'signed-in', user: { id: user.id, email: user.email ?? '' } });
  await pull();
  void loadTier();
}

async function pull() {
  if (!supabase || !userId) return;
  set({ sync: 'syncing' });
  const { data, error } = await supabase.from('user_state').select('state').eq('user_id', userId).maybeSingle();
  if (error) {
    set({ sync: navigator.onLine ? 'error' : 'offline' });
    return;
  }
  const local = getState();
  if (data?.state) {
    const remote = migrate(data.state as Partial<AppState>);
    const merged = mergeStates(local, remote);
    replaceState(merged);
    const needsPush = local.updatedAt > remote.updatedAt || Object.keys(merged.logs).length !== Object.keys(remote.logs).length;
    if (needsPush) await push();
    else set({ sync: 'synced' });
  } else if (local.profile) {
    await push();
  } else {
    set({ sync: 'synced' });
  }
}

let timer: number | undefined;
function schedulePush() {
  if (!userId) return;
  window.clearTimeout(timer);
  set({ sync: 'syncing' });
  timer = window.setTimeout(() => void push(), 1200);
}

async function push(): Promise<boolean> {
  if (!supabase || !userId) return false;
  window.clearTimeout(timer);
  const { error } = await supabase.from('user_state')
    .upsert({ user_id: userId, state: getState(), updated_at: new Date().toISOString() });
  set({ sync: error ? (navigator.onLine ? 'error' : 'offline') : 'synced' });
  return !error;
}

async function loadTier() {
  if (!supabase || !userId) return;
  const { data } = await supabase.from('accounts').select('tier').eq('user_id', userId).maybeSingle();
  if (data?.tier === 'pro') set({ tier: 'pro' });
}

/* ---------- Auth actions. Each returns an error message, or null on success. ---------- */

function friendly(msg: string): string {
  if (/invalid login/i.test(msg)) return 'That email and password don\'t match. Try again or reset your password.';
  if (/already registered/i.test(msg)) return 'An account with this email already exists. Sign in instead.';
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first. Check your inbox for the link we sent.';
  if (/password/i.test(msg) && /characters/i.test(msg)) return 'Use a password with at least 8 characters.';
  return msg;
}

export async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirm: boolean }> {
  if (!supabase) return { error: 'Accounts are not set up yet.', needsConfirm: false };
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } });
  if (error) return { error: friendly(error.message), needsConfirm: false };
  return { error: null, needsConfirm: !data.session };
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not set up yet.';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? friendly(error.message) : null;
}

export async function sendReset(email: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not set up yet.';
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
  return error ? friendly(error.message) : null;
}

export async function setNewPassword(password: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not set up yet.';
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) set({ recovery: false });
  return error ? friendly(error.message) : null;
}

export async function signOut(): Promise<string | null> {
  if (!supabase) return null;
  const saved = await push();
  if (!saved && !confirm('Some recent changes haven\'t synced yet and will be lost if you sign out now. Sign out anyway?')) return 'cancelled';
  const id = userId;
  await supabase.auth.signOut();
  if (id) try { localStorage.removeItem(`build-up:v1:${id}`); } catch { /* ignore */ }
  return null;
}

export async function deleteAccount(): Promise<string | null> {
  if (!supabase) {
    try { localStorage.removeItem('build-up:v1:local'); } catch { /* ignore */ }
    replaceState(emptyState());
    return null;
  }
  const id = userId;
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return error.message;
  await supabase.auth.signOut();
  if (id) try { localStorage.removeItem(`build-up:v1:${id}`); } catch { /* ignore */ }
  return null;
}

export function retrySync() {
  void pull();
}
