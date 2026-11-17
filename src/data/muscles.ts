import type { BodyMuscle } from './bodyMap';
import type { Exercise, Muscle, Pattern } from '../engine/types';

/* Which muscles each exercise works, for the body diagram on the exercise sheet. */

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest', 'front-delts': 'Front shoulders', 'side-delts': 'Side shoulders', 'rear-delts': 'Rear shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', traps: 'Traps',
  lats: 'Lats', 'upper-back': 'Upper back', 'lower-back': 'Lower back', glutes: 'Glutes', quads: 'Quads',
  hamstrings: 'Hamstrings', adductors: 'Inner thighs', abductors: 'Outer hips', 'hip-flexors': 'Hip flexors',
  calves: 'Calves', shins: 'Shins', neck: 'Neck',
};

/** Polygons on the body diagram that light up for each muscle. */
export const MUSCLE_PARTS: Record<Muscle, BodyMuscle[]> = {
  chest: ['chest'], 'front-delts': ['front-deltoids'], 'side-delts': ['front-deltoids', 'back-deltoids'], 'rear-delts': ['back-deltoids'],
  biceps: ['biceps'], triceps: ['triceps'], forearms: ['forearm'], abs: ['abs'], obliques: ['obliques'], traps: ['trapezius'],
  lats: ['upper-back'], 'upper-back': ['upper-back', 'trapezius'], 'lower-back': ['lower-back'], glutes: ['gluteal'],
  quads: ['quadriceps'], hamstrings: ['hamstring'], adductors: ['abductors', 'adductor'], abductors: ['gluteal'],
  'hip-flexors': ['quadriceps'], calves: ['calves', 'left-soleus', 'right-soleus'], shins: ['calves'], neck: ['neck', 'trapezius'],
};

type M = { p: Muscle[]; s?: Muscle[] };

const BY_PATTERN: Record<Pattern, M> = {
  squat: { p: ['quads', 'glutes'], s: ['adductors', 'lower-back'] },
  hinge: { p: ['hamstrings', 'glutes'], s: ['lower-back', 'forearms'] },
  lunge: { p: ['quads', 'glutes'], s: ['adductors', 'hamstrings'] },
  'sl-hinge': { p: ['hamstrings', 'glutes'], s: ['lower-back', 'abductors'] },
  hpush: { p: ['chest'], s: ['front-delts', 'triceps'] },
  vpush: { p: ['front-delts', 'side-delts'], s: ['triceps', 'traps'] },
  hpull: { p: ['upper-back', 'lats'], s: ['rear-delts', 'biceps'] },
  vpull: { p: ['lats'], s: ['biceps', 'upper-back', 'forearms'] },
  'core-antiext': { p: ['abs'], s: ['obliques'] },
  'core-antirot': { p: ['obliques', 'abs'] },
  'core-lateral': { p: ['obliques'], s: ['abs', 'abductors'] },
  'core-flex': { p: ['abs'], s: ['obliques'] },
  carry: { p: ['forearms', 'traps'], s: ['obliques', 'abs'] },
  calf: { p: ['calves'] },
  tib: { p: ['shins'] },
  'ham-curl': { p: ['hamstrings'], s: ['calves'] },
  adductor: { p: ['adductors'] },
  abductor: { p: ['abductors'], s: ['glutes'] },
  glute: { p: ['glutes'], s: ['hamstrings'] },
  quad: { p: ['quads'] },
  biceps: { p: ['biceps'], s: ['forearms'] },
  triceps: { p: ['triceps'] },
  delt: { p: ['side-delts'] },
  cuff: { p: ['rear-delts'], s: ['upper-back'] },
  grip: { p: ['forearms'] },
  neck: { p: ['neck'] },
  'plyo-v': { p: ['quads', 'calves'], s: ['glutes'] },
  'plyo-h': { p: ['glutes', 'hamstrings'], s: ['quads', 'calves'] },
  'plyo-l': { p: ['glutes', 'quads'], s: ['adductors', 'calves'] },
  'plyo-upper': { p: ['chest', 'front-delts'], s: ['triceps', 'abs'] },
  rotational: { p: ['obliques'], s: ['abs', 'front-delts'] },
  sprint: { p: ['hamstrings', 'glutes'], s: ['quads', 'calves'] },
  agility: { p: ['quads', 'calves'], s: ['glutes', 'adductors'] },
  'cond-aero': { p: ['quads', 'calves'], s: ['hamstrings', 'glutes'] },
  'cond-int': { p: ['quads', 'glutes'], s: ['hamstrings', 'calves'] },
  mobility: { p: ['hamstrings'] },
  balance: { p: ['calves', 'glutes'], s: ['shins', 'quads'] },
  rehab: { p: ['quads'] },
};

const MOBILITY_BY_AREA: Record<Exercise['area'], M> = {
  ankle: { p: ['calves'], s: ['shins'] }, knee: { p: ['hamstrings'], s: ['quads'] }, hip: { p: ['glutes', 'adductors'], s: ['hip-flexors'] },
  back: { p: ['lower-back', 'obliques'], s: ['upper-back'] }, shoulder: { p: ['rear-delts', 'front-delts'], s: ['upper-back'] },
  elbow: { p: ['forearms'] }, core: { p: ['abs'] }, upper: { p: ['upper-back'] }, lower: { p: ['hamstrings'] }, full: { p: ['hamstrings', 'upper-back'], s: ['calves'] },
};

