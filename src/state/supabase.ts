import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isNative, WEBSITE } from './native';

// Tolerate pasted settings with stray whitespace, a trailing slash or the REST path on the end.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/(rest\/v1\/?)?$/, '');
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** Null when the app is built without Supabase settings; the app then runs in device-only mode. */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export const cloudEnabled = supabase !== null;

/** Where auth emails (confirm, reset password) send people back to. */
export function appUrl(): string {
  // Inside the iPhone app the page lives at capacitor://localhost, which an email link can't open. Send people to the website.
  if (isNative()) return WEBSITE;
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
