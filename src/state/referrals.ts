import { getState, update } from './store';
import { appUrl, supabase } from './supabase';
import type { Referrals } from '../engine/types';

/*
 * Invite a friend. Links look like builduptraining.com/?invite=CODE. The code is held on this device until the
 * visitor signs up, then sent with the sign-up so the server can record who invited them (see
 * supabase/migrations/2026-11-18-referrals.sql). Bonus XP for both is worked out in progress.ts.
 */

const KEY = 'build-up:invite';
const CODE = /^[A-Z2-9]{6}$/;
export const SITE_URL = 'https://www.builduptraining.com/';

/** Read ?invite=CODE from the address, remember it, and tidy the address bar. Call before anything else reads the URL. */
export function captureInvite() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('invite');
  if (raw === null) return;
  const code = raw.trim().toUpperCase();
  if (CODE.test(code)) try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
  params.delete('invite');
  const rest = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
}

/** The invite code this visitor arrived with, if they haven't signed up yet. */
export function pendingInvite(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function clearInvite() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** The link to share. Always the public site, even from a preview or a github.io address. */
export function inviteUrl(code: string): string {
  const base = /builduptraining\.com$/.test(window.location.hostname) ? appUrl() : SITE_URL;
  return `${base}?invite=${code}`;
}

/** Fetch invite status from the server and keep it in the app state (so the bonus XP shows). */
export async function refreshReferrals() {
  if (!supabase) return;
  const { data, error } = await supabase.rpc('my_referrals');
  if (error || !data) return;
  const next: Referrals = {
    code: typeof data.code === 'string' ? data.code : null,
    friends: Array.isArray(data.friends) ? data.friends : [],
    invitedBy: data.invitedBy ?? null,
  };
  if (JSON.stringify(next) === JSON.stringify(getState().referrals ?? null)) return;
  if (!getState().profile) return;
  update(s => ({ ...s, referrals: next }));
}
