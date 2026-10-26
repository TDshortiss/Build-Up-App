/* Shared types for the content library, the plan generator and saved user state. */

export type Goal = 'rehab' | 'offseason' | 'inseason' | 'general';
export type GeneralFocus = 'muscle' | 'strength' | 'fitness';
export type Equipment = 'bodyweight' | 'home' | 'gym';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type AgeGroup = 'teen' | 'adult' | 'masters';
export type Units = 'lb' | 'kg';

/** 0 = bodyweight only, 1 = home (dumbbells, bands, bench), 2 = full gym. */
export type Tier = 0 | 1 | 2;
export const TIER: Record<Equipment, Tier> = { bodyweight: 0, home: 1, gym: 2 };

export type Pattern =
  | 'squat' | 'hinge' | 'lunge' | 'sl-hinge'
  | 'hpush' | 'vpush' | 'hpull' | 'vpull'
  | 'core-antiext' | 'core-antirot' | 'core-lateral' | 'core-flex' | 'carry'
  | 'calf' | 'tib' | 'ham-curl' | 'adductor' | 'abductor' | 'glute' | 'quad'
  | 'biceps' | 'triceps' | 'delt' | 'cuff' | 'grip' | 'neck'
  | 'plyo-v' | 'plyo-h' | 'plyo-l' | 'plyo-upper' | 'rotational'
  | 'sprint' | 'agility' | 'cond-aero' | 'cond-int'
  | 'mobility' | 'balance' | 'rehab';

export type Area = 'ankle' | 'knee' | 'hip' | 'back' | 'shoulder' | 'elbow' | 'core' | 'upper' | 'lower' | 'full';

/**
 * Stress tags. Injuries list the tags to avoid at each rehab stage, and the
 * resolver swaps out any exercise that carries one.
 */
export type Tag =
  | 'impact' | 'plyo' | 'plyo-high' | 'sprint' | 'cutting' | 'calf-explosive'
  | 'spinal-load' | 'spinal-flexion' | 'knee-deep' | 'knee-load'
  | 'hamstring-load' | 'adductor-load' | 'hip-flexor-load'
  | 'overhead' | 'shoulder-load' | 'wrist-load' | 'grip-heavy' | 'elbow-load'
  | 'rotation-load' | 'achilles-load';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  area: Area;
  tier: Tier;
  /** 1 easy to learn, 3 needs good technique and a training base. */
  level: 1 | 2 | 3;
  tags: Tag[];
  /** Track a working weight for this exercise. */
  loaded?: boolean;
  /** Dose is in seconds rather than reps. */
  timed?: boolean;
  unilateral?: boolean;
  cue: string;
  why: string;
}

export type SportId =
  | 'american-football' | 'basketball' | 'baseball' | 'softball' | 'soccer'
  | 'ice-hockey' | 'volleyball' | 'lacrosse' | 'racquet' | 'golf'
  | 'running' | 'swimming' | 'wrestling' | 'ski-snowboard' | 'cycling'
  | 'combat' | 'track-sprint';

export type EnergySystem = 'aerobic' | 'repeat-sprint' | 'alactic' | 'mixed';

export interface Sport {
  id: SportId;
  name: string;
  blurb: string;
  /** Qualities the plan emphasizes, shown to the user. */
  qualities: string[];
  /** Plyometric patterns in priority order. Empty for sports where jumping adds little. */
  power: Pattern[];
  rotational: boolean;
  upper: 'push' | 'pull' | 'balanced' | 'shoulder-care';
  energy: EnergySystem;
  /** Does the sport itself involve running and landing? Drives conditioning choice. */
  runs: boolean;
  /** Exercises that protect against this sport's common injuries. */
  prehab: string[];
  /** Exercises to prefer when filling a pattern slot. */
  prefer: string[];
  injuries: InjuryId[];
  conditioningNote: string;
  inSeasonNote: string;
}

export type InjuryId =
  | 'shin-splints' | 'ankle-sprain' | 'achilles' | 'plantar-fasciitis'
  | 'patellofemoral' | 'patellar-tendon' | 'it-band' | 'mcl-sprain'
  | 'hamstring-strain' | 'groin-strain' | 'hip-flexor' | 'low-back'
  | 'shoulder' | 'tennis-elbow' | 'medial-elbow' | 'wrist-sprain';

export interface Dose {
  ex: string;
  sets: number;
  reps: string;
  note?: string;
}

export interface ProgressCheck {
  id: string;
  label: string;
  how: string;
}

