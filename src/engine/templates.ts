import type { Pattern, SlotRole, Sport } from './types';

/*
 * Session templates. A slot lists patterns in order of preference; the generator fills it with the
 * best exercise the user's equipment allows. Special pattern tokens resolve per sport:
 *   'P0' 'P1' 'P2'  the sport's plyometric patterns in priority order
 *   'UP'            upper-body power: rotational throws for rotational sports, else med ball / plyo push-up
 *   'SPEED'         sprints for running sports, agility otherwise
 *   'COND'          conditioning for the sport's energy system
 *   'PREHAB'        next exercise from the sport's prehab list
 */
export type Token = Pattern | 'P0' | 'P1' | 'P2' | 'UP' | 'SPEED' | 'COND' | 'PREHAB';

export interface Slot {
  role: SlotRole;
  patterns: Token[];
}

export type Warmup = 'lower' | 'upper' | 'full';

export interface DayTemplate {
  key: string;
  title: string;
  focus: string;
  warmup: Warmup;
  slots: Slot[];
  /** A recovery-only day: mobility and easy cardio. */
  recovery?: boolean;
  /** Roles never trimmed to fit the time budget. */
  keep?: SlotRole[];
}

const s = (role: SlotRole, ...patterns: Token[]): Slot => ({ role, patterns });

export const WARMUPS: Record<Warmup, string[]> = {
  lower: ['worlds-greatest', 'knee-to-wall', 'hip-cars', 'leg-swings', '9090', 'ankle-cars'],
  upper: ['open-book', 'wall-slide', 'band-pull-apart', 'thread-needle', 'scap-push-up', 'band-dislocate'],
  full: ['inchworm', 'worlds-greatest', 'open-book', 'leg-swings', 'hip-cars'],
};

/* ---------- Sport: off-season ---------- */

const LOWER_A: DayTemplate = {
  key: 'lower-a', title: 'Lower: Strength', focus: 'Heavy squat pattern, hamstrings and single-leg strength.', warmup: 'lower',
  slots: [s('power', 'P0'), s('main', 'squat'), s('secondary', 'sl-hinge', 'hinge'), s('accessory', 'lunge'),
    s('prehab', 'PREHAB'), s('accessory', 'ham-curl'), s('core', 'core-antirot'), s('conditioning', 'COND')],
};
const UPPER_A: DayTemplate = {
  key: 'upper-a', title: 'Upper: Strength', focus: 'Press and row heavy, then shoulder care.', warmup: 'upper',
  slots: [s('power', 'UP'), s('main', 'hpush'), s('secondary', 'hpull'), s('accessory', 'vpull', 'hpull'),
    s('accessory', 'vpush', 'delt'), s('prehab', 'cuff'), s('core', 'core-antiext')],
};
const LOWER_B: DayTemplate = {
  key: 'lower-b', title: 'Lower: Power', focus: 'Speed and jumps first, then hinge and single-leg work.', warmup: 'lower',
  slots: [s('speed', 'SPEED'), s('power', 'P1'), s('main', 'hinge'), s('secondary', 'lunge'),
    s('accessory', 'adductor', 'abductor'), s('prehab', 'PREHAB'), s('accessory', 'calf'), s('core', 'core-lateral')],
};
const UPPER_B: DayTemplate = {
  key: 'upper-b', title: 'Upper: Power', focus: 'Explosive throws, pulling strength and arms.', warmup: 'upper',
  slots: [s('power', 'UP'), s('main', 'vpull', 'hpull'), s('secondary', 'vpush', 'hpush'), s('accessory', 'hpull'),
    s('accessory', 'biceps'), s('accessory', 'triceps'), s('prehab', 'PREHAB'), s('core', 'carry', 'core-antirot')],
};
const FULL_A: DayTemplate = {
  key: 'full-a', title: 'Full Body A', focus: 'Squat, press and row with a jump to start.', warmup: 'full',
  slots: [s('power', 'P0'), s('main', 'squat'), s('secondary', 'hpush'), s('accessory', 'hpull'),
    s('prehab', 'PREHAB'), s('accessory', 'ham-curl'), s('core', 'core-antirot'), s('conditioning', 'COND')],
};
const FULL_B: DayTemplate = {
  key: 'full-b', title: 'Full Body B', focus: 'Hinge, pull and single-leg strength.', warmup: 'full',
  slots: [s('power', 'P1'), s('main', 'hinge'), s('secondary', 'vpull', 'hpull'), s('accessory', 'lunge'),
    s('accessory', 'vpush', 'delt'), s('prehab', 'PREHAB'), s('core', 'core-lateral')],
};
const FULL_C: DayTemplate = {
  key: 'full-c', title: 'Full Body C', focus: 'Speed, single-leg strength and conditioning.', warmup: 'full',
  slots: [s('speed', 'SPEED'), s('power', 'P2', 'UP'), s('main', 'lunge'), s('secondary', 'hpush'),
    s('accessory', 'hpull'), s('accessory', 'calf'), s('core', 'core-antiext'), s('conditioning', 'COND')],
};
const COND_DAY: DayTemplate = {
  key: 'cond', title: 'Speed & Conditioning', focus: 'Sport-specific fitness, footwork and trunk.', warmup: 'full', keep: ['conditioning'],
  slots: [s('speed', 'SPEED'), s('power', 'P2', 'P0'), s('conditioning', 'COND'), s('prehab', 'PREHAB'),
    s('core', 'core-antirot'), s('core', 'core-flex')],
};
export const RECOVERY_DAY: DayTemplate = {
  key: 'recovery', title: 'Mobility & Recovery', focus: 'Easy movement to recover and keep range.', warmup: 'full', recovery: true,
  keep: ['mobility', 'conditioning'],
  slots: [s('mobility', 'mobility'), s('mobility', 'mobility'), s('mobility', 'mobility'), s('mobility', 'mobility'),
    s('conditioning', 'cond-aero')],
};

