import { EX } from '../data/exercises';
import { today } from '../engine/dates';
import type { AppState, CustomWorkout, SetLog, WorkoutItem, WorkoutSession } from '../engine/types';
import { getState, update } from './store';

/* Actions for the user's own workouts and the sessions they log from them. */

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function saveWorkout(w: CustomWorkout) {
  update(s => {
    const has = s.workouts.some(x => x.id === w.id);
    const next = { ...w, updatedAt: Date.now() };
    return { ...s, workouts: has ? s.workouts.map(x => (x.id === w.id ? next : x)) : [next, ...s.workouts] };
  });
}

export function deleteWorkout(id: string) {
  update(s => ({ ...s, workouts: s.workouts.filter(w => w.id !== id) }));
}

export function activeSession(state: AppState): WorkoutSession | null {
  return Object.values(state.sessions).find(s => !s.completedAt && !s.deleted) ?? null;
}

/** The sets from the last time this exercise was logged in a custom workout, for the "last time" hint. */
export function previousSets(state: AppState, ex: string, beforeId?: string): SetLog[] | null {
  const prev = Object.values(state.sessions)
    .filter(s => s.completedAt && !s.deleted && s.id !== beforeId && s.entries.some(e => e.ex === ex))
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))[0];
  return prev?.entries.find(e => e.ex === ex)?.sets.filter(x => x.done) ?? null;
}

function firstNumber(reps: string): number | null {
  const m = reps.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function entryFor(state: AppState, item: WorkoutItem): WorkoutSession['entries'][number] {
  const prev = previousSets(state, item.ex);
  const weight = prev?.[0]?.weight ?? state.lastWeight[item.ex] ?? null;
  const reps = EX[item.ex]?.timed ? null : firstNumber(item.reps);
  return { ex: item.ex, target: item.reps, sets: Array.from({ length: item.sets }, (_, i) => ({ reps: prev?.[i]?.reps ?? reps, weight: EX[item.ex]?.loaded ? prev?.[i]?.weight ?? weight : null, done: false })) };
}

export function startSession(w: CustomWorkout | null): string {
  const s = getState();
  const open = activeSession(s);
  if (open) return open.id;
  const id = uid();
  const ses: WorkoutSession = {
    id, date: today(), workoutId: w?.id ?? null, name: w?.name ?? 'Workout', startedAt: new Date().toISOString(),
    entries: (w?.items ?? []).filter(i => EX[i.ex]).map(i => entryFor(s, i)), updatedAt: Date.now(),
  };
  update(st => ({ ...st, sessions: { ...st.sessions, [id]: ses } }));
  return id;
}

export function patchSession(id: string, fn: (s: WorkoutSession) => WorkoutSession) {
  update(st => {
    const cur = st.sessions[id];
    if (!cur) return st;
    return { ...st, sessions: { ...st.sessions, [id]: { ...fn(cur), updatedAt: Date.now() } } };
  });
}

export function addExercise(id: string, ex: string) {
  const s = getState();
  patchSession(id, ses => ({ ...ses, entries: [...ses.entries, entryFor(s, { ex, sets: 3, reps: EX[ex].timed ? '30 s' : '10' })] }));
}

export function finishSession(id: string) {
  patchSession(id, s => ({ ...s, completedAt: new Date().toISOString(), entries: s.entries.filter(e => e.sets.length) }));
  const ses = getState().sessions[id];
  if (!ses) return;
  // Carry the heaviest weight forward so plan sessions and the next workout start from it.
  update(st => {
    const lastWeight = { ...st.lastWeight };
    for (const e of ses.entries) {
      const w = Math.max(0, ...e.sets.filter(x => x.done && x.weight).map(x => x.weight!));
      if (w > 0) lastWeight[e.ex] = w;
    }
    return { ...st, lastWeight };
  });
}

export function discardSession(id: string) {
  patchSession(id, s => ({ ...s, deleted: true }));
}

/** Save what was done in a session as a reusable workout. */
export function workoutFromSession(s: WorkoutSession): CustomWorkout {
  return {
    id: uid(), name: s.name, createdAt: today(), updatedAt: Date.now(),
    items: s.entries.map(e => ({ ex: e.ex, sets: Math.max(1, e.sets.length), reps: e.target ?? String(e.sets[0]?.reps ?? 10) })),
  };
}
