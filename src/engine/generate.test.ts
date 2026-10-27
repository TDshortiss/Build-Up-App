import { describe, expect, it } from 'vitest';
import { EX, EXERCISES } from '../data/exercises';
import { INJURIES, INJURY } from '../data/injuries';
import { SPORTS } from '../data/sports';
import { generatePlan, planWeeks, scheduleDays } from './generate';
import { avoidMap, rehabItems, resolveItems } from './resolve';
import { TIER, type Equipment, type Goal, type InjuryId, type Profile, type SportId } from './types';

function profile(over: Partial<Profile> = {}): Profile {
  return {
    name: 'Test', goal: 'offseason', sport: 'soccer', generalFocus: 'muscle', injuries: [],
    experience: 'intermediate', ageGroup: 'adult', equipment: 'gym', trainingDays: [0, 2, 4],
    gameDays: [], sessionMinutes: 60, startDate: '2026-10-26', targetDate: null, weeks: 12, units: 'lb',
    ...over,
  };
}

const DAY_SETS = [[2], [0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 4, 5], [0, 1, 2, 3, 4, 5]];
const EQUIP: Equipment[] = ['gym', 'home', 'bodyweight'];

describe('content', () => {
  it('every referenced exercise exists', () => {
    for (const s of SPORTS) for (const id of [...s.prehab, ...s.prefer]) expect(EX[id], `${s.id}: ${id}`).toBeTruthy();
    for (const inj of INJURIES) for (const st of inj.stages) for (const d of st.work) expect(EX[d.ex], `${inj.id}: ${d.ex}`).toBeTruthy();
    for (const s of SPORTS) for (const i of s.injuries) expect(INJURY[i], `${s.id}: ${i}`).toBeTruthy();
  });

  it('exercise ids are unique', () => {
    expect(new Set(EXERCISES.map(e => e.id)).size).toBe(EXERCISES.length);
  });

  it('every pattern used by a template has a bodyweight option or a fallback', () => {
    const bw = new Set(EXERCISES.filter(e => e.tier === 0).map(e => e.pattern));
    for (const p of ['squat', 'hinge', 'lunge', 'hpush', 'hpull', 'core-antiext', 'core-lateral', 'calf', 'ham-curl', 'glute', 'mobility'] as const) {
      expect(bw.has(p), p).toBe(true);
    }
  });
});