/* ---------- Sport: in-season ---------- */

const IN_A: DayTemplate = {
  key: 'in-a', title: 'In-Season A', focus: 'Keep strength and power with low volume. You should leave fresher than you came in.', warmup: 'full',
  slots: [s('power', 'P0'), s('main', 'hinge', 'squat'), s('secondary', 'hpush'), s('accessory', 'hpull'),
    s('prehab', 'PREHAB'), s('prehab', 'PREHAB'), s('core', 'core-antirot')],
};
const IN_B: DayTemplate = {
  key: 'in-b', title: 'In-Season B', focus: 'Single-leg strength, pulling and injury prevention.', warmup: 'full',
  slots: [s('power', 'UP'), s('main', 'lunge'), s('secondary', 'vpull', 'hpull'), s('accessory', 'ham-curl'),
    s('prehab', 'PREHAB'), s('core', 'core-lateral')],
};

/* ---------- General ---------- */

const G_FULL_A: DayTemplate = {
  key: 'g-full-a', title: 'Full Body A', focus: 'Squat, press and row.', warmup: 'full',
  slots: [s('main', 'squat'), s('secondary', 'hpush'), s('secondary', 'hpull'), s('accessory', 'ham-curl'),
    s('accessory', 'delt'), s('accessory', 'biceps'), s('core', 'core-antiext')],
};
const G_FULL_B: DayTemplate = {
  key: 'g-full-b', title: 'Full Body B', focus: 'Hinge, overhead press and pull-down.', warmup: 'full',
  slots: [s('main', 'hinge'), s('secondary', 'vpush', 'hpush'), s('secondary', 'vpull', 'hpull'), s('accessory', 'lunge'),
    s('accessory', 'triceps'), s('accessory', 'calf'), s('core', 'core-lateral')],
};
const G_FULL_C: DayTemplate = {
  key: 'g-full-c', title: 'Full Body C', focus: 'Single-leg legs, incline press and rows.', warmup: 'full',
  slots: [s('main', 'lunge'), s('secondary', 'hpush'), s('secondary', 'hpull'), s('accessory', 'glute'),
    s('accessory', 'cuff', 'delt'), s('accessory', 'biceps'), s('core', 'core-flex')],
};
const G_UPPER_A: DayTemplate = {
  key: 'g-upper-a', title: 'Upper A', focus: 'Chest and back, then shoulders and arms.', warmup: 'upper',
  slots: [s('main', 'hpush'), s('secondary', 'hpull'), s('accessory', 'vpush', 'hpush'), s('accessory', 'vpull', 'hpull'),
    s('accessory', 'delt'), s('accessory', 'biceps'), s('accessory', 'triceps')],
};
const G_LOWER_A: DayTemplate = {
  key: 'g-lower-a', title: 'Lower A', focus: 'Squat-focused legs.', warmup: 'lower',
  slots: [s('main', 'squat'), s('secondary', 'sl-hinge', 'hinge'), s('accessory', 'lunge'), s('accessory', 'ham-curl'),
    s('accessory', 'calf'), s('core', 'core-antiext')],
};
const G_UPPER_B: DayTemplate = {
  key: 'g-upper-b', title: 'Upper B', focus: 'Back and shoulders, then chest and arms.', warmup: 'upper',
  slots: [s('main', 'vpull', 'hpull'), s('secondary', 'vpush', 'hpush'), s('accessory', 'hpush'), s('accessory', 'hpull'),
    s('accessory', 'cuff', 'delt'), s('accessory', 'triceps'), s('accessory', 'biceps')],
};
const G_LOWER_B: DayTemplate = {
  key: 'g-lower-b', title: 'Lower B', focus: 'Hinge-focused legs and glutes.', warmup: 'lower',
  slots: [s('main', 'hinge'), s('secondary', 'lunge'), s('accessory', 'quad', 'squat'), s('accessory', 'glute'),
    s('accessory', 'adductor', 'abductor'), s('core', 'core-flex')],
};
const G_PUSH: DayTemplate = {
  key: 'g-push', title: 'Push', focus: 'Chest, shoulders and triceps.', warmup: 'upper',
  slots: [s('main', 'hpush'), s('secondary', 'vpush', 'hpush'), s('accessory', 'hpush'), s('accessory', 'delt'),
    s('accessory', 'triceps'), s('accessory', 'triceps'), s('core', 'core-antiext')],
};
const G_PULL: DayTemplate = {
  key: 'g-pull', title: 'Pull', focus: 'Back, rear shoulders and biceps.', warmup: 'upper',
  slots: [s('main', 'vpull', 'hpull'), s('secondary', 'hpull'), s('accessory', 'hpull', 'vpull'), s('accessory', 'cuff', 'delt'),
    s('accessory', 'biceps'), s('accessory', 'biceps'), s('accessory', 'grip', 'carry')],
};
const G_LEGS: DayTemplate = {
  key: 'g-legs', title: 'Legs', focus: 'Quads, hamstrings, glutes and calves.', warmup: 'lower',
  slots: [s('main', 'squat'), s('secondary', 'hinge'), s('accessory', 'lunge'), s('accessory', 'quad'),
    s('accessory', 'ham-curl'), s('accessory', 'calf'), s('core', 'core-flex')],
};
const G_FIT_A: DayTemplate = {
  key: 'g-fit-a', title: 'Strength Circuit', focus: 'Full-body strength with short rests to keep your heart rate up.', warmup: 'full',
  slots: [s('main', 'squat'), s('secondary', 'hpush'), s('secondary', 'hpull'), s('accessory', 'hinge', 'sl-hinge'),
    s('accessory', 'lunge'), s('core', 'core-antiext'), s('conditioning', 'cond-int')],
};
const G_FIT_B: DayTemplate = {
  key: 'g-fit-b', title: 'Strength Circuit B', focus: 'Hinge, pull, carry and intervals.', warmup: 'full',
  slots: [s('main', 'hinge'), s('secondary', 'vpull', 'hpull'), s('secondary', 'vpush', 'hpush'), s('accessory', 'lunge'),
    s('accessory', 'carry'), s('core', 'core-lateral'), s('conditioning', 'cond-int')],
};
const G_FIT_COND: DayTemplate = {
  key: 'g-fit-cond', title: 'Cardio & Core', focus: 'Steady cardio to build your engine, then core.', warmup: 'full', keep: ['conditioning'],
  slots: [s('conditioning', 'cond-aero'), s('core', 'core-antirot'), s('core', 'core-flex'), s('mobility', 'mobility')],
};