export interface RehabStage {
  name: string;
  goal: string;
  /** Minimum days at this stage before the progress check unlocks. */
  minDays: number;
  work: Dose[];
  avoid: Tag[];
  conditioning: string;
  /** Checks that must all pass to move to the next stage. Empty on the last stage. */
  checks: ProgressCheck[];
}

export interface Injury {
  id: InjuryId;
  name: string;
  aka: string;
  area: Area;
  summary: string;
  redFlags: string[];
  /** What pain is acceptable for this injury, in plain words. */
  painNote: string;
  stages: [RehabStage, RehabStage, RehabStage, RehabStage];
}

/* ---------- Onboarding profile ---------- */

export interface InjuryEntry {
  id: InjuryId;
  /** Current pain on a normal day, 0-10. */
  pain: number;
  /** Rehab stage to start at (0-based), from how far along the user says they are. */
  startStage: number;
  /** User reported a red flag: we keep the area protected and don't run the rehab protocol. */
  protectOnly: boolean;
}

export interface Profile {
  name: string;
  goal: Goal;
  sport: SportId | null;
  generalFocus: GeneralFocus;
  injuries: InjuryEntry[];
  experience: Experience;
  ageGroup: AgeGroup;
  equipment: Equipment;
  /** Weekdays to train, 0 = Monday … 6 = Sunday. */
  trainingDays: number[];
  /** In-season game days, 0 = Monday. */
  gameDays: number[];
  sessionMinutes: 30 | 45 | 60 | 75 | 90;
  /** ISO date the plan starts. */
  startDate: string;
  /** Off-season: first game / season start. In-season: season end. Optional. */
  targetDate: string | null;
  /** Plan length when there is no target date. */
  weeks: number;
  units: Units;
}

/* ---------- Generated plan ---------- */

export type SlotRole =
  | 'warmup' | 'power' | 'speed' | 'main' | 'secondary' | 'accessory'
  | 'prehab' | 'core' | 'conditioning' | 'mobility';

export type PhaseKind =
  | 'foundation' | 'strength' | 'power' | 'peak'
  | 'inseason' | 'hypertrophy' | 'max-strength' | 'fitness'
  | 'rehab-calm' | 'rehab-build' | 'rehab-strength' | 'rehab-return';

export interface Phase {
  kind: PhaseKind;
  name: string;
  start: number;
  end: number;
  goal: string;
  notes: string[];
}

export interface PlanItem {
  ex: string;
  sets: number;
  reps: string;
  rest?: string;
  effort?: string;
  role: SlotRole;
}

export interface PlanBlock {
  title: string;
  note?: string;
  items: PlanItem[];
  /** A rehab block is filled at view time from the injury's current stage. */
  rehab?: InjuryId;
}

export type DayKind = 'train' | 'rehab' | 'recovery' | 'rest' | 'game';

export interface PlanDay {
  kind: DayKind;
  title: string;
  focus: string;
  minutes: number;
  /** 1 easy, 2 moderate, 3 hard. Shown as green circle, blue square, black diamond. */
  effort: 1 | 2 | 3;
  blocks: PlanBlock[];
}

export interface PlanWeek {
  n: number;
  phase: number;
  /** Relative load 1-10, drives the load chart. */
  load: number;
  deload: boolean;
  days: PlanDay[];
}

export interface Plan {
  generator: number;
  createdAt: string;
  /** Monday of week 1. */
  weekOneMonday: string;
  startDate: string;
  title: string;
  summary: string;
  phases: Phase[];
  weeks: PlanWeek[];
  rules: { title: string; body: string }[];
}

/* ---------- Saved user state ---------- */

export interface DayLog {
  done: Record<string, boolean>;
  weights: Record<string, number>;
  pain: Partial<Record<InjuryId, number>>;
  rpe?: number;
  note?: string;
  completedAt?: string;
  updatedAt: number;
}

export interface RehabCheckResult {
  date: string;
  stage: number;
  results: Record<string, boolean>;
  passed: boolean;
}

export interface RehabState {
  stage: number;
  stageStartedAt: string;
  checks: RehabCheckResult[];
  /** Set when the user confirms a professional cleared the red flag. */
  cleared?: boolean;
}

export interface AppState {
  ver: number;
  updatedAt: number;
  profile: Profile | null;
  plan: Plan | null;
  logs: Record<string, DayLog>;
  rehab: Partial<Record<InjuryId, RehabState>>;
  /** Exercise swaps the user picked: from id → to id, applied everywhere. */
  swaps: Record<string, string>;
  /** Last weight used per exercise, carried forward. */
  lastWeight: Record<string, number>;
  acceptedTermsAt: string | null;
}
