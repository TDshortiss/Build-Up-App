import { EX, EXERCISES } from '../data/exercises';
import { INJURY } from '../data/injuries';
import { daysBetween } from './dates';
import type {
  AppState, Dose, Exercise, InjuryEntry, InjuryId, Pattern, PlanItem, RehabStage, RehabState, Tag, Tier,
} from './types';
import { TIER } from './types';

/*
 * View-time resolution. The saved plan holds the "healthy" exercise choices. Each time a session is shown,
 * exercises that conflict with the user's current rehab stage are swapped for safe alternatives, and rehab
 * blocks are filled from the stage the user is on. As the user passes progress checks, the original
 * exercises come back on their own.
 */

export interface Resolved {
  key: string;
  /** The exercise id the plan (or rehab protocol) prescribed, before any swap. */
  planned: string;
  item: PlanItem;
  ex: Exercise;
  /** The planned exercise, when it was replaced. */
  from?: Exercise;
  why?: string;
}

export interface Dropped {
  key: string;
  from: Exercise;
  why: string;
}

const FALLBACK: Partial<Record<Pattern, Pattern[]>> = {
  'plyo-v': ['balance', 'calf', 'glute'], 'plyo-h': ['balance', 'glute'], 'plyo-l': ['balance', 'abductor'],
  'plyo-upper': ['core-antirot', 'cuff'], rotational: ['core-antirot'],
  sprint: ['cond-int', 'cond-aero'], agility: ['balance', 'cond-int'],
  squat: ['lunge', 'quad', 'glute'], hinge: ['sl-hinge', 'glute', 'ham-curl'], 'sl-hinge': ['glute', 'ham-curl'],
  lunge: ['squat', 'quad', 'glute'], quad: ['glute'], 'ham-curl': ['glute'], adductor: ['abductor', 'glute'],
  vpush: ['hpush', 'cuff', 'delt'], hpush: ['cuff', 'delt'], vpull: ['hpull', 'cuff'], hpull: ['cuff'],
  biceps: ['hpull'], triceps: ['cuff'], grip: ['cuff'], carry: ['core-lateral'], 'core-flex': ['core-antiext'],
  calf: ['tib', 'balance'], 'cond-int': ['cond-aero'],
};

export function stageIndex(rehab: AppState['rehab'], id: InjuryId): number {
  return Math.min(3, Math.max(0, rehab[id]?.stage ?? 0));
}

export function currentStage(rehab: AppState['rehab'], id: InjuryId): RehabStage {
  return INJURY[id].stages[stageIndex(rehab, id)];
}

/** Tags to avoid right now, with the injury responsible for each. */
export function avoidMap(injuries: InjuryEntry[], rehab: AppState['rehab']): Map<Tag, InjuryId> {
  const out = new Map<Tag, InjuryId>();
  for (const inj of injuries) {
    const protect = inj.protectOnly && !rehab[inj.id]?.cleared;
    const stage = protect ? INJURY[inj.id].stages[0] : currentStage(rehab, inj.id);
    for (const t of stage.avoid) if (!out.has(t)) out.set(t, inj.id);
  }
  return out;
}

function retarget(item: PlanItem, from: Exercise, to: Exercise): PlanItem {
  let reps = item.reps;
  if (to.timed && !from.timed) reps = to.unilateral ? '30 s each' : '30 s';
  else if (!to.timed && from.timed) reps = to.unilateral ? '10 each' : '10';
  else if (from.pattern !== to.pattern && (to.pattern === 'cond-int' || to.pattern === 'cond-aero')) {
    return { ...item, ex: to.id, sets: to.pattern === 'cond-aero' ? 1 : 6, reps: to.pattern === 'cond-aero' ? '20–30 min' : '30 s hard', rest: to.pattern === 'cond-aero' ? undefined : '60 s easy', effort: to.pattern === 'cond-aero' ? 'Easy' : '8/10' };
  }
  // A different movement keeps the sets but not effort cues written for the original (e.g. "perfect landings").
  if (from.pattern !== to.pattern) return { ...item, ex: to.id, reps, effort: undefined, rest: '30–60 s' };
  return { ...item, ex: to.id, reps };
}

function safe(ex: Exercise, avoid: Map<Tag, InjuryId>): boolean {
  return !ex.tags.some(t => avoid.has(t));
}

function alternative(from: Exercise, tier: Tier, avoid: Map<Tag, InjuryId>, exclude: Set<string>): Exercise | null {
  const ok = (e: Exercise) => e.tier <= tier && safe(e, avoid) && !exclude.has(e.id) && e.id !== from.id;
  const same = EXERCISES.filter(e => e.pattern === from.pattern && ok(e))
    .sort((a, b) => (b.area === from.area ? 1 : 0) - (a.area === from.area ? 1 : 0) || b.tier - a.tier);
  if (same.length) return same[0];
  for (const pat of FALLBACK[from.pattern] ?? []) {
    const c = EXERCISES.filter(e => e.pattern === pat && ok(e)).sort((a, b) => b.tier - a.tier);
    if (c.length) return c[0];
  }
  return null;
}

