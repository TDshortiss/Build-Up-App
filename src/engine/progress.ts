import { EX } from '../data/exercises';
import { addDays, daysBetween, today as todayIso } from './dates';
import { dateOf } from './generate';
import type { AppState, DayKind, WorkoutSession } from './types';

/*
 * Everything on the home page and in the rank/streak system is worked out from the user's logs each time,
 * so it syncs for free and never double-counts. Nothing here is stored.
 */

/* ---------- Workout days ---------- */

export interface WorkoutRecord {
  date: string;
  kind: 'plan' | 'custom';
  /** Session id for custom workouts. */
  id?: string;
  title: string;
  /** Exercises completed. */
  exercises: number;
  /** Best weight per loaded exercise in this workout. */
  weights: Record<string, number>;
  /** Total sets × reps × weight, custom workouts only. */
  volume: number;
  sets: number;
  rpe?: number;
  note?: string;
  completedAt: string;
}

export function sessionDone(s: WorkoutSession): boolean {
  return !!s.completedAt && !s.deleted && s.entries.some(e => e.sets.some(x => x.done));
}

/** Every completed workout, oldest first. */
export function workoutRecords(state: AppState): WorkoutRecord[] {
  const out: WorkoutRecord[] = [];
  const plan = state.plan;
  for (const [date, log] of Object.entries(state.logs)) {
    if (!log.completedAt) continue;
    let title = 'Workout';
    if (plan) {
      const idx = daysBetween(plan.weekOneMonday, date);
      const day = plan.weeks[Math.floor(idx / 7)]?.days[idx % 7];
      if (idx >= 0 && day) title = day.title;
    }
    const weights: Record<string, number> = {};
    for (const [ex, w] of Object.entries(log.weights)) if (w > 0) weights[ex] = w;
    out.push({
      date, kind: 'plan', title, exercises: Object.values(log.done).filter(Boolean).length, weights, volume: 0, sets: 0,
      rpe: log.rpe, note: log.note, completedAt: log.completedAt,
    });
  }
  for (const s of Object.values(state.sessions)) {
    if (!sessionDone(s)) continue;
    const weights: Record<string, number> = {};
    let volume = 0;
    let sets = 0;
    let exercises = 0;
    for (const e of s.entries) {
      const done = e.sets.filter(x => x.done);
      if (done.length) exercises++;
      for (const x of done) {
        sets++;
        if (x.weight && x.weight > 0) {
          weights[e.ex] = Math.max(weights[e.ex] ?? 0, x.weight);
          volume += x.weight * (x.reps ?? 0);
        }
      }
    }
    out.push({ date: s.date, kind: 'custom', id: s.id, title: s.name, exercises, weights, volume, sets, rpe: s.rpe, note: s.note, completedAt: s.completedAt! });
  }
  return out.sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

/** What the plan has scheduled on a date, or null outside the plan. */
export function plannedKind(state: AppState, date: string): DayKind | null {
  const plan = state.plan;
  if (!plan || date < plan.startDate) return null;
  const idx = daysBetween(plan.weekOneMonday, date);
  if (idx < 0 || idx >= plan.weeks.length * 7) return null;
  return plan.weeks[Math.floor(idx / 7)].days[idx % 7].kind;
}

export function isRestDay(state: AppState, date: string): boolean {
  const k = plannedKind(state, date);
  return k === 'rest' || k === 'game';
}

/* ---------- Streaks ---------- */

/** Days in a row without a workout that a streak survives. The next one ends it. */
export const STREAK_GRACE = 2;

export interface Streak {
  /** Workout days in the current streak. */
  count: number;
  best: number;
  /** Missed days so far since the last workout (planned rest days don't count). */
  missed: number;
  doneToday: boolean;
  /** 'last-chance' means one more missed day ends it. */
  status: 'none' | 'done-today' | 'safe' | 'last-chance';
}

interface Walk { streak: Streak; streakAt: Map<string, number>; milestones: { date: string; n: number }[] }

const MILESTONES = [7, 14, 30, 50, 75, 100, 150, 200, 365];

function walkStreak(state: AppState, days: Set<string>, today: string): Walk {
  const sorted = [...days].filter(d => d <= today).sort();
  const streakAt = new Map<string, number>();
  const milestones: Walk['milestones'] = [];
  let count = 0;
  let best = 0;
  let missed = 0;
  if (sorted.length) {
    for (let d = sorted[0]; d <= today; d = addDays(d, 1)) {
      if (days.has(d)) {
        count++;
        missed = 0;
        best = Math.max(best, count);
        streakAt.set(d, count);
        if (MILESTONES.includes(count)) milestones.push({ date: d, n: count });
      } else if (d !== today && count > 0 && !isRestDay(state, d)) {
        missed++;
        if (missed > STREAK_GRACE) { count = 0; missed = 0; }
      }
    }
  }
  const doneToday = days.has(today);
  const status: Streak['status'] = count === 0 ? 'none' : doneToday ? 'done-today' : missed >= STREAK_GRACE && !isRestDay(state, today) ? 'last-chance' : 'safe';
  return { streak: { count, best, missed, doneToday, status }, streakAt, milestones };
}

/* ---------- XP ---------- */

export const XP = {
  workout: 100,
  perExercise: 5,
  maxExercises: 12,
  pr: 25,
  maxPrs: 3,
  streakPerDay: 3,
  streakCap: 20,
  rehabStage: 250,
  /** Workouts per day that earn XP. */
  perDay: 2,
};
/** Invite a friend: both get XP once the friend finishes their first workout. */
export const REFERRAL = { inviter: 300, friend: 200, maxFriends: 10 };

const MILESTONE_XP: Record<number, number> = { 7: 100, 14: 150, 30: 300, 50: 400, 75: 500, 100: 750, 150: 1000, 200: 1250, 365: 2500 };

export interface XpEvent { date: string; xp: number; label: string; detail?: string }

export interface Progress {
  xp: number;
  events: XpEvent[];
  /** XP earned per workout, keyed by date + kind/id. */
  byWorkout: Map<WorkoutRecord, { xp: number; prs: string[] }>;
  streak: Streak;
  records: WorkoutRecord[];
  workoutDays: Set<string>;
}

export function computeProgress(state: AppState, today = todayIso()): Progress {
  const records = workoutRecords(state);
  const workoutDays = new Set(records.map(r => r.date));
  const walk = walkStreak(state, workoutDays, today);
  const events: XpEvent[] = [];
  const byWorkout: Progress['byWorkout'] = new Map();
  const best: Record<string, number> = {};
  const perDay: Record<string, number> = {};
  // Records are in completion order; PRs compare against everything logged before.
  for (const r of [...records].sort((a, b) => a.date.localeCompare(b.date) || a.completedAt.localeCompare(b.completedAt))) {
    const n = (perDay[r.date] = (perDay[r.date] ?? 0) + 1);
    const prs: string[] = [];
    for (const [ex, w] of Object.entries(r.weights)) {
      if (best[ex] !== undefined && w > best[ex] && EX[ex]) prs.push(ex);
      best[ex] = Math.max(best[ex] ?? 0, w);
    }
    if (n > XP.perDay) { byWorkout.set(r, { xp: 0, prs }); continue; }
    const streakN = walk.streakAt.get(r.date) ?? 1;
    const xp = XP.workout
      + XP.perExercise * Math.min(r.exercises, XP.maxExercises)
      + XP.pr * Math.min(prs.length, XP.maxPrs)
      + (n === 1 ? XP.streakPerDay * Math.min(streakN, XP.streakCap) : 0);
    byWorkout.set(r, { xp, prs });
    const parts = [`${r.exercises} exercises`];
    if (prs.length) parts.push(`${prs.length} PR${prs.length > 1 ? 's' : ''}`);
    if (n === 1 && streakN > 1) parts.push(`${streakN}-day streak`);
    events.push({ date: r.date, xp, label: r.title, detail: parts.join(' · ') });
  }
  for (const m of walk.milestones) events.push({ date: m.date, xp: MILESTONE_XP[m.n] ?? 0, label: `${m.n}-day streak`, detail: 'Streak bonus' });
  for (const [id, r] of Object.entries(state.rehab)) {
    for (const c of r?.checks ?? []) {
      if (c.passed) events.push({ date: c.date, xp: XP.rehabStage, label: 'Rehab stage passed', detail: id.replace(/-/g, ' ') });
    }
  }
  const ref = state.referrals;
  if (ref) {
    const counted = ref.friends.filter(f => f.activeAt).sort((a, b) => a.activeAt!.localeCompare(b.activeAt!)).slice(0, REFERRAL.maxFriends);
    for (const f of counted) events.push({ date: localDate(f.activeAt!), xp: REFERRAL.inviter, label: `${f.name || 'A friend'} joined`, detail: 'Invite bonus' });
    if (ref.invitedBy?.activeAt) events.push({ date: localDate(ref.invitedBy.activeAt), xp: REFERRAL.friend, label: 'Joined with an invite', detail: ref.invitedBy.name ? `Invited by ${ref.invitedBy.name}` : 'Welcome bonus' });
  }
  events.sort((a, b) => b.date.localeCompare(a.date));
  return { xp: events.reduce((a, e) => a + e.xp, 0), events, byWorkout, streak: walk.streak, records, workoutDays };
}

/** Local YYYY-MM-DD for a timestamp. */
function localDate(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------- Ranks ---------- */

export interface Rank { name: string; color: string; dark: string }

export const RANKS: Rank[] = [
  { name: 'Wood', color: '#B07A47', dark: '#6E4523' },
  { name: 'Stone', color: '#9AA3A8', dark: '#5B6469' },
  { name: 'Bronze', color: '#D08A4E', dark: '#8A4E1E' },
  { name: 'Silver', color: '#C9D3DA', dark: '#7D8C97' },
  { name: 'Gold', color: '#F2C14E', dark: '#A87B12' },
  { name: 'Platinum', color: '#7FD6CF', dark: '#2E8C85' },
  { name: 'Diamond', color: '#7CB8FF', dark: '#2F63B8' },
  { name: 'Elite', color: '#B48CFF', dark: '#6A3FC4' },
  { name: 'Legend', color: '#FF7A3D', dark: '#B4300B' },
];
export const DIVISIONS = 3;
const RANKED_LEVELS = (RANKS.length - 1) * DIVISIONS;
const ROMAN = ['I', 'II', 'III'];

/** XP needed to go from level n to n + 1. Quick at first, a grind later. */
export function levelCost(n: number): number {
  const m = Math.min(n, RANKED_LEVELS);
  return Math.round((100 * 1.2 ** m + 30 * m) / 10) * 10;
}

/** Total XP needed to reach level n. */
export function xpForLevel(n: number): number {
  let t = 0;
  for (let i = 0; i < n; i++) t += levelCost(i);
  return t;
}

export function levelName(n: number): string {
  if (n >= RANKED_LEVELS) return `Legend ${n - RANKED_LEVELS + 1}`;
  return `${RANKS[Math.floor(n / DIVISIONS)].name} ${ROMAN[n % DIVISIONS]}`;
}

export function rankOf(n: number): { rank: Rank; index: number; division: number } {
  const index = Math.min(Math.floor(n / DIVISIONS), RANKS.length - 1);
  return { rank: RANKS[index], index, division: n >= RANKED_LEVELS ? n - RANKED_LEVELS : n % DIVISIONS };
}

export interface LevelInfo { level: number; name: string; into: number; needed: number; xp: number }

export function levelInfo(xp: number): LevelInfo {
  let level = 0;
  let floor = 0;
  while (xp >= floor + levelCost(level)) { floor += levelCost(level); level++; }
  return { level, name: levelName(level), into: xp - floor, needed: levelCost(level), xp };
}

/* ---------- Strength over time ---------- */

export interface LiftPoint { date: string; weight: number }

/** Best weight per day for every loaded exercise, from both plan logs and custom workouts. */
export function liftHistory(state: AppState): Record<string, LiftPoint[]> {
  const byEx: Record<string, Record<string, number>> = {};
  const add = (ex: string, date: string, w: number | null | undefined) => {
    if (!w || w <= 0 || !EX[ex]) return;
    const m = (byEx[ex] ??= {});
    m[date] = Math.max(m[date] ?? 0, w);
  };
  for (const [date, log] of Object.entries(state.logs)) for (const [ex, w] of Object.entries(log.weights)) add(ex, date, w);
  for (const s of Object.values(state.sessions)) {
    if (s.deleted) continue;
    for (const e of s.entries) for (const x of e.sets) if (x.done) add(e.ex, s.date, x.weight);
  }
  const out: Record<string, LiftPoint[]> = {};
  for (const [ex, m] of Object.entries(byEx)) out[ex] = Object.entries(m).map(([date, weight]) => ({ date, weight })).sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Dates of every planned training day (not rest or game) in the plan. */
export function plannedTrainingDays(state: AppState): Set<string> {
  const out = new Set<string>();
  const plan = state.plan;
  if (!plan) return out;
  plan.weeks.forEach((w, wi) => w.days.forEach((d, di) => {
    const date = dateOf(plan, wi + 1, di);
    if (date >= plan.startDate && d.kind !== 'rest' && d.kind !== 'game') out.add(date);
  }));
  return out;
}