/* ---------- Rehab-first ---------- */

const R_A: DayTemplate = {
  key: 'r-a', title: 'Rehab + Train Around It', focus: 'Rehab first, then keep the rest of your body strong.', warmup: 'full',
  slots: [s('power', 'P0'), s('main', 'squat', 'lunge'), s('secondary', 'hpush'), s('accessory', 'hpull'),
    s('core', 'core-antirot'), s('conditioning', 'cond-aero')],
};
const R_B: DayTemplate = {
  key: 'r-b', title: 'Rehab + Train Around It B', focus: 'Rehab first, then hinge and pulling strength.', warmup: 'full',
  slots: [s('power', 'UP'), s('main', 'hinge', 'sl-hinge'), s('secondary', 'vpull', 'hpull'), s('accessory', 'vpush', 'delt'),
    s('core', 'core-lateral'), s('conditioning', 'cond-int')],
};

export function sportTemplates(days: number): DayTemplate[] {
  switch (Math.min(Math.max(days, 1), 6)) {
    case 1: return [FULL_A];
    case 2: return [FULL_A, FULL_B];
    case 3: return [FULL_A, FULL_B, FULL_C];
    case 4: return [LOWER_A, UPPER_A, LOWER_B, UPPER_B];
    case 5: return [LOWER_A, UPPER_A, COND_DAY, LOWER_B, UPPER_B];
    default: return [LOWER_A, UPPER_A, COND_DAY, LOWER_B, UPPER_B, RECOVERY_DAY];
  }
}

