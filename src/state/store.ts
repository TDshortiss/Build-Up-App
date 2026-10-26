import { useSyncExternalStore } from 'react';
import type { AppState, DayLog } from '../engine/types';

/*
 * App state lives in memory, is mirrored to localStorage on every change (so the app works offline),
 * and is pushed to the user's account by sync.ts when they are signed in.
 */

export const STATE_VERSION = 1;

export function emptyState(): AppState {
  return {
    ver: STATE_VERSION, updatedAt: 0, profile: null, plan: null, logs: {}, rehab: {}, swaps: {}, lastWeight: {},
    acceptedTermsAt: null,
  };
}

type Listener = () => void;
let state: AppState = emptyState();
let storageKey: string | null = null;
const listeners = new Set<Listener>();
const changeHooks = new Set<(s: AppState) => void>();

function readStorage(key: string): AppState | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeStorage() {
  if (!storageKey) return;
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* storage full or blocked: memory still works */ }
}

export function migrate(raw: Partial<AppState>): AppState {
  return { ...emptyState(), ...raw, ver: STATE_VERSION };
}

/** Switch to the state saved for this account (or for device-only mode) on this device. */
export function loadFor(owner: string) {
  storageKey = `build-up:v1:${owner}`;
  state = readStorage(storageKey) ?? emptyState();
  listeners.forEach(l => l());
}

/** Forget the signed-in user's state in memory without touching what's saved on the device. */
export function unload() {
  storageKey = null;
  state = emptyState();
  listeners.forEach(l => l());
}

export function getState(): AppState {
  return state;
}

/** Replace state without marking it as a local edit (used when applying data pulled from the server). */
export function replaceState(next: AppState) {
  state = next;
  writeStorage();
  listeners.forEach(l => l());
}

export function update(fn: (s: AppState) => AppState) {
  state = { ...fn(state), updatedAt: Date.now() };
  writeStorage();
  listeners.forEach(l => l());
  changeHooks.forEach(h => h(state));
}

export function onLocalChange(fn: (s: AppState) => void): () => void {
  changeHooks.add(fn);
  return () => changeHooks.delete(fn);
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState);
}

export function updateLog(date: string, fn: (l: DayLog) => DayLog) {
  update(s => {
    const prev: DayLog = s.logs[date] ?? { done: {}, weights: {}, pain: {}, updatedAt: 0 };
    return { ...s, logs: { ...s.logs, [date]: { ...fn(prev), updatedAt: Date.now() } } };
  });
}

/**
 * Merge two copies of the state. Workout logs merge day by day so sessions logged on two devices
 * are both kept; everything else comes from whichever copy was edited most recently.
 */
export function mergeStates(a: AppState, b: AppState): AppState {
  const [newer, older] = a.updatedAt >= b.updatedAt ? [a, b] : [b, a];
  const logs = { ...older.logs };
  for (const [date, log] of Object.entries(newer.logs)) {
    if (!logs[date] || log.updatedAt >= logs[date].updatedAt) logs[date] = log;
  }
  return { ...newer, logs, lastWeight: { ...older.lastWeight, ...newer.lastWeight } };
}