/* Existing exercises whose muscles differ from their pattern's defaults. */
const OVERRIDES: Record<string, M> = {
  'wall-sit': { p: ['quads'], s: ['glutes'] },
  'leg-press': { p: ['quads', 'glutes'], s: ['adductors'] },
  'kb-swing': { p: ['glutes', 'hamstrings'], s: ['lower-back', 'forearms'] },
  'back-extension': { p: ['lower-back', 'glutes'], s: ['hamstrings'] },
  'lateral-lunge': { p: ['adductors', 'glutes'], s: ['quads'] },
  cossack: { p: ['adductors', 'quads'], s: ['glutes'] },
  'step-up': { p: ['quads', 'glutes'], s: ['calves'] },
  'incline-db-press': { p: ['chest', 'front-delts'], s: ['triceps'] },
  dips: { p: ['chest', 'triceps'], s: ['front-delts'] },
  'cable-fly': { p: ['chest'], s: ['front-delts'] },
  'landmine-press': { p: ['front-delts', 'chest'], s: ['triceps', 'obliques'] },
  'pike-push-up': { p: ['front-delts'], s: ['triceps', 'chest'] },
  'pull-up': { p: ['lats'], s: ['biceps', 'upper-back', 'forearms'] },
  'floor-pulldown': { p: ['lats'], s: ['rear-delts'] },
  'bird-dog': { p: ['lower-back', 'glutes'], s: ['abs'] },
  'suitcase-carry': { p: ['obliques', 'forearms'], s: ['traps'] },
  'hanging-leg-raise': { p: ['abs', 'hip-flexors'], s: ['forearms', 'obliques'] },
  'mcgill-curl-up': { p: ['abs'] },
  'soleus-raise': { p: ['calves'] },
  'band-eversion': { p: ['shins', 'calves'] },
  'short-foot': { p: ['shins'] },
  nordic: { p: ['hamstrings'], s: ['glutes'] },
  'ham-bridge-iso': { p: ['hamstrings', 'glutes'] },
  copenhagen: { p: ['adductors'], s: ['obliques'] },
  'spanish-squat': { p: ['quads'] },
  'reverse-nordic': { p: ['quads'], s: ['hip-flexors'] },
  'quad-set': { p: ['quads'], s: ['hip-flexors'] },
  'hammer-curl': { p: ['biceps', 'forearms'] },
  'close-push-up': { p: ['triceps', 'chest'], s: ['front-delts'] },
  'rear-delt-fly': { p: ['rear-delts'], s: ['upper-back'] },
  'prone-ytw': { p: ['rear-delts', 'upper-back'], s: ['traps'] },
  'face-pull': { p: ['rear-delts', 'upper-back'], s: ['traps'] },
  'band-pull-apart': { p: ['rear-delts', 'upper-back'] },
  'scap-push-up': { p: ['chest', 'front-delts'], s: ['upper-back'] },
  'wall-slide': { p: ['traps', 'front-delts'], s: ['upper-back'] },
  'dead-hang': { p: ['forearms', 'lats'] },
  'neck-iso': { p: ['neck'] },
  pogo: { p: ['calves'], s: ['shins'] },
  'jump-rope': { p: ['calves'], s: ['shins', 'quads'] },
  'mb-slam': { p: ['lats', 'abs'], s: ['triceps', 'front-delts'] },
  'mb-rot-throw': { p: ['obliques'], s: ['abs', 'glutes'] },
  'sled-push': { p: ['quads', 'glutes'], s: ['calves', 'front-delts'] },
  'zone2-low': { p: ['quads'], s: ['hamstrings', 'glutes'] },
  'bike-intervals': { p: ['quads'], s: ['glutes', 'hamstrings'] },
  'easy-walk': { p: ['calves', 'glutes'] },
  'couch-stretch': { p: ['hip-flexors', 'quads'] },
  'adductor-rock': { p: ['adductors'] },
  'deep-squat-hold': { p: ['glutes', 'adductors'], s: ['calves'] },
  'cat-camel': { p: ['lower-back'], s: ['abs'] },
  'open-book': { p: ['obliques', 'upper-back'] },
  'thread-needle': { p: ['upper-back', 'rear-delts'] },
  'calf-stretch': { p: ['calves'] },
  'plantar-stretch': { p: ['calves'] },
  'leg-swings': { p: ['hip-flexors', 'hamstrings'], s: ['adductors'] },
  'hamstring-floss': { p: ['hamstrings'] },
  inchworm: { p: ['hamstrings', 'abs'], s: ['front-delts'] },
  'hip-flexor-march': { p: ['hip-flexors'] },
  'hip-flexor-iso': { p: ['hip-flexors'] },
  'isometric-abduction': { p: ['abductors'], s: ['glutes'] },
};

export function musclesFor(ex: Exercise): { p: Muscle[]; s: Muscle[] } {
  const m = ex.muscles ?? OVERRIDES[ex.id] ?? (ex.pattern === 'mobility' || ex.pattern === 'rehab' ? MOBILITY_BY_AREA[ex.area] : BY_PATTERN[ex.pattern]);
  return { p: m.p, s: (m.s ?? []).filter(x => !m.p.includes(x)) };
}
