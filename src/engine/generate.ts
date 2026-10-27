import { EX, EXERCISES } from '../data/exercises';
import { INJURY } from '../data/injuries';
import { SPORT } from '../data/sports';
import { addDays, daysBetween, mondayOf } from './dates';
import {
  generalTemplates, inSeasonTemplates, RECOVERY_DAY, rehabTemplates, sportTemplates, upperPower, WARMUPS,
  type DayTemplate, type Token,
} from './templates';
import {
  TIER, type DayKind, type Exercise, type Pattern, type Phase, type PhaseKind, type Plan, type PlanBlock,
  type PlanDay, type PlanItem, type PlanWeek, type Profile, type SlotRole, type Sport, type Tag, type Tier,
} from './types';

export const GENERATOR_VERSION = 1;

/* ---------- Plan length and phases ---------- */

export function planWeeks(p: Profile): number {
  const monday = mondayOf(p.startDate);
  if ((p.goal === 'offseason' || p.goal === 'inseason') && p.targetDate) {
    const w = Math.ceil((daysBetween(monday, p.targetDate) + 1) / 7);
    return clamp(w, 4, p.goal === 'inseason' ? 30 : 20);
  }
  return clamp(p.weeks || 12, 4, 30);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function phase(kind: PhaseKind, name: string, start: number, end: number, goal: string, notes: string[]): Phase {
  return { kind, name, start, end, goal, notes };
}

export function buildPhases(p: Profile, weeks: number): Phase[] {
  const sport = p.sport ? SPORT[p.sport] : null;
  const sportName = sport?.name ?? 'your sport';

  if (p.goal === 'offseason') {
    const peak = 1;
    let foundation: number, strength: number;
    if (weeks < 6) { foundation = 0; strength = Math.ceil((weeks - peak) / 2); }
    else { foundation = Math.round(weeks * 0.35); strength = Math.round(weeks * 0.3); }
    const power = weeks - peak - foundation - strength;
    const out: Phase[] = [];
    let w = 1;
    if (foundation) {
      out.push(phase('foundation', 'Foundation', w, w + foundation - 1,
        'Build muscle, work capacity and clean technique. Jumps are low and controlled.',
        ['Moderate weights, more reps', 'Learn every lift with good form', 'Build your aerobic base']));
      w += foundation;
    }
    out.push(phase('strength', 'Strength', w, w + strength - 1,
      'Heavier lifts and more single-leg and lateral work. Power work gets more demanding.',
      ['Fewer reps, heavier weights', 'Rest fully between heavy sets', 'Stick every landing for 2 s']));
    w += strength;
    out.push(phase('power', 'Power', w, w + power - 1,
      `Turn strength into speed for ${sportName}. Every rep is fast.`,
      ['Move the weight fast, stop if it slows down', 'Conditioning matches game demands', 'Sprint and jump at full intent']));
    w += power;
    out.push(phase('peak', 'Peak', w, weeks,
      'Cut volume roughly in half so you arrive fresh and fast.',
      ['Short, sharp sessions', 'Nothing new, nothing to failure', 'Sleep and eat well']));
    return out;
  }

  if (p.goal === 'inseason') {
    return [phase('inseason', 'In-Season', 1, weeks,
      sport?.inSeasonNote ?? 'Keep strength and power while your sport takes priority.',
      ['Low volume, never to failure', 'Never lift legs hard the day before a game', 'Every 4th week is lighter'])];
  }

  if (p.goal === 'rehab') {
    const a = Math.max(1, Math.round(weeks * 0.2));
    const b = Math.max(1, Math.round(weeks * 0.3));
    const c = Math.max(1, Math.round(weeks * 0.3));
    const d = Math.max(1, weeks - a - b - c);
    return [
      phase('rehab-calm', 'Calm', 1, a, 'Settle pain and start loading gently. Train everything else that doesn\'t hurt.',
        ['Pain stays at 3/10 or less', 'Rate pain after every session', 'Check in the next morning']),
      phase('rehab-build', 'Rebuild', a + 1, a + b, 'Rebuild strength in the injured area.', ['Pass the progress check to move on', 'Same or better the next morning']),
      phase('rehab-strength', 'Strengthen', a + b + 1, a + b + c, 'Heavier loading and sport movements return.', ['Speed and jumps come back gradually']),
      phase('rehab-return', 'Return', a + b + c + 1, a + b + c + d, `Return to full training${sport ? ` for ${sport.name}` : ''}.`, ['Keep the rehab exercises as maintenance']),
    ].filter(ph => ph.start <= ph.end && ph.start <= weeks).map(ph => ({ ...ph, end: Math.min(ph.end, weeks) }));
  }

  // General
  const focus = p.generalFocus;
  const b = Math.ceil(weeks / 3);
  if (focus === 'fitness') {
    return [
      phase('fitness', 'Base', 1, b, 'Build the habit and an aerobic base.', ['Steady effort, finish feeling good']),
      phase('fitness', 'Build', b + 1, Math.min(2 * b, weeks), 'More intervals and heavier circuits.', ['Shorter rests', 'Push the intervals']),
      phase('fitness', 'Peak', 2 * b + 1, weeks, 'Your fittest block. Test yourself at the end.', ['Retest your benchmarks in the final week']),
    ].filter(ph => ph.start <= ph.end);
  }
  const hyp = (name: string, s: number, e: number) => phase('hypertrophy', name, s, e,
    'Moderate weights for 6–15 reps, close to failure. This is where muscle gets built.',
    ['Finish sets 1–2 reps short of failure', 'Add a rep or some weight each week', 'Slow lowering, full range']);
  const str = (name: string, s: number, e: number) => phase('max-strength', name, s, e,
    'Heavier weights for fewer reps on the main lifts. Builds the strength that makes the next growth block more productive.',
    ['Rest 3 minutes on main lifts', 'Leave 1–2 reps in reserve', 'Accessories stay moderate']);
  const out = focus === 'strength'
    ? [hyp('Build', 1, b), str('Strength', b + 1, Math.min(2 * b, weeks)), str('Peak Strength', 2 * b + 1, weeks)]
    : [hyp('Build', 1, b), str('Strength', b + 1, Math.min(2 * b, weeks)), hyp('Grow', 2 * b + 1, weeks)];
  return out.filter(ph => ph.start <= ph.end);
}

/** Deload weeks: the last week of every 4-week stretch inside long phases, except phases that already taper. */
function isDeload(ph: Phase, week: number): boolean {
  if (ph.kind === 'peak' || ph.kind.startsWith('rehab')) return false;
  const len = ph.end - ph.start + 1;
  if (len < 4) return false;
  return (week - ph.start + 1) % 4 === 0;
}

const BASE_LOAD: Record<PhaseKind, number> = {
  foundation: 5, strength: 7, power: 8, peak: 4, inseason: 5, hypertrophy: 6, 'max-strength': 7, fitness: 6,
  'rehab-calm': 3, 'rehab-build': 4, 'rehab-strength': 6, 'rehab-return': 7,
};

/* ---------- Exercise selection ---------- */

interface Ctx {
  p: Profile;
  sport: Sport | null;
  tier: Tier;
  maxLevel: number;
  avoid: Set<Tag>;
  prefer: Set<string>;
}

function makeCtx(p: Profile): Ctx {
  const sport = p.sport ? SPORT[p.sport] : null;
  const avoid = new Set<Tag>();
  if (p.experience === 'beginner' || p.ageGroup !== 'adult') avoid.add('plyo-high');
  return {
    p, sport, tier: TIER[p.equipment],
    maxLevel: p.experience === 'beginner' ? 2 : 3,
    avoid,
    prefer: new Set(sport?.prefer ?? []),
  };
}

/* Rehab-specific drills: used by rehab blocks and swaps, never picked for a normal training slot. */
const REHAB_ONLY = new Set(['adductor-squeeze', 'quad-set', 'ham-bridge-iso', 'wrist-iso', 'ankle-alphabet', 'tke',
  'calf-iso', 'short-foot', 'band-eversion', 'heel-walk', 'mcgill-curl-up', 'ecc-calf', 'wrist-ext-ecc', 'wrist-flex-ecc', 'easy-walk']);

/* Exercises that make sense as the main lift of a session. */
const MAIN_OK = new Set(['back-squat', 'front-squat', 'goblet-squat', 'leg-press', 'tempo-squat', 'trap-bar-deadlift', 'rdl', 'db-rdl',
  'rfess', 'rfess-bw', 'reverse-lunge', 'split-squat', 'step-up', 'walking-lunge', 'sl-rdl-db', 'sl-rdl', 'b-stance-rdl',
  'bench-press', 'db-bench', 'incline-db-press', 'db-floor-press', 'push-up', 'overhead-press', 'db-shoulder-press', 'landmine-press', 'pike-push-up',
  'pull-up', 'lat-pulldown', 'cs-row', 'db-row', 'cable-row', 'inverted-row', 'band-pulldown', 'band-row', 'hip-thrust']);

/* Plyometrics that are too intense for building phases. */
const BUILDING: PhaseKind[] = ['foundation', 'hypertrophy', 'fitness', 'inseason', 'rehab-calm', 'rehab-build', 'rehab-strength'];

function candidates(pattern: Pattern, role: SlotRole, ctx: Ctx, used: Set<string>, week: Set<string>, phaseKind: PhaseKind): Exercise[] {
  const easyFirst = ctx.p.experience === 'beginner' && (phaseKind === 'foundation' || phaseKind === 'hypertrophy' || phaseKind === 'fitness');
  const lift = role === 'main' || role === 'secondary';
  let c = EXERCISES
    .filter(e => e.pattern === pattern && e.tier <= ctx.tier && e.level <= ctx.maxLevel && !used.has(e.id)
      && !REHAB_ONLY.has(e.id) && !e.tags.some(t => ctx.avoid.has(t))
      && !(BUILDING.includes(phaseKind) && e.tags.includes('plyo-high')));
  if (role === 'main' && c.some(e => MAIN_OK.has(e.id))) c = c.filter(e => MAIN_OK.has(e.id));
  return c.sort((a, b) =>
    (lift ? 0 : (week.has(a.id) ? 1 : 0) - (week.has(b.id) ? 1 : 0))
    || (easyFirst ? a.level - b.level : 0)
    || (ctx.prefer.has(b.id) ? 1 : 0) - (ctx.prefer.has(a.id) ? 1 : 0)
    || b.tier - a.tier);
}

/* Rotates between the top two equally-equipped options so each phase feels fresh. */
function pick(patterns: Pattern[], role: SlotRole, ctx: Ctx, used: Set<string>, week: Set<string>, rot: number, phaseKind: PhaseKind): Exercise | null {
  for (const pat of patterns) {
    const c = candidates(pat, role, ctx, used, week, phaseKind);
    if (!c.length) continue;
    const top = c[0];
    const pool = c.filter(e => e.tier === top.tier && !!e.loaded === !!top.loaded && (role === 'main' || !week.has(e.id) || week.has(top.id)));
    return pool[rot % Math.min(pool.length, 2)];
  }
  return null;
}

function conditioningPattern(ctx: Ctx, kind: PhaseKind): Pattern {
  const e = ctx.sport?.energy;
  if (!ctx.sport) return 'cond-int';
  if (e === 'aerobic') return 'cond-aero';
  if (e === 'alactic') return kind === 'foundation' ? 'cond-int' : 'sprint';
  if (e === 'mixed' && kind === 'foundation') return 'cond-aero';
  return 'cond-int';
}

/** Expand a template token into concrete patterns, or a fixed exercise id for prehab. */
function expand(t: Token, ctx: Ctx, kind: PhaseKind): Pattern[] {
  const sp = ctx.sport;
  switch (t) {
    case 'P0': return sp?.power.length ? [sp.power[0]] : ['plyo-v'];
    case 'P1': return sp?.power.length ? [sp.power[Math.min(1, sp.power.length - 1)]] : ['plyo-h'];
    case 'P2': return sp?.power.length ? [sp.power[Math.min(2, sp.power.length - 1)]] : ['plyo-l'];
    case 'UP': return [upperPower(sp)];
    case 'SPEED': return sp && !sp.runs ? ['agility', 'plyo-l'] : ['sprint', 'agility'];
    case 'COND': return [conditioningPattern(ctx, kind)];
    case 'PREHAB': return [];
    default: return [t];
  }
}

/* Running sports keep the impact versions of conditioning; everyone else gets low-impact versions first. */
function preferConditioning(c: Exercise | null, ctx: Ctx, used: Set<string>): Exercise | null {
  if (!c || (c.pattern !== 'cond-aero' && c.pattern !== 'cond-int')) return c;
  const runs = ctx.sport ? ctx.sport.runs : ctx.p.generalFocus === 'fitness';
  const pool = EXERCISES.filter(e => e.pattern === c.pattern && e.tier <= ctx.tier && !used.has(e.id) && e.id !== 'easy-walk');
  const want = pool.find(e => (runs ? e.tags.includes('impact') : !e.tags.includes('impact')));
  return want ?? c;
}

/* ---------- Doses ---------- */

type Scheme = [sets: number, reps: string, rest: string, effort: string];

const LIFT: Record<'main' | 'secondary' | 'accessory', Partial<Record<PhaseKind, Scheme>>> = {
  main: {
    foundation: [3, '8–10', '2 min', '2–3 reps left'], strength: [4, '4–6', '3 min', '2 reps left'],
    power: [4, '3–5', '3 min', 'Fast, 2–3 reps left'], peak: [3, '3', '3 min', 'Fast and easy'],
    inseason: [3, '3–5', '2–3 min', '3 reps left'], hypertrophy: [4, '6–10', '2–3 min', '1–2 reps left'],
    'max-strength': [5, '3–5', '3 min', '1–2 reps left'], fitness: [3, '10–12', '60–90 s', '2–3 reps left'],
  },
  secondary: {
    foundation: [3, '10', '90 s', '2–3 reps left'], strength: [3, '6', '2 min', '2 reps left'],
    power: [3, '5', '2 min', '2–3 reps left'], peak: [2, '5', '2 min', 'Easy'],
    inseason: [2, '5', '2 min', '3 reps left'], hypertrophy: [3, '8–12', '2 min', '1–2 reps left'],
    'max-strength': [4, '5–6', '2–3 min', '2 reps left'], fitness: [3, '12', '60 s', '2–3 reps left'],
  },
  accessory: {
    foundation: [3, '10–12', '60–90 s', '2 reps left'], strength: [3, '8', '90 s', '2 reps left'],
    power: [2, '8', '90 s', '2–3 reps left'], peak: [2, '8', '60 s', 'Easy'],
    inseason: [2, '8', '60 s', '3 reps left'], hypertrophy: [3, '10–15', '60–90 s', '0–2 reps left'],
    'max-strength': [3, '8–10', '90 s', '1–2 reps left'], fitness: [3, '12–15', '45 s', '2 reps left'],
  },
};

const POWER: Partial<Record<PhaseKind, [number, number]>> = {
  foundation: [3, 5], strength: [4, 4], power: [5, 3], peak: [3, 3], inseason: [2, 3],
  hypertrophy: [3, 5], 'max-strength': [3, 3], fitness: [3, 6],
};

function rehabAsTraining(kind: PhaseKind): PhaseKind {
  return kind === 'rehab-calm' || kind === 'rehab-build' ? 'foundation' : kind === 'rehab-strength' ? 'strength' : kind.startsWith('rehab') ? 'power' : kind;
}

function conditioningDose(ex: Exercise, ctx: Ctx, kind: PhaseKind): Pick<PlanItem, 'sets' | 'reps' | 'rest' | 'effort'> {
  const k = rehabAsTraining(kind);
  if (ex.pattern === 'cond-aero') {
    const min = k === 'foundation' || k === 'fitness' ? '30–40 min' : k === 'peak' ? '20 min' : '25–30 min';
    return { sets: 1, reps: min, effort: 'Easy, conversational' };
  }
  if (ex.pattern === 'sprint') {
    const dist = k === 'peak' ? '20 m' : k === 'power' ? '20–30 m' : '10–20 m';
    return { sets: k === 'peak' ? 4 : 6, reps: dist, rest: 'Walk back, full rest', effort: 'Max effort' };
  }
  const e = ctx.sport?.energy;
  if (e === 'mixed' && ctx.sport?.id === 'ski-snowboard') return { sets: k === 'power' ? 6 : 5, reps: '60–90 s hard', rest: '90 s easy', effort: '8/10' };
  if (e === 'mixed' && (ctx.sport?.id === 'wrestling' || ctx.sport?.id === 'combat')) return { sets: k === 'foundation' ? 3 : 4, reps: '2–3 min hard', rest: '1 min easy', effort: '8/10' };
  if (e === 'alactic') return { sets: 8, reps: '10 s all-out', rest: '50 s easy', effort: 'Max effort' };
  if (k === 'foundation' || k === 'fitness') return { sets: 6, reps: '30 s hard', rest: '60 s easy', effort: '8/10' };
  if (k === 'strength' || k === 'inseason') return { sets: 8, reps: '20 s hard', rest: '40 s easy', effort: '8–9/10' };
  if (k === 'peak') return { sets: 5, reps: '15 s hard', rest: '45 s easy', effort: '8/10' };
  return { sets: 10, reps: '15 s hard', rest: '45 s easy', effort: '9/10' };
}

function dose(role: SlotRole, ex: Exercise, ctx: Ctx, kind: PhaseKind, pos: number, len: number, deload: boolean): PlanItem {
  const k = rehabAsTraining(kind);
  let item: PlanItem;
  if (role === 'main' || role === 'secondary' || role === 'accessory') {
    const [sets, reps, rest, effort] = LIFT[role][k] ?? LIFT[role].foundation!;
    item = { ex: ex.id, role, sets, reps: ex.timed ? '30–45 s' : reps, rest, effort };
    // Bodyweight lifts need more reps to be a training stimulus.
    if (!ex.loaded && !ex.timed) item.reps = role === 'accessory' || ['foundation', 'hypertrophy', 'fitness'].includes(k) ? '12–15' : '8–12';
    // Second half of a phase: one more set on the main lift.
    if (role === 'main' && len >= 3 && pos >= Math.ceil(len / 2) && k !== 'peak' && k !== 'inseason') item.sets += 1;
    // Teens, masters and beginners never go below 5 reps.
    if ((ctx.p.ageGroup !== 'adult' || ctx.p.experience === 'beginner') && /^[1-4]\b|^3–5|^4–6/.test(item.reps)) item.reps = '5–6';
    if (ex.unilateral && /^[1-4]\b|^3–5|^4–6/.test(item.reps)) item.reps = '5–6';
    // Dumbbells top out quickly; keep home lifts in a range they can still challenge.
    if (ex.loaded && ex.tier === 1 && /^[1-4]\b|^3–5|^4–6|^5–6/.test(item.reps)) item.reps = '6–8';
    if (ctx.p.experience === 'beginner' && item.effort?.startsWith('0')) item.effort = '1–2 reps left';
    if (ex.id === 'nordic' || ex.id === 'reverse-nordic') { item.reps = '4–6'; item.effort = 'Lower as slowly as you can'; }
    if (ex.unilateral) item.reps += ' each';
  } else if (role === 'power') {
    const [sets, reps] = POWER[k] ?? [3, 5];
    const r = ex.timed ? '15 s' : ex.loaded ? '8' : `${reps}${ex.unilateral ? ' each' : ''}`;
    item = { ex: ex.id, role, sets, reps: r, rest: '60–90 s', effort: ex.pattern.startsWith('plyo-') && ex.pattern !== 'plyo-upper' ? 'Max intent, perfect landings' : 'Max intent' };
  } else if (role === 'speed') {
    if (ex.pattern === 'sprint') return { ...conditioningDose(ex, ctx, kind), ex: ex.id, role };
    item = { ex: ex.id, role, sets: k === 'peak' ? 3 : 5, reps: ex.timed ? '20 s' : '1 rep', rest: '60 s', effort: 'Quick and sharp' };
  } else if (role === 'conditioning') {
    item = { ex: ex.id, role, ...conditioningDose(ex, ctx, kind) };
  } else if (role === 'core') {
    item = { ex: ex.id, role, sets: k === 'inseason' || k === 'peak' ? 2 : 3, reps: ex.timed ? '30 s' : ex.unilateral ? '8 each' : '10', rest: '45 s' };
  } else if (role === 'prehab') {
    const reps = ex.id === 'nordic' ? '4–6' : ex.timed ? '20–30 s' : ex.unilateral ? '12 each' : '12–15';
    item = { ex: ex.id, role, sets: 2, reps: ex.timed && ex.unilateral ? `${reps} each` : reps, rest: '30–60 s' };
  } else {
    item = { ex: ex.id, role, sets: role === 'warmup' ? 1 : 2, reps: ex.timed ? '30–45 s' : ex.unilateral ? '8 each' : '10' };
  }
  if (deload) {
    item.sets = Math.max(1, Math.round(item.sets * 0.6));
    if (role !== 'warmup' && role !== 'mobility') item.effort = 'Easy: lighter week';
  }
  return item;
}

/* ---------- Session building ---------- */

const MINUTES_PER_SET: Record<SlotRole, number> = {
  warmup: 1, power: 1.5, speed: 1.5, main: 3, secondary: 2.5, accessory: 1.75, prehab: 1.25, core: 1.25, conditioning: 0, mobility: 1.5,
};
const DROP_ORDER: SlotRole[] = ['accessory', 'conditioning', 'core', 'prehab', 'accessory', 'speed', 'secondary', 'power'];

function itemMinutes(i: PlanItem): number {
  if (i.role === 'conditioning') {
    const m = /(\d+)(?:–(\d+))? min/.exec(i.reps);
    if (m) return Number(m[2] ?? m[1]);
    const secs = /(\d+)(?:–(\d+))? (s|min)/.exec(i.reps);
    const rest = i.rest ? /(\d+) (s|min)/.exec(i.rest) : null;
    const work = secs ? Number(secs[2] ?? secs[1]) * (secs[3] === 'min' ? 60 : 1) : 30;
    const r = rest ? Number(rest[1]) * (rest[2] === 'min' ? 60 : 1) : 60;
    return Math.round((i.sets * (work + r)) / 60) + 2;
  }
  return i.sets * MINUTES_PER_SET[i.role];
}

export function rehabMinutes(injuries: Profile['injuries']): number {
  return injuries.filter(i => !i.protectOnly).length * 10;
}

interface WeekCtx { kind: PhaseKind; pos: number; len: number; deload: boolean; phaseIdx: number }

function warmupItems(t: DayTemplate, ctx: Ctx, rot: number): PlanItem[] {
  const pool = WARMUPS[t.warmup].filter(id => EX[id] && EX[id].tier <= ctx.tier);
  const n = 3;
  return Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[(rot + i) % pool.length])
    .map(id => dose('warmup', EX[id], ctx, 'foundation', 0, 1, false));
}