export function inSeasonTemplates(days: number): DayTemplate[] {
  if (days <= 1) return [{ ...IN_A, title: 'In-Season Full Body' }];
  if (days === 2) return [IN_A, IN_B];
  return [IN_A, IN_B, RECOVERY_DAY];
}

export function generalTemplates(days: number, focus: 'muscle' | 'strength' | 'fitness'): DayTemplate[] {
  const n = Math.min(Math.max(days, 1), 6);
  if (focus === 'fitness') {
    return [[G_FIT_A], [G_FIT_A, G_FIT_B], [G_FIT_A, G_FIT_COND, G_FIT_B], [G_FIT_A, G_FIT_COND, G_FIT_B, G_FIT_COND],
      [G_FIT_A, G_FIT_COND, G_FIT_B, G_FIT_COND, G_FIT_A], [G_FIT_A, G_FIT_COND, G_FIT_B, G_FIT_COND, G_FIT_A, RECOVERY_DAY]][n - 1];
  }
  return [[G_FULL_A], [G_FULL_A, G_FULL_B], [G_FULL_A, G_FULL_B, G_FULL_C], [G_UPPER_A, G_LOWER_A, G_UPPER_B, G_LOWER_B],
    [G_PUSH, G_PULL, G_LEGS, G_UPPER_A, G_LOWER_B], [G_PUSH, G_PULL, G_LEGS, G_UPPER_B, G_LOWER_B, G_LEGS]][n - 1]
    .map((t, i, arr) => (arr.indexOf(t) !== i ? { ...t, key: `${t.key}-2`, title: `${t.title} 2` } : t));
}

export function rehabTemplates(days: number): DayTemplate[] {
  const n = Math.min(Math.max(days, 1), 6);
  return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? R_A : R_B));
}

/** Upper-body power pattern for a sport. */
export function upperPower(sport: Sport | null): Pattern {
  return sport?.rotational ? 'rotational' : 'plyo-upper';
}
