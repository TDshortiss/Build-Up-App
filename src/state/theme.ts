import { useSyncExternalStore } from 'react';
import { syncStatusBar } from './native';

/* Light / dark / follow the phone. Saved per device, applied before the app renders. */

export type Theme = 'system' | 'light' | 'dark';
const KEY = 'build-up:theme';
const listeners = new Set<() => void>();
let current: Theme = read();

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch { return 'system'; }
}

export function applyTheme(t: Theme = current) {
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme; else root.dataset.theme = t;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    const darkMeta = m.getAttribute('media')?.includes('dark');
    const dark = t === 'system' ? darkMeta : t === 'dark';
    m.setAttribute('content', dark ? '#0E151B' : '#F2F4F5');
  });
  void syncStatusBar(t === 'system' ? !!window.matchMedia?.('(prefers-color-scheme: dark)').matches : t === 'dark');
}

export function setTheme(t: Theme) {
  current = t;
  try { if (t === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyTheme(t);
  listeners.forEach(l => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => current);
}

if (typeof window !== 'undefined') {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
}