function buildSession(t: DayTemplate, ctx: Ctx, wk: WeekCtx, seed: number, prehabCursor: { i: number }, week: Set<string>): PlanDay {
  const used = new Set<string>();
  // The peak phase keeps the previous phase's exercises: nothing new right before the season.
  const rot = (wk.kind === 'peak' ? wk.phaseIdx - 1 : wk.phaseIdx) + seed;
  const warm = warmupItems(t, ctx, rot);
  warm.forEach(i => used.add(i.ex));

  const items: PlanItem[] = [];
  for (const slot of t.slots) {
    let ex: Exercise | null = null;
    if (slot.patterns[0] === 'PREHAB') {
      const list = (ctx.sport?.prehab ?? ['side-plank', 'band-er', 'sl-balance', 'copenhagen', 'tib-raise', 'nordic'])
        .filter(id => EX[id] && EX[id].tier <= ctx.tier && EX[id].level <= ctx.maxLevel && !used.has(id));
      if (list.length) ex = EX[list[prehabCursor.i++ % list.length]];
      else ex = pick(['cuff', 'balance', 'core-lateral'], slot.role, ctx, used, week, rot, wk.kind);
    } else {
      const pats = slot.patterns.flatMap(tok => expand(tok, ctx, wk.kind));
      ex = pick(pats, slot.role, ctx, used, week, slot.role === 'mobility' ? rot + items.length : rot, wk.kind);
      if (slot.role === 'conditioning' || (slot.role === 'speed' && ex?.pattern.startsWith('cond'))) ex = preferConditioning(ex, ctx, used);
    }
    if (!ex) continue;
    used.add(ex.id);
    week.add(ex.id);
    items.push(dose(slot.role, ex, ctx, wk.kind, wk.pos, wk.len, wk.deload));
  }

  // Fit the time budget. Rehab blocks count against it.
  const budget = ctx.p.sessionMinutes - (t.recovery ? 0 : rehabMinutes(ctx.p.injuries)) - 5;
  const total = () => items.reduce((a, i) => a + itemMinutes(i), 0) + warm.length;
  for (const role of DROP_ORDER) {
    if (total() <= budget) break;
    if (t.keep?.includes(role)) continue;
    for (let j = items.length - 1; j >= 0; j--) {
      if (items[j].role === role) { items.splice(j, 1); break; }
    }
  }

  const blocks: PlanBlock[] = [{ title: 'Warm-up', note: 'Easy, 5 minutes. Get warm and loose.', items: warm }];
  const group = (title: string, roles: SlotRole[], note?: string) => {
    const g = items.filter(i => roles.includes(i.role));
    if (g.length) blocks.push({ title, note, items: g });
  };
  if (!t.recovery) {
    for (const inj of ctx.p.injuries) {
      if (inj.protectOnly) continue;
      blocks.push({ title: `${INJURY[inj.id].name} rehab`, rehab: inj.id, note: 'Do this before the main work, while you\'re fresh.', items: [] });
    }
  }
  group('Speed & power', ['speed', 'power'], 'Fresh legs, full rest, every rep at full intent. Quality over quantity.');
  group('Strength', ['main', 'secondary'], 'Warm up to your working weight with 2–3 lighter sets.');
  group('Accessories & prehab', ['accessory', 'prehab']);
  group('Core', ['core']);
  group(t.recovery ? 'Mobility' : 'Mobility', ['mobility']);
  group('Conditioning', ['conditioning'], ctx.sport?.conditioningNote);

  const minutes = Math.round((total() + (t.recovery ? 0 : rehabMinutes(ctx.p.injuries)) + 5) / 5) * 5;
  const hard = !wk.deload && ['strength', 'power', 'max-strength'].includes(rehabAsTraining(wk.kind));
  return {
    kind: t.recovery ? 'recovery' : 'train',
    title: t.title,
    focus: t.focus,
    minutes: Math.max(15, Math.min(minutes, ctx.p.sessionMinutes + 10)),
    effort: t.recovery || wk.deload || wk.kind === 'peak' ? 1 : hard ? 3 : 2,
    blocks,
  };
}