describe('generatePlan', () => {
  const goals: Goal[] = ['offseason', 'inseason', 'general', 'rehab'];
  const sports: (SportId | null)[] = [...SPORTS.map(s => s.id), null];

  for (const goal of goals) {
    for (const equipment of EQUIP) {
      it(`${goal} / ${equipment}: every sport and schedule builds a valid plan`, () => {
        for (const sport of sports) {
          if ((goal === 'offseason' || goal === 'inseason') && !sport) continue;
          for (const days of DAY_SETS) {
            const injuries = goal === 'rehab' ? [{ id: 'hamstring-strain' as InjuryId, pain: 4, startStage: 0, protectOnly: false }] : [];
            const p = profile({ goal, sport, equipment, trainingDays: days, injuries, gameDays: goal === 'inseason' ? [5] : [] });
            const plan = generatePlan(p);
            expect(plan.weeks.length).toBe(planWeeks(p));
            const tier = TIER[equipment];
            for (const w of plan.weeks) {
              expect(w.days.length).toBe(7);
              const train = w.days.filter(d => d.kind === 'train');
              expect(train.length, `${goal} ${sport} ${days}`).toBe(Math.min(scheduleDays(p).length, 6) - w.days.filter(d => d.kind === 'recovery').length);
              for (const d of w.days) {
                const ids = d.blocks.flatMap(b => b.items.map(i => i.ex));
                for (const id of ids) {
                  expect(EX[id], id).toBeTruthy();
                  expect(EX[id].tier, `${id} on ${equipment}`).toBeLessThanOrEqual(tier);
                }
                expect(new Set(ids).size, `duplicate in ${d.title}`).toBe(ids.length);
                if (d.kind === 'train') {
                  const work = d.blocks.filter(b => b.title !== 'Warm-up').reduce((a, b) => a + b.items.length + (b.rehab ? 1 : 0), 0);
                  expect(work, `${goal} ${sport} ${equipment} ${d.title}`).toBeGreaterThanOrEqual(3);
                  expect(d.minutes).toBeLessThanOrEqual(p.sessionMinutes + 10);
                }
              }
            }
          }
        }
      });
    }
  }

  it('in-season plans never train on game days or the day before', () => {
    const p = profile({ goal: 'inseason', sport: 'basketball', trainingDays: [0, 1, 2, 3, 4], gameDays: [2, 5] });
    const plan = generatePlan(p);
    for (const w of plan.weeks) {
      expect(w.days[2].kind).toBe('game');
      expect(w.days[5].kind).toBe('game');
      expect(w.days[1].kind).not.toBe('train');
      expect(w.days[4].kind).not.toBe('train');
    }
  });

  it('off-season plan length follows the season start date', () => {
    const p = profile({ startDate: '2026-10-26', targetDate: '2027-01-18' });
    expect(planWeeks(p)).toBe(13);
    expect(generatePlan(p).phases.at(-1)!.kind).toBe('peak');
  });

  it('beginners and teens never get high-intensity plyometrics', () => {
    for (const over of [{ experience: 'beginner' as const }, { ageGroup: 'teen' as const }]) {
      const plan = generatePlan(profile({ ...over, sport: 'basketball', trainingDays: [0, 1, 2, 3, 4] }));
      const ids = plan.weeks.flatMap(w => w.days.flatMap(d => d.blocks.flatMap(b => b.items.map(i => i.ex))));
      expect(ids.some(id => EX[id].tags.includes('plyo-high'))).toBe(false);
    }
  });
});

describe('injury resolution', () => {
  for (const inj of INJURIES) {
    it(`${inj.id}: stage 1 sessions contain nothing the injury should avoid`, () => {
      for (const sport of SPORTS) {
        for (const equipment of EQUIP) {
          const injuries = [{ id: inj.id, pain: 4, startStage: 0, protectOnly: false }];
          const p = profile({ sport: sport.id, equipment, injuries, trainingDays: [0, 1, 3, 4] });
          const plan = generatePlan(p);
          const rehab = {};
          const avoid = avoidMap(injuries, rehab);
          for (const d of plan.weeks[0].days) {
            for (const [bi, b] of d.blocks.entries()) {
              if (b.rehab) {
                const items = rehabItems(b.rehab, rehab, TIER[equipment], `${bi}-`);
                expect(items.length).toBeGreaterThan(0);
                for (const r of items) expect(r.ex.tier).toBeLessThanOrEqual(TIER[equipment]);
                continue;
              }
              const res = resolveItems(b.items, `${bi}-`, { rehab, swaps: {}, injuries, tier: TIER[equipment] });
              for (const r of res.items) {
                const bad = r.ex.tags.filter(t => avoid.has(t));
                expect(bad, `${sport.id}/${equipment}: ${r.ex.id}`).toEqual([]);
              }
            }
          }
        }
      }
    });
  }

  it('protect-only injuries get no rehab block but still restrict exercises', () => {
    const injuries = [{ id: 'shin-splints' as InjuryId, pain: 7, startStage: 0, protectOnly: true }];
    const plan = generatePlan(profile({ sport: 'basketball', injuries }));
    const blocks = plan.weeks[0].days.flatMap(d => d.blocks);
    expect(blocks.some(b => b.rehab)).toBe(false);
    const avoid = avoidMap(injuries, { 'shin-splints': { stage: 3, stageStartedAt: '2026-10-26', checks: [] } });
    expect(avoid.has('impact')).toBe(true);
  });
});