export function resolveItems(
  items: PlanItem[], prefix: string, state: Pick<AppState, 'rehab' | 'swaps'> & { injuries: InjuryEntry[]; tier: Tier },
  /** Exercises already in the session (e.g. its rehab block), so a replacement doesn't repeat them. */
  inSession: Iterable<string> = [],
): { items: Resolved[]; dropped: Dropped[] } {
  const avoid = avoidMap(state.injuries, state.rehab);
  const used = new Set<string>();
  const taken = new Set<string>(inSession);
  const out: Resolved[] = [];
  const dropped: Dropped[] = [];
  items.forEach((item, i) => {
    const key = `${prefix}${i}`;
    const planned = EX[item.ex];
    if (!planned) return;
    const chosen = EX[state.swaps[item.ex]] ?? planned;
    if (safe(chosen, avoid) && !used.has(chosen.id)) {
      used.add(chosen.id);
      out.push({ key, planned: item.ex, item: chosen === planned ? item : retarget(item, planned, chosen), ex: chosen });
      return;
    }
    const culprit = chosen.tags.map(t => avoid.get(t)).find(Boolean);
    const alt = alternative(chosen, state.tier, avoid, new Set([...used, ...taken]));
    const why = culprit ? `Swapped to protect your ${INJURY[culprit].name.toLowerCase()}` : 'Swapped';
    if (alt) {
      used.add(alt.id);
      out.push({ key, planned: item.ex, item: retarget(item, chosen, alt), ex: alt, from: chosen, why });
    } else {
      dropped.push({ key, from: chosen, why: culprit ? `Skipped to protect your ${INJURY[culprit].name.toLowerCase()}` : 'Skipped' });
    }
  });
  return { items: out, dropped };
}

/** Rehab doses for the user's current stage, with equipment substitutions. */
export function rehabItems(id: InjuryId, rehab: AppState['rehab'], tier: Tier, prefix: string): Resolved[] {
  const stage = currentStage(rehab, id);
  return stage.work.map((d: Dose, i) => {
    let ex = EX[d.ex];
    let from: Exercise | undefined;
    if (ex.tier > tier) {
      const alt = EXERCISES.filter(e => e.pattern === ex.pattern && e.tier <= tier && e.area === ex.area)[0]
        ?? EXERCISES.filter(e => e.pattern === ex.pattern && e.tier <= tier)[0];
      if (alt) { from = ex; ex = alt; }
    }
    const item: PlanItem = { ex: ex.id, sets: d.sets, reps: d.reps, role: 'prehab', effort: d.note };
    return { key: `${prefix}${i}`, planned: d.ex, item, ex, from, why: from ? 'Swapped for your equipment' : undefined };
  });
}

export function tierOf(state: AppState): Tier {
  return state.profile ? TIER[state.profile.equipment] : 2;
}

/* ---------- Rehab progression ---------- */

export interface RehabStatus {
  stage: number;
  daysAtStage: number;
  checkUnlocked: boolean;
  /** Days until the check unlocks. */
  waitDays: number;
  recentPain: number[];
  suggestRegress: boolean;
  isLast: boolean;
}

export function painHistory(state: AppState, id: InjuryId): { date: string; pain: number }[] {
  return Object.entries(state.logs)
    .filter(([, l]) => typeof l.pain[id] === 'number')
    .map(([date, l]) => ({ date, pain: l.pain[id] as number }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function rehabStatus(state: AppState, id: InjuryId, todayIso: string): RehabStatus {
  const r: RehabState = state.rehab[id] ?? { stage: 0, stageStartedAt: todayIso, checks: [] };
  const stage = stageIndex(state.rehab, id);
  const def = INJURY[id].stages[stage];
  const daysAtStage = Math.max(0, daysBetween(r.stageStartedAt, todayIso));
  const recent = painHistory(state, id).filter(h => h.date >= r.stageStartedAt).slice(-3).map(h => h.pain);
  const painOk = recent.length === 0 || recent.reduce((a, b) => a + b, 0) / recent.length <= 3;
  const last2 = painHistory(state, id).slice(-2);
  return {
    stage,
    daysAtStage,
    checkUnlocked: stage < 3 && daysAtStage >= def.minDays && painOk,
    waitDays: Math.max(0, def.minDays - daysAtStage),
    recentPain: recent,
    suggestRegress: stage > 0 && last2.length === 2 && last2.every(h => h.pain >= 6 && h.date >= r.stageStartedAt),
    isLast: stage === 3,
  };
}

export function painTone(n: number): 'green' | 'amber' | 'red' {
  return n <= 2 ? 'green' : n <= 5 ? 'amber' : 'red';
}

export function painMessage(n: number, injuryName: string): string {
  if (n <= 2) return `Safe zone. Your ${injuryName.toLowerCase()} is handling this well.`;
  if (n <= 5) return 'Acceptable if it settles by tomorrow morning. Don\'t add load next session.';
  return 'Too much. Stop the exercise that hurts, and next session go back a step or use the easier swap.';
}
