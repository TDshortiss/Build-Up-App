import type { Equipment, WorkoutItem } from '../engine/types';

/* Ready-made workouts for people who skip the screening, grouped by the equipment they have. */

export interface Starter { key: string; name: string; blurb: string; items: WorkoutItem[] }

const i = (ex: string, sets: number, reps: string): WorkoutItem => ({ ex, sets, reps });

export const STARTERS: Record<Equipment, Starter[]> = {
  gym: [
    { key: 'push', name: 'Push Day', blurb: 'Chest, shoulders and triceps', items: [
      i('bench-press', 4, '6–8'), i('incline-db-press', 3, '8–10'), i('db-shoulder-press', 3, '8–10'), i('lateral-raise', 3, '12–15'), i('rope-pushdown', 3, '10–12'), i('pec-deck', 2, '12–15')] },
    { key: 'pull', name: 'Pull Day', blurb: 'Back and biceps', items: [
      i('lat-pulldown', 4, '8–10'), i('barbell-row', 3, '6–8'), i('cable-row', 3, '10–12'), i('face-pull', 3, '12–15'), i('barbell-curl', 3, '8–10'), i('hammer-curl', 2, '10–12')] },
    { key: 'legs', name: 'Leg Day', blurb: 'Quads, hamstrings, glutes and calves', items: [
      i('back-squat', 4, '5–8'), i('rdl', 3, '8'), i('leg-press', 3, '10–12'), i('lying-leg-curl', 3, '10–12'), i('leg-extension', 2, '12–15'), i('standing-calf-raise', 3, '10–12')] },
    { key: 'upper', name: 'Upper Body', blurb: 'Everything above the waist', items: [
      i('incline-bench', 3, '6–8'), i('chin-up', 3, '6–10'), i('machine-shoulder-press', 3, '8–10'), i('machine-row', 3, '10–12'), i('ez-curl', 2, '10–12'), i('skull-crusher', 2, '10–12')] },
    { key: 'full', name: 'Full Body', blurb: 'One session that hits everything', items: [
      i('trap-bar-deadlift', 3, '5'), i('db-bench', 3, '8–10'), i('lat-pulldown', 3, '10'), i('rfess', 2, '8 each'), i('cable-crunch', 3, '12'), i('farmer-carry', 3, '30 m')] },
  ],
  home: [
    { key: 'full-a', name: 'Full Body A', blurb: 'Dumbbells, every major muscle', items: [
      i('goblet-squat', 4, '8–12'), i('db-bench', 3, '8–12'), i('db-row', 3, '10 each'), i('db-rdl', 3, '10'), i('db-shoulder-press', 2, '10–12'), i('plank', 3, '40 s')] },
    { key: 'upper', name: 'Upper Body', blurb: 'Chest, back, shoulders and arms', items: [
      i('db-bench', 4, '8–12'), i('db-row', 4, '10 each'), i('arnold-press', 3, '10'), i('lateral-raise', 3, '15'), i('db-curl', 3, '12'), i('db-overhead-ext', 3, '12')] },
    { key: 'lower', name: 'Lower Body', blurb: 'Legs and glutes', items: [
      i('goblet-squat', 4, '10'), i('rfess', 3, '8 each'), i('db-rdl', 3, '10'), i('db-hip-thrust', 3, '12'), i('db-calf-raise', 3, '12 each'), i('side-plank', 2, '30 s each')] },
  ],
  bodyweight: [
    { key: 'full', name: 'Full Body', blurb: 'No equipment needed', items: [
      i('tempo-squat', 3, '12'), i('push-up', 3, 'Max − 2'), i('towel-row', 3, '12'), i('split-squat', 3, '10 each'), i('glute-bridge', 3, '15'), i('plank', 3, '40 s')] },
    { key: 'upper', name: 'Upper Body', blurb: 'Push-ups, rows and dips', items: [
      i('push-up', 4, 'Max − 2'), i('towel-row', 4, '12'), i('pike-push-up', 3, '8'), i('close-push-up', 3, '10'), i('bench-dip', 3, '12'), i('dead-bug', 3, '8 each')] },
    { key: 'lower', name: 'Legs & Core', blurb: 'Single-leg strength and abs', items: [
      i('rfess-bw', 3, '10 each'), i('sl-rdl', 3, '10 each'), i('sl-glute-bridge', 3, '12 each'), i('sl-calf-raise', 3, '15 each'), i('side-plank', 2, '30 s each'), i('crunch', 3, '15')] },
  ],
};
