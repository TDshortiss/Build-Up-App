import { describe, expect, it } from 'vitest';
import { emptyState } from '../state/store';
import { addDays } from './dates';
import { computeProgress, levelInfo, levelName, REFERRAL, xpForLevel } from './progress';
import type { AppState, Profile, WorkoutSession } from './types';

const T = '2026-11-17';
const profile: Profile = {
  name: 'Test', goal: 'free', sport: null, generalFocus: 'muscle', injuries: [], experience: 'intermediate', ageGroup: 'adult', equipment: 'gym',
  trainingDays: [], gameDays: [], sessionMinutes: 60, startDate: '2026-10-01', targetDate: null, weeks: 12, units: 'lb',
};

function session(date: string, weight = 100, done = true): WorkoutSession {
  return {
    id: `s-${date}-${weight}`, date, workoutId: null, name: 'W', startedAt: `${date}T10:00:00Z`, completedAt: `${date}T11:00:00Z`, updatedAt: 1,
    entries: [{ ex: 'bench-press', sets: [{ reps: 5, weight, done }] }],
  };
}

function withSessions(dates: string[]): AppState {
  const sessions: Record<string, WorkoutSession> = {};
  for (const d of dates) { const s = session(d); sessions[s.id] = s; }
  return { ...emptyState(), profile, sessions };
}

describe('streaks', () => {
  it('counts workout days and survives two missed days', () => {
    const p = computeProgress(withSessions([addDays(T, -6), addDays(T, -5), addDays(T, -2)]), T);
    expect(p.streak.count).toBe(3);
    expect(p.streak.missed).toBe(1);
    expect(p.streak.status).toBe('safe');
  });

  it('warns on the last day before it resets', () => {
    const p = computeProgress(withSessions([addDays(T, -3)]), T);
    expect(p.streak.count).toBe(1);
    expect(p.streak.status).toBe('last-chance');
  });

  it('resets on the third missed day in a row', () => {
    // Two workouts, then three missed days in a row (-6, -5, -4), then a fresh start.
    const p = computeProgress(withSessions([addDays(T, -8), addDays(T, -7), addDays(T, -3)]), T);
    expect(p.streak.best).toBe(2);
    expect(p.streak.count).toBe(1);
    // And a streak dies on its own after three missed days.
    expect(computeProgress(withSessions([addDays(T, -4)]), T).streak.count).toBe(0);
  });

  it('is done for today after a workout today', () => {
    const p = computeProgress(withSessions([addDays(T, -1), T]), T);
    expect(p.streak.count).toBe(2);
    expect(p.streak.status).toBe('done-today');
  });

  it('ignores unfinished and empty sessions', () => {
    const s = withSessions([]);
    s.sessions.a = { ...session(T), id: 'a', completedAt: undefined };
    s.sessions.b = { ...session(T, 100, false), id: 'b' };
    expect(computeProgress(s, T).records).toHaveLength(0);
  });
});

describe('XP', () => {
  it('awards a PR only when beating an earlier best', () => {
    const s = withSessions([]);
    for (const [d, w] of [[addDays(T, -2), 100], [addDays(T, -1), 110]] as const) { const x = session(d, w); s.sessions[x.id] = x; }
    const p = computeProgress(s, T);
    const prs = [...p.byWorkout.values()].map(v => v.prs.length);
    expect(prs).toEqual([0, 1]);
  });

  it('caps XP at two workouts a day', () => {
    const s = withSessions([]);
    for (let i = 0; i < 4; i++) { const x = { ...session(T), id: `x${i}`, completedAt: `${T}T1${i}:00:00Z` }; s.sessions[x.id] = x; }
    const p = computeProgress(s, T);
    expect([...p.byWorkout.values()].filter(v => v.xp > 0)).toHaveLength(2);
  });

  it('levels up after the very first workout', () => {
    const p = computeProgress(withSessions([T]), T);
    expect(levelInfo(p.xp).level).toBeGreaterThanOrEqual(1);
  });
});

describe('ranks', () => {
  it('names levels by rank and division, then Legend', () => {
    expect(levelName(0)).toBe('Wood I');
    expect(levelName(5)).toBe('Stone III');
    expect(levelName(6)).toBe('Bronze I');
    expect(levelName(24)).toBe('Legend 1');
    expect(levelName(26)).toBe('Legend 3');
  });

  it('gets harder as you climb', () => {
    const per = [1, 3, 6, 12, 18, 24].map(l => xpForLevel(l + 1) - xpForLevel(l));
    for (let i = 1; i < per.length; i++) expect(per[i]).toBeGreaterThan(per[i - 1]);
    expect(levelInfo(xpForLevel(9)).name).toBe('Silver I');
  });
});

describe('invites', () => {
  const friend = (n: number, active: boolean) => ({ name: `F${n}`, joinedAt: '2026-11-01T10:00:00Z', activeAt: active ? `2026-11-${String(n + 1).padStart(2, '0')}T10:00:00Z` : null });

  it('rewards the inviter only for friends who finished a workout, up to the cap', () => {
    const friends = [friend(1, false), ...Array.from({ length: REFERRAL.maxFriends + 2 }, (_, i) => friend(i + 2, true))];
    const p = computeProgress({ ...emptyState(), profile, referrals: { code: 'ABC234', friends, invitedBy: null } }, T);
    expect(p.xp).toBe(REFERRAL.inviter * REFERRAL.maxFriends);
    expect(p.events.some(e => e.label === 'F1 joined')).toBe(false);
  });

  it('rewards the invited friend after their first workout', () => {
    const base = { ...emptyState(), profile };
    expect(computeProgress({ ...base, referrals: { code: 'X', friends: [], invitedBy: { ...friend(1, false), name: 'Sam' } } }, T).xp).toBe(0);
    const p = computeProgress({ ...base, referrals: { code: 'X', friends: [], invitedBy: { ...friend(1, true), name: 'Sam' } } }, T);
    expect(p.xp).toBe(REFERRAL.friend);
    expect(p.events[0].detail).toBe('Invited by Sam');
  });
});
