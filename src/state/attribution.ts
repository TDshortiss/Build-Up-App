import { supabase } from './supabase';

/*
 * Where people come from. No cookies and no visitor ids: when someone arrives from a tagged link
 * (?utm_source=…) or another website, we note that arrival once, and remember it on this device so
 * that if they sign up within 30 days their account records which link brought them.
 * Plain visits (typing the address, opening the installed app) are not logged here.
 */

export interface Touch {
  source: string;
  medium?: string;
  campaign?: string;
  content?: string;
  /** Host of the website that linked here, e.g. "l.instagram.com". */
  referrer?: string;
  landing?: string;
  /** When they arrived (ms). */
  at: number;
}

const KEY = 'buildup:src';
const SEEN = 'buildup:src-logged';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'];

/* Short links for bios: builduptraining.com/ig, /tt. Static redirect pages in public/ handle first visits;
 * this covers the installed app's offline copy answering those paths itself. */
export const SHORT_LINKS: Record<string, Partial<Touch>> = {
  ig: { source: 'instagram', medium: 'social', campaign: 'bio' },
  tt: { source: 'tiktok', medium: 'social', campaign: 'bio' },
};

/* Friendly names for common referring sites, so "l.instagram.com" and "www.instagram.com" count together. */
const SITES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'x'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)linktr\.ee$/, 'linktree'],
];

export function siteName(host: string): string {
  const h = host.toLowerCase().replace(/^www\./, '');
  for (const [re, name] of SITES) if (re.test(h)) return name;
  return h;
}

const clean = (v: string | null | undefined, max = 100) => {
  const s = (v ?? '').trim().toLowerCase().slice(0, max);
  return s || undefined;
};

/** Works out where this page load came from. Returns null for a plain (direct) visit. */
export function readArrival(href: string, referrer: string, base: string, now = Date.now()): Touch | null {
  const url = new URL(href);
  const path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname.replace(/^\//, '');
  const short = SHORT_LINKS[path.replace(/\/(index\.html)?$/, '')];
  const q = url.searchParams;
  // Links from our own sign-in and reset emails aren't a new way of finding us.
  if (q.has('token_hash') || q.has('code')) return null;
  let ref: string | undefined;
  try {
    const r = referrer ? new URL(referrer) : null;
    if (r && r.host !== url.host && /^https?:$/.test(r.protocol) && !/(^|\.)(mail|outlook)\./.test(r.host)) ref = clean(r.host);
  } catch { /* unreadable referrer */ }

  const invite = q.has('invite') ? 'invite' : undefined;
  const source = clean(q.get('utm_source')) ?? clean(q.get('ref')) ?? short?.source ?? invite ?? (ref ? siteName(ref) : undefined);
  if (!source) return null;
  return {
    source,
    medium: clean(q.get('utm_medium')) ?? short?.medium ?? (invite ? 'friend' : ref ? 'referral' : undefined),
    campaign: clean(q.get('utm_campaign')) ?? short?.campaign,
    content: clean(q.get('utm_content')),
    referrer: ref,
    landing: short ? '/' : clean(url.pathname, 200),
    at: now,
  };
}

/** The address bar without tracking tags (and short-link paths), so shared or bookmarked links stay clean. */
export function cleanUrl(href: string, base: string): string {
  const url = new URL(href);
  PARAMS.forEach(p => url.searchParams.delete(p));
  const path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : '';
  if (SHORT_LINKS[path.replace(/\/(index\.html)?$/, '')]) url.pathname = base;
  return url.pathname + (url.search === '?' ? '' : url.search) + url.hash;
}

function read(store: Storage | undefined, key: string): string | null {
  try { return store?.getItem(key) ?? null; } catch { return null; }
}
function write(store: Storage | undefined, key: string, value: string) {
  try { store?.setItem(key, value); } catch { /* storage blocked */ }
}

/** Call once on page load. */
export function captureArrival() {
  if (typeof window === 'undefined') return;
  const base = import.meta.env.BASE_URL;
  const touch = readArrival(window.location.href, document.referrer, base);
  const tidy = cleanUrl(window.location.href, base);
  if (tidy !== window.location.pathname + window.location.search + window.location.hash) {
    try { window.history.replaceState(window.history.state, '', tidy); } catch { /* ignore */ }
  }
  if (!touch) return;
  // The most recent link someone came through gets the credit.
  write(window.localStorage, KEY, JSON.stringify(touch));

  // Log the visit once per browser tab session per link, so reloads don't double count.
  const id = [touch.source, touch.medium, touch.campaign, touch.content].join('|');
  if (!supabase || read(window.sessionStorage, SEEN) === id) return;
  write(window.sessionStorage, SEEN, id);
  const { at: _at, ...row } = touch;
  void supabase.from('visits').insert(row).then(({ error }) => { if (error) console.warn('Visit not logged:', error.message); });
}

/** Where this person came from, if they arrived through a link in the last 30 days. Saved with a new account. */
export function signupSource(now = Date.now()): Omit<Touch, 'at'> | null {
  if (typeof window === 'undefined') return null;
  try {
    const t = JSON.parse(read(window.localStorage, KEY) || 'null') as Touch | null;
    if (!t?.source || now - t.at > MAX_AGE) return null;
    const { at: _at, ...rest } = t;
    return rest;
  } catch { return null; }
}
