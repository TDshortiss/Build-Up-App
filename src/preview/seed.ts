import { EX } from '../data/exercises';
import { STARTERS } from '../data/starterWorkouts';
import { addDays, mondayOf, today } from '../engine/dates';
import { dateOf, generatePlan } from '../engine/generate';
import type { AppState, DayLog, Profile, WorkoutSession } from '../engine/types';
import { emptyState, STATE_VERSION } from '../state/store';

/*
 * Sample data for the review build only (VITE_PREVIEW=1): an athlete five weeks into a plan, with a streak,
 * a few missed days and their own workouts logged, so every new screen has something to show.
 */

function rand(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

export function sampleState(): AppState {
  const t = today();
  const start = addDays(mondayOf(t), -35);
  const profile: Profile = {
    name: 'Alex', goal: 'general', sport: null, generalFocus: 'strength', injuries: [], experience: 'intermediate', ageGroup: 'adult',
    equipment: 'gym', trainingDays: [0, 1, 3, 4], gameDays: [], sessionMinutes: 60, startDate: start, targetDate: null, weeks: 12, units: 'lb',
  };
  const plan = generatePlan(profile);
  const r = rand(7);
  const logs: Record<string, DayLog> = {};
  const base: Record<string, number> = {};
  const lastWeight: Record<string, number> = {};
  plan.weeks.forEach((w, wi) => w.days.forEach((d, di) => {
    const date = dateOf(plan, wi + 1, di);
    if (date >= t || d.kind === 'rest' || d.kind === 'game') return;
    // Miss a couple of sessions in week 2 and one in week 4, but keep the recent streak going.
    if ((wi === 1 && (di === 1 || di === 3)) || (wi === 3 && di === 4)) return;
    const done: Record<string, boolean> = {};
    const weights: Record<string, number> = {};
    d.blocks.forEach((b, bi) => b.items.forEach((it, ii) => {
      done[`${bi}-${ii}`] = r() > 0.08;
      const ex = EX[it.ex];
      if (ex?.loaded) {
        base[ex.id] ??= ['biceps', 'triceps', 'delt', 'cuff', 'calf', 'grip'].includes(ex.pattern) ? [25, 30, 35, 40][Math.floor(r() * 4)] : [95, 115, 135, 155, 185][Math.floor(r() * 5)];
        const small = base[ex.id] < 60;
        const w = base[ex.id] + wi * (small ? 2.5 : 5) + (r() > 0.7 ? (small ? 2.5 : 5) : 0);
        weights[ex.id] = w;
        lastWeight[ex.id] = w;
      }
    }));
    logs[date] = { done, weights, pain: {}, rpe: 6 + Math.floor(r() * 3), completedAt: `${date}T18:${String(10 + Math.floor(r() * 40)).padStart(2, '0')}:00.000Z`, updatedAt: Date.now() };
  }));
  // Two extra workouts of their own on rest days.
  const sessions: Record<string, WorkoutSession> = {};
  const arms = STARTERS.gym.find(s => s.key === 'upper')!;
  [addDays(t, -9), addDays(t, -2)].forEach((date, n) => {
    const id = `sample-${n}`;
    sessions[id] = {
      id, date, workoutId: 'sample-upper', name: 'Upper Body', startedAt: `${date}T17:00:00.000Z`, completedAt: `${date}T17:52:00.000Z`, updatedAt: Date.now(),
      entries: arms.items.map(it => ({ ex: it.ex, target: it.reps, sets: Array.from({ length: it.sets }, () => ({ reps: 8 + Math.floor(r() * 4), weight: EX[it.ex].loaded ? (['biceps', 'triceps', 'delt'].includes(EX[it.ex].pattern) ? 30 : 95) + n * 5 : null, done: true })) })),
      note: n ? 'Felt strong. Go up on incline next time.' : undefined, rpe: 7,
    };
  });
  return {
    ...emptyState(), ver: STATE_VERSION, updatedAt: Date.now(), profile, plan, logs, lastWeight, sessions, acceptedTermsAt: new Date().toISOString(),
    referrals: {
      code: 'K7RB4M',
      friends: [
        { name: 'Jordan', joinedAt: `${addDays(t, -12)}T15:00:00.000Z`, activeAt: `${addDays(t, -11)}T19:00:00.000Z` },
        { name: 'Maya', joinedAt: `${addDays(t, -1)}T15:00:00.000Z`, activeAt: null },
      ],
      invitedBy: null,
    },
    workouts: [{ id: 'sample-upper', name: 'Upper Body', items: arms.items, createdAt: start, updatedAt: Date.now() }],
  };
}