function restDay(kind: DayKind, ctx: Ctx, title?: string): PlanDay {
  if (kind === 'game') return { kind, title: 'Game day', focus: 'Compete. Warm up well, refuel and sleep afterward.', minutes: 0, effort: 3, blocks: [] };
  const rehab = ctx.p.injuries.filter(i => !i.protectOnly);
  if (kind === 'rehab' && rehab.length) {
    return {
      kind, title: title ?? 'Rehab & Mobility', focus: 'A short rehab session on your day off keeps healing on track.',
      minutes: rehab.length * 10 + 5, effort: 1,
      blocks: [
        ...rehab.map(r => ({ title: `${INJURY[r.id].name} rehab`, rehab: r.id, items: [] as PlanItem[] })),
        { title: 'Mobility', items: ['worlds-greatest', '9090', 'open-book'].map(id => dose('mobility', EX[id], ctx, 'foundation', 0, 1, false)) },
      ],
    };
  }
  return { kind: 'rest', title: 'Rest', focus: 'Recover. A walk, some stretching and good sleep.', minutes: 0, effort: 1, blocks: [] };
}

/** Choose training weekdays. In-season, avoid game days and the day before them when possible. */
export function scheduleDays(p: Profile): number[] {
  let days = [...new Set(p.trainingDays)].filter(d => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (p.goal === 'inseason') {
    const blocked = new Set(p.gameDays.flatMap(g => [g, (g + 6) % 7]));
    const free = days.filter(d => !blocked.has(d));
    const nonGame = days.filter(d => !p.gameDays.includes(d));
    days = (free.length ? free : nonGame).slice(0, 3);
  }
  return days.slice(0, 6);
}

function templatesFor(p: Profile, n: number): DayTemplate[] {
  switch (p.goal) {
    case 'offseason': return sportTemplates(n);
    case 'inseason': return inSeasonTemplates(n);
    case 'rehab': return rehabTemplates(n);
    default: return generalTemplates(n, p.generalFocus);
  }
}

function titleFor(p: Profile, weeks: number): string {
  const sport = p.sport ? SPORT[p.sport].name : null;
  if (p.goal === 'rehab') {
    const inj = p.injuries[0] ? INJURY[p.injuries[0].id].name : 'Injury';
    return `${inj} Rehab`;
  }
  if (p.goal === 'offseason') return `${weeks}-Week ${sport ?? ''} Off-Season`.replace(/\s+/g, ' ');
  if (p.goal === 'inseason') return `In-Season ${sport ?? ''} Support`.replace(/\s+/g, ' ').trim();
  return { muscle: `${weeks}-Week Muscle Builder`, strength: `${weeks}-Week Strength Builder`, fitness: `${weeks}-Week Fitness Builder` }[p.generalFocus];
}

function summaryFor(p: Profile, days: number[]): string {
  const sport = p.sport ? SPORT[p.sport] : null;
  const eq = { gym: 'a full gym', home: 'dumbbells and bands', bodyweight: 'just your bodyweight' }[p.equipment];
  const inj = p.injuries.length ? ` It works around your ${p.injuries.map(i => INJURY[i.id].name.toLowerCase()).join(' and ')}, with rehab built into each session.` : '';
  const base = `${days.length} sessions a week, about ${p.sessionMinutes} minutes each, using ${eq}.`;
  if (p.goal === 'offseason' && sport) return `Built to peak you for ${sport.name}: ${sport.qualities.slice(0, 3).join(', ').toLowerCase()}. ${base}${inj}`;
  if (p.goal === 'inseason' && sport) return `Keeps you strong and healthy through the ${sport.name} season without leaving you sore for games. ${base}${inj}`;
  if (p.goal === 'rehab') return `Gets you back${sport ? ` to ${sport.name}` : ''} step by step, with progress checks deciding when you move on. ${base}`;
  return `${base}${inj}`;
}

function rulesFor(p: Profile): Plan['rules'] {
  const rules: Plan['rules'] = [];
  const sport = p.sport ? SPORT[p.sport] : null;
  if (p.injuries.length) rules.push({ title: 'Follow the pain guide', body: 'Pain up to 3/10 is fine if it settles by the next morning. Rate it after every session; the app adjusts your rehab stage.' });
  rules.push({ title: 'Leave reps in the tank', body: 'Each lift lists how many reps to leave unfinished. Grinding to failure adds fatigue, not results.' });
  rules.push({ title: 'Add weight when it\'s easy', body: `Hit the top of the rep range on every set? Add ${p.units === 'kg' ? '1–2.5 kg' : '2.5–5 lb'} next time.` });
  if (p.goal === 'offseason' || p.goal === 'rehab') rules.push({ title: 'Power before strength', body: 'Jumps and sprints come first in the session, fresh, with full rest. Stop a set if your reps slow down.' });
  if (p.goal === 'inseason') rules.push({ title: 'Games come first', body: 'If you\'re sore or beat up, cut the session in half. Never train legs hard the day before a game.' });
  if (sport) rules.push({ title: `${sport.name} conditioning`, body: sport.conditioningNote });
  if (p.ageGroup === 'teen') rules.push({ title: 'Technique first', body: 'Have a coach or parent check your form on the main lifts. Never max out.' });
  if (p.ageGroup === 'masters') rules.push({ title: 'Recovery is training', body: 'Take an extra rest day whenever you need one. Warm up longer and progress weights slowly.' });
  rules.push({ title: 'Lighter weeks are on purpose', body: 'Every few weeks the volume drops. That\'s when your body adapts, so don\'t skip them.' });
  return rules;
}

/* ---------- Entry point ---------- */

export function generatePlan(p: Profile): Plan {
  const ctx = makeCtx(p);
  const weeks = planWeeks(p);
  const phases = buildPhases(p, weeks);
  const days = scheduleDays(p);
  const templates = templatesFor(p, Math.max(1, days.length));
  const monday = mondayOf(p.startDate);
  const hasRehab = p.injuries.some(i => !i.protectOnly);
  const prehabCursor = { i: 0 };

  const out: PlanWeek[] = [];
  for (let w = 1; w <= weeks; w++) {
    const phaseIdx = Math.max(0, phases.findIndex(ph => w >= ph.start && w <= ph.end));
    const ph = phases[phaseIdx];
    const deload = isDeload(ph, w);
    const wk: WeekCtx = { kind: ph.kind, pos: w - ph.start, len: ph.end - ph.start + 1, deload, phaseIdx };

    const planDays: PlanDay[] = [];
    const weekUsed = new Set<string>();
    let ti = 0;
    for (let d = 0; d < 7; d++) {
      if (p.goal === 'inseason' && p.gameDays.includes(d)) { planDays.push(restDay('game', ctx)); continue; }
      if (days.includes(d) && ti < templates.length) {
        const t = templates[ti];
        const seed = templates.slice(0, ti).filter(x => x.key === t.key).length;
        planDays.push(buildSession(t.recovery ? RECOVERY_DAY : t, ctx, wk, t.recovery ? seed + d : seed, prehabCursor, weekUsed));
        ti++;
        continue;
      }
      planDays.push(restDay(hasRehab && days.length < 4 ? 'rehab' : 'rest', ctx));
    }

    const ramp = wk.len > 1 ? wk.pos / (wk.len - 1) : 0;
    const load = deload ? Math.max(2, BASE_LOAD[ph.kind] - 3) : Math.min(10, Math.round(BASE_LOAD[ph.kind] + ramp * 1.5));
    out.push({ n: w, phase: phaseIdx, load, deload, days: planDays });
  }

  return {
    generator: GENERATOR_VERSION,
    createdAt: new Date().toISOString(),
    weekOneMonday: monday,
    startDate: p.startDate,
    title: titleFor(p, weeks),
    summary: summaryFor(p, days),
    phases,
    weeks: out,
    rules: rulesFor(p),
  };
}

export function dateOf(plan: Plan, week: number, day: number): string {
  return addDays(plan.weekOneMonday, (week - 1) * 7 + day);
}
